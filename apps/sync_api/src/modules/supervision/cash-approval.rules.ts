/**
 * Spec 019 — pure rules of the cash approval chain (no database access).
 *
 * Corte Z: N1 (OIS, or the assigned supervisor when the OIS closed it) → N2
 * (assigned supervisor or owner). Cash movements: N1 only (S-1), recorded in an
 * append-only ledger where rejections, cancellations and adjustments insert
 * reversal entries (S-4).
 */
import { BRANCH_OPERATOR_ROLE, BRANCH_SUPERVISOR_ROLE, OWNER_ROLE, normalizeOperationalRole } from '../auth/roles';
import { CASH_APPROVAL_CONFIG } from './cash-approval.config';

export type ShiftReviewStatus =
  | 'no_aplica'
  | 'pendiente_n1'
  | 'rechazado_n1'
  | 'pendiente_n2'
  | 'rechazado_n2'
  | 'aprobado'
  | 'aprobado_con_ajuste';

export type MovementStatus =
  | 'aprobado_historico'
  | 'pendiente_n1'
  | 'aprobado'
  | 'rechazado'
  | 'cancelado'
  | 'ajustado'
  | 'no_aplica';

export type EntryKind = 'movimiento' | 'reverso' | 'ajuste';
export type N1ResolverRole = typeof BRANCH_OPERATOR_ROLE | typeof BRANCH_SUPERVISOR_ROLE;

export type ShiftAction =
  | 'approve_n1'
  | 'reject_n1'
  | 'recount'
  | 'approve_n2'
  | 'adjust_n2'
  | 'reject_n2'
  | 'reopen';

export type MovementAction = 'approve' | 'reject' | 'cancel' | 'adjust';

export class ApprovalRuleError extends Error {
  constructor(
    public readonly kind: 'forbidden' | 'conflict' | 'unprocessable',
    message: string,
  ) {
    super(message);
  }
}

export interface ApprovalActor {
  id: string;
  roles: string[];
  branchId?: string | null;
  /** Branches assigned to this user as supervisor (active assignments). */
  assignedBranchIds: string[];
  /** True when the actor is owner with access to the item's business. */
  isOwner: boolean;
}

export const FINAL_SHIFT_STATUSES: ShiftReviewStatus[] = ['aprobado', 'aprobado_con_ajuste'];
export const OPEN_BLOCKING_STATUSES: ShiftReviewStatus[] = ['pendiente_n1', 'rechazado_n1'];

export function normalizeRoles(roles: unknown, fallback?: string | null): string[] {
  const source = Array.isArray(roles) && roles.length > 0 ? roles : fallback ? [fallback] : [];
  return Array.from(
    new Set(
      source
        .map((role) => normalizeOperationalRole(role?.toString().trim()))
        .filter((role): role is string => Boolean(role)),
    ),
  );
}

export const hasRole = (roles: string[], role: string) => roles.includes(role);
export const isOwnerRole = (roles: string[]) => hasRole(roles, OWNER_ROLE);

/** S-3: whatever the OIS closes or records is resolved at N1 by the supervisor. */
export function n1ResolverRoleFor(authorRoles: string[]): N1ResolverRole {
  return hasRole(authorRoles, BRANCH_OPERATOR_ROLE) ? BRANCH_SUPERVISOR_ROLE : BRANCH_OPERATOR_ROLE;
}

export function isSupervisorOf(actor: ApprovalActor, branchId: string): boolean {
  return hasRole(actor.roles, BRANCH_SUPERVISOR_ROLE) && actor.assignedBranchIds.includes(branchId);
}

/**
 * N1 for a Corte Z or a cash movement.
 * - Nobody resolves their own item.
 * - S-6: neither the supervisor nor the owner replaces the OIS…
 * - …except S-3: when the OIS is the author, the assigned supervisor resolves N1.
 */
export function assertCanResolveN1(
  actor: ApprovalActor,
  item: { branchId: string; authorId: string | null; n1ResolverRole: string | null },
): void {
  if (item.authorId && item.authorId === actor.id) {
    throw new ApprovalRuleError('forbidden', 'No puedes aprobar ni rechazar lo que tú registraste.');
  }
  const resolver = (item.n1ResolverRole ?? BRANCH_OPERATOR_ROLE) as N1ResolverRole;
  if (resolver === BRANCH_SUPERVISOR_ROLE) {
    if (!isSupervisorOf(actor, item.branchId)) {
      throw new ApprovalRuleError(
        'forbidden',
        'El nivel 1 de lo registrado por el operador de sucursal lo resuelve el supervisor asignado.',
      );
    }
    return;
  }
  if (!hasRole(actor.roles, BRANCH_OPERATOR_ROLE) || actor.branchId !== item.branchId) {
    throw new ApprovalRuleError(
      'forbidden',
      'El nivel 1 lo resuelve el operador de esa sucursal; el supervisor y el owner no lo sustituyen.',
    );
  }
}

/** N2 of a Corte Z: assigned supervisor or owner, never the author, and (C-1) not the N1 approver. */
export function assertCanResolveN2(
  actor: ApprovalActor,
  shift: { branchId: string; closedBy: string | null; operatorReviewedBy: string | null },
  config = CASH_APPROVAL_CONFIG,
): void {
  if (!actor.isOwner && !isSupervisorOf(actor, shift.branchId)) {
    throw new ApprovalRuleError('forbidden', 'Solo el supervisor asignado a la sucursal o el owner resuelven el nivel 2.');
  }
  if (shift.closedBy && shift.closedBy === actor.id) {
    throw new ApprovalRuleError('forbidden', 'No puedes aprobar tu propio Corte Z.');
  }
  if (config.n2MustDifferFromN1 && shift.operatorReviewedBy && shift.operatorReviewedBy === actor.id) {
    throw new ApprovalRuleError('forbidden', 'El nivel 2 debe resolverlo una persona distinta de quien aprobó el nivel 1.');
  }
}

/** Cancel/adjust a movement: assigned supervisor or owner (MV-04). */
export function assertCanCancelOrAdjust(actor: ApprovalActor, branchId: string): void {
  if (!actor.isOwner && !isSupervisorOf(actor, branchId)) {
    throw new ApprovalRuleError('forbidden', 'Solo el supervisor asignado o el owner pueden cancelar o ajustar movimientos.');
  }
}

const SHIFT_TRANSITIONS: Record<ShiftAction, Partial<Record<ShiftReviewStatus, ShiftReviewStatus>>> = {
  approve_n1: { pendiente_n1: 'pendiente_n2' },
  reject_n1: { pendiente_n1: 'rechazado_n1' },
  // S-5: a recount after an N2 rejection goes straight back to N2.
  recount: { rechazado_n1: 'pendiente_n1', rechazado_n2: 'pendiente_n2' },
  approve_n2: { pendiente_n2: 'aprobado' },
  adjust_n2: { pendiente_n2: 'aprobado_con_ajuste', rechazado_n2: 'aprobado_con_ajuste' },
  reject_n2: { pendiente_n2: 'rechazado_n2' },
  reopen: { aprobado: 'pendiente_n2', aprobado_con_ajuste: 'pendiente_n2' },
};

export function nextShiftStatus(current: string, action: ShiftAction): ShiftReviewStatus {
  const next = SHIFT_TRANSITIONS[action][current as ShiftReviewStatus];
  if (!next) {
    throw new ApprovalRuleError('conflict', `La acción "${action}" no aplica a un Corte Z en estado "${current}".`);
  }
  return next;
}

export function shiftActionLevel(action: ShiftAction): 'n1' | 'n2' | 'owner' | null {
  if (action === 'approve_n1' || action === 'reject_n1') return 'n1';
  if (action === 'approve_n2' || action === 'adjust_n2' || action === 'reject_n2') return 'n2';
  if (action === 'reopen') return 'owner';
  return null;
}

const MOVEMENT_TRANSITIONS: Record<MovementAction, Partial<Record<MovementStatus, MovementStatus>>> = {
  approve: { pendiente_n1: 'aprobado' },
  reject: { pendiente_n1: 'rechazado' },
  cancel: { pendiente_n1: 'cancelado', aprobado: 'cancelado', aprobado_historico: 'cancelado' },
  adjust: { pendiente_n1: 'ajustado', aprobado: 'ajustado', aprobado_historico: 'ajustado' },
};

export function nextMovementStatus(current: string, action: MovementAction): MovementStatus {
  const next = MOVEMENT_TRANSITIONS[action][current as MovementStatus];
  if (!next) {
    throw new ApprovalRuleError('conflict', `La acción "${action}" no aplica a un movimiento en estado "${current}".`);
  }
  return next;
}

/** Whether the action inserts a reversal entry in the ledger (S-4). */
export const movementActionReverses = (action: MovementAction) => action !== 'approve';

/** MV-04: once the Corte Z of the shift has its final approval, its ledger is closed. */
export function assertShiftLedgerOpen(shiftReviewStatus: string): void {
  if (FINAL_SHIFT_STATUSES.includes(shiftReviewStatus as ShiftReviewStatus)) {
    throw new ApprovalRuleError(
      'conflict',
      'El Corte Z de este turno ya tiene aprobación final; el owner debe reabrirlo para corregir movimientos.',
    );
  }
}

/** CZ-06: a level cannot approve a corte while movements of the shift await N1. */
export function assertNoPendingMovements(entries: Array<{ entryKind?: string | null; approvalStatus?: string | null }>): void {
  const pending = entries.filter(
    (e) => (e.entryKind ?? 'movimiento') === 'movimiento' && e.approvalStatus === 'pendiente_n1',
  ).length;
  if (pending > 0) {
    throw new ApprovalRuleError(
      'unprocessable',
      `Hay ${pending} movimiento(s) de caja pendientes de aprobación en este turno; resuélvelos primero.`,
    );
  }
}

export interface LedgerEntry {
  id: string;
  type: string; // cash-in | cash-out
  amount: string | number;
  entryKind?: string | null;
  approvalStatus?: string | null;
  reversesTransactionId?: string | null;
  replacesTransactionId?: string | null;
  createdAt?: Date | string | null;
  [key: string]: unknown;
}

const money = (value: unknown) => Number.parseFloat(value?.toString() ?? '0') || 0;
export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Signed effect of a ledger entry on expected cash (mirror of the cash_effect generated column). */
export function cashEffect(entry: Pick<LedgerEntry, 'type' | 'amount' | 'entryKind'>): number {
  const sign = entry.type === 'cash-in' ? 1 : -1;
  const reversal = entry.entryKind === 'reverso' ? -1 : 1;
  return roundMoney(money(entry.amount) * sign * reversal);
}

export type MovementGroup = 'aprobados' | 'pendientes' | 'revertidos' | 'ajustados';

export interface GroupedMovements {
  aprobados: LedgerEntry[];
  pendientes: LedgerEntry[];
  revertidos: LedgerEntry[];
  ajustados: LedgerEntry[];
  totals: {
    grossIn: number;
    grossOut: number;
    reversals: number;
    net: number;
    pending: number;
  };
}

/** Spec §4.4.4: approved / pending / reverted / adjusted, with the net that feeds expected cash. */
export function groupMovements(entries: LedgerEntry[]): GroupedMovements {
  const result: GroupedMovements = {
    aprobados: [],
    pendientes: [],
    revertidos: [],
    ajustados: [],
    totals: { grossIn: 0, grossOut: 0, reversals: 0, net: 0, pending: 0 },
  };
  for (const entry of entries) {
    const kind = entry.entryKind ?? 'movimiento';
    const effect = cashEffect(entry);
    result.totals.net += effect;
    if (kind === 'reverso') {
      result.totals.reversals += effect;
      continue;
    }
    if (entry.type === 'cash-in') result.totals.grossIn += money(entry.amount);
    else result.totals.grossOut += money(entry.amount);
    if (kind === 'ajuste') {
      result.ajustados.push(entry);
      continue;
    }
    switch (entry.approvalStatus) {
      case 'pendiente_n1':
        result.pendientes.push(entry);
        result.totals.pending += effect;
        break;
      case 'rechazado':
      case 'cancelado':
        result.revertidos.push(entry);
        break;
      case 'ajustado':
        result.ajustados.push(entry);
        break;
      default:
        result.aprobados.push(entry);
    }
  }
  result.totals = {
    grossIn: roundMoney(result.totals.grossIn),
    grossOut: roundMoney(result.totals.grossOut),
    reversals: roundMoney(result.totals.reversals),
    net: roundMoney(result.totals.net),
    pending: roundMoney(result.totals.pending),
  };
  return result;
}

export type ReconciliationStatus = 'BALANCED' | 'SURPLUS' | 'SHORTAGE' | 'REQUIRES_RECONCILIATION';

/** Server-side mirror of ReportsPage.reconcileCash, computed on adjusted/approved expected cash. */
export function reconciliationStatus(expected: number, counted: number): ReconciliationStatus {
  if (Math.round(expected * 100) < 0) return 'REQUIRES_RECONCILIATION';
  const diffCents = Math.round((counted - expected) * 100);
  if (diffCents === 0) return 'BALANCED';
  return diffCents > 0 ? 'SURPLUS' : 'SHORTAGE';
}

/**
 * D-4 / C-2 / P-2: whether the last closed shift of the branch blocks opening a new one.
 */
export function isOpeningBlockedBy(
  lastShift: {
    reviewStatus?: string | null;
    n1ResolverRole?: string | null;
    openBlockOverriddenAt?: Date | string | null;
  } | null,
  config = CASH_APPROVAL_CONFIG,
): boolean {
  if (!lastShift) return false;
  if (!OPEN_BLOCKING_STATUSES.includes((lastShift.reviewStatus ?? 'no_aplica') as ShiftReviewStatus)) return false;
  if (lastShift.openBlockOverriddenAt) return false;
  if (lastShift.n1ResolverRole === BRANCH_SUPERVISOR_ROLE && !config.oisCloseBlocksOpeningUntilN1) return false;
  return true;
}

/** Shortage that becomes a cashier debt (D-8): only negative final differences. */
export function debtAmountFor(approvedDifference: number): number {
  return approvedDifference < 0 ? roundMoney(-approvedDifference) : 0;
}

/** Reasons are mandatory for every rejection, adjustment, cancellation, reopen and unblock (AU-03). */
export function requireReason(reason: string | undefined | null, what: string): string {
  const trimmed = reason?.trim() ?? '';
  if (trimmed.length < 3) {
    throw new ApprovalRuleError('unprocessable', `Se requiere un motivo para ${what}.`);
  }
  return trimmed;
}
