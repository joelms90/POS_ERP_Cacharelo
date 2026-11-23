import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  SQL,
  sql,
} from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import type { AppDatabase, DbExecutor } from '../audit/db-executor';
import { AuditLogService } from '../audit/audit-log.service';
import { NotificationsService } from '../audit/notifications.service';
import {
  JwtUser,
  SupervisorScopeService,
} from '../audit/supervisor-scope.service';
import { ShiftsService } from '../shifts/shifts.service';
import { TransactionsRepository } from '../shifts/repositories/transactions.repository';
import { BRANCH_OPERATOR_ROLE, BRANCH_SUPERVISOR_ROLE } from '../auth/roles';
import {
  ApprovalActor,
  ApprovalRuleError,
  assertCanCancelOrAdjust,
  assertCanResolveN1,
  assertCanResolveN2,
  assertNoPendingMovements,
  assertShiftLedgerOpen,
  cashEffect,
  debtAmountFor,
  isOpeningBlockedBy,
  MovementAction,
  n1ResolverRoleFor,
  nextMovementStatus,
  nextShiftStatus,
  reconciliationStatus,
  requireReason,
  roundMoney,
  ShiftAction,
} from './cash-approval.rules';
import {
  AdjustMovementDto,
  AdjustShiftDto,
  ApproveDto,
  RejectDto,
} from './dto/approval.dto';

type Shift = typeof schema.cashShifts.$inferSelect;
type Movement = typeof schema.cashTransactions.$inferSelect;

const PENDING_SHIFT_STATUSES = [
  'pendiente_n1',
  'rechazado_n1',
  'pendiente_n2',
  'rechazado_n2',
];
const money = (value: unknown) =>
  Number.parseFloat(value?.toString() ?? '0') || 0;

function toHttp(error: unknown): never {
  if (error instanceof ApprovalRuleError) {
    if (error.kind === 'forbidden') throw new ForbiddenException(error.message);
    if (error.kind === 'conflict') throw new ConflictException(error.message);
    throw new UnprocessableEntityException(error.message);
  }
  throw error;
}

function guard<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    return toHttp(error);
  }
}

/**
 * Spec 019 — Corte Z approval chain (N1 → N2), cash movement approvals with ledger
 * reversals (S-4), cashier debts (D-8) and the supervision inbox.
 */
@Injectable()
export class ApprovalsService {
  constructor(
    @Inject(DRIZZLE_CONNECTION) private readonly db: AppDatabase,
    private readonly shifts: ShiftsService,
    private readonly transactions: TransactionsRepository,
    private readonly audit: AuditLogService,
    private readonly notifications: NotificationsService,
    private readonly scope: SupervisorScopeService,
  ) {}

  // ---------------------------------------------------------------------------
  // Corte Z
  // ---------------------------------------------------------------------------

  async approveShift(
    shiftId: string,
    user: JwtUser,
    dto: ApproveDto,
    source: 'admin_web' | 'pos',
  ) {
    const { shift, actor, branch } = await this.loadShiftForAction(
      shiftId,
      user,
    );
    const level = this.levelFor(shift.reviewStatus);
    const action: ShiftAction = level === 'n1' ? 'approve_n1' : 'approve_n2';
    this.authorizeShiftLevel(actor, shift, level);
    const next = guard(() => nextShiftStatus(shift.reviewStatus, action));
    const movements = await this.transactions.findByShiftId(shift.id);
    guard(() => assertNoPendingMovements(movements));
    this.assertVersion(shift.version, dto.version);

    return this.db.transaction(async (tx) => {
      if (level === 'n1') {
        const updated = await this.casShift(tx, shift, {
          reviewStatus: next,
          operatorReviewedBy: actor.id,
          operatorReviewedAt: new Date(),
          operatorNotes: dto.reason?.trim() || null,
        });
        await this.recordShift(
          tx,
          shift,
          branch.businessId,
          actor,
          user,
          'corte_z_aprobado',
          'n1',
          dto.reason,
          source,
          {
            before: { reviewStatus: shift.reviewStatus },
            after: { reviewStatus: next },
          },
        );
        await this.notifications.resolveActionFor(tx, 'cash_shift', shift.id);
        await this.notifications.notify(tx, {
          businessId: branch.businessId,
          branchId: shift.branchId,
          recipients: (
            await this.n2Recipients(shift.branchId, branch.businessId)
          ).filter((id) => id !== actor.id),
          type: 'aprobacion_pendiente',
          requiresAction: true,
          entityType: 'cash_shift',
          entityId: shift.id,
          title: `Corte Z por aprobar (nivel 2) · ${branch.name}`,
          body: `Aprobado en nivel 1. Diferencia: $${money(shift.closeSnapshot && (shift.closeSnapshot as any).summary?.cashDifference).toFixed(2)}`,
        });
        return updated;
      }

      const figures = await this.adjustedFigures(shift);
      const approvedDifference = figures.adjustedDifference ?? 0;
      const updated = await this.casShift(tx, shift, {
        reviewStatus: next,
        reviewedBy: actor.id,
        reviewedAt: new Date(),
        reviewNotes: dto.reason?.trim() || null,
        approvedAmount: figures.counted.toFixed(2),
        approvedDifference: approvedDifference.toFixed(2),
        approvalSnapshot: {
          ...figures,
          approvedAt: new Date(),
          approvedBy: actor.id,
        },
      });
      await this.recordShift(
        tx,
        shift,
        branch.businessId,
        actor,
        user,
        'corte_z_aprobado',
        'n2',
        dto.reason,
        source,
        {
          before: { reviewStatus: shift.reviewStatus },
          after: {
            reviewStatus: next,
            approvedAmount: figures.counted,
            approvedDifference,
          },
        },
      );
      await this.afterFinalApproval(
        tx,
        shift,
        branch,
        actor,
        approvedDifference,
        user,
        source,
      );
      return updated;
    });
  }

  async rejectShift(
    shiftId: string,
    user: JwtUser,
    dto: RejectDto,
    source: 'admin_web' | 'pos',
  ) {
    const reason = guard(() =>
      requireReason(dto.reason, 'rechazar el Corte Z'),
    );
    const { shift, actor, branch } = await this.loadShiftForAction(
      shiftId,
      user,
    );
    const level = this.levelFor(shift.reviewStatus);
    this.authorizeShiftLevel(actor, shift, level);
    const next = guard(() =>
      nextShiftStatus(
        shift.reviewStatus,
        level === 'n1' ? 'reject_n1' : 'reject_n2',
      ),
    );
    this.assertVersion(shift.version, dto.version);

    return this.db.transaction(async (tx) => {
      const updates: Partial<Shift> =
        level === 'n1'
          ? {
              reviewStatus: next,
              operatorReviewedBy: actor.id,
              operatorReviewedAt: new Date(),
              operatorNotes: reason,
            }
          : {
              reviewStatus: next,
              reviewedBy: actor.id,
              reviewedAt: new Date(),
              reviewNotes: reason,
            };
      const updated = await this.casShift(tx, shift, updates);
      await this.recordShift(
        tx,
        shift,
        branch.businessId,
        actor,
        user,
        'corte_z_rechazado',
        level,
        reason,
        source,
        {
          before: { reviewStatus: shift.reviewStatus },
          after: { reviewStatus: next },
        },
      );
      await this.notifications.resolveActionFor(tx, 'cash_shift', shift.id);
      const author = shift.closedBy ?? shift.cashierId;
      const recipients =
        level === 'n1'
          ? [author]
          : [
              shift.cashierId,
              author,
              ...(await this.scope.operatorsOf(
                shift.branchId,
                branch.businessId,
              )),
            ];
      await this.notifications.notify(tx, {
        businessId: branch.businessId,
        branchId: shift.branchId,
        recipients: recipients.filter((id) => id !== actor.id),
        type: 'aprobacion_resuelta',
        requiresAction: true,
        entityType: 'cash_shift',
        entityId: shift.id,
        title: `Corte Z rechazado (${level === 'n1' ? 'nivel 1' : 'nivel 2'}) — recontar · ${branch.name}`,
        body: reason,
      });
      return updated;
    });
  }

  async adjustShift(
    shiftId: string,
    user: JwtUser,
    dto: AdjustShiftDto,
    source: 'admin_web' | 'pos',
  ) {
    const reason = guard(() => requireReason(dto.reason, 'ajustar el Corte Z'));
    const { shift, actor, branch } = await this.loadShiftForAction(
      shiftId,
      user,
    );
    if (!['pendiente_n2', 'rechazado_n2'].includes(shift.reviewStatus)) {
      throw new ConflictException(
        'Solo se puede aprobar con ajuste un Corte Z en nivel 2.',
      );
    }
    guard(() => assertCanResolveN2(actor, this.n2Context(shift)));
    const next = guard(() => nextShiftStatus(shift.reviewStatus, 'adjust_n2'));
    const movements = await this.transactions.findByShiftId(shift.id);
    guard(() => assertNoPendingMovements(movements));
    this.assertVersion(shift.version, dto.version);
    const approvedAmount = money(dto.approvedAmount);

    return this.db.transaction(async (tx) => {
      const figures = await this.adjustedFigures(shift, approvedAmount);
      const approvedDifference = figures.adjustedDifference ?? 0;
      const updated = await this.casShift(tx, shift, {
        reviewStatus: next,
        reviewedBy: actor.id,
        reviewedAt: new Date(),
        reviewNotes: reason,
        approvedAmount: approvedAmount.toFixed(2),
        approvedDifference: approvedDifference.toFixed(2),
        approvalSnapshot: {
          ...figures,
          originalCounted: money(shift.cashDrawerAmount),
          denominationCounts: dto.denominationCounts ?? null,
          approvedAt: new Date(),
          approvedBy: actor.id,
        },
      });
      await this.recordShift(
        tx,
        shift,
        branch.businessId,
        actor,
        user,
        'corte_z_ajustado',
        'n2',
        reason,
        source,
        {
          before: {
            reviewStatus: shift.reviewStatus,
            counted: money(shift.cashDrawerAmount),
          },
          after: { reviewStatus: next, approvedAmount, approvedDifference },
        },
      );
      await this.afterFinalApproval(
        tx,
        shift,
        branch,
        actor,
        approvedDifference,
        user,
        source,
      );
      return updated;
    });
  }

  async reopenShift(shiftId: string, user: JwtUser, reasonInput: string) {
    const reason = guard(() =>
      requireReason(reasonInput, 'reabrir el Corte Z'),
    );
    const { shift, actor, branch } = await this.loadShiftForAction(
      shiftId,
      user,
    );
    if (!actor.isOwner)
      throw new ForbiddenException(
        'Solo el owner puede reabrir un Corte Z aprobado.',
      );
    const next = guard(() => nextShiftStatus(shift.reviewStatus, 'reopen'));

    return this.db.transaction(async (tx) => {
      const updated = await this.casShift(tx, shift, {
        reviewStatus: next,
        reviewedBy: null,
        reviewedAt: null,
        approvedAmount: null,
        approvedDifference: null,
        approvalSnapshot: null,
      });
      const voided = await tx
        .update(schema.cashierDebts)
        .set({ status: 'anulado', voidedBy: actor.id, voidedAt: new Date() })
        .where(
          and(
            eq(schema.cashierDebts.shiftId, shift.id),
            eq(schema.cashierDebts.status, 'vigente'),
          ),
        )
        .returning();
      await this.recordShift(
        tx,
        shift,
        branch.businessId,
        actor,
        user,
        'corte_z_reabierto',
        'owner',
        reason,
        'admin_web',
        {
          before: {
            reviewStatus: shift.reviewStatus,
            approvedDifference: shift.approvedDifference,
          },
          after: { reviewStatus: next },
        },
      );
      for (const debt of voided) {
        await this.audit.record(tx, {
          businessId: branch.businessId,
          branchId: shift.branchId,
          entityType: 'cashier_debt',
          entityId: debt.id,
          action: 'adeudo_anulado',
          approvalLevel: 'owner',
          actorId: actor.id,
          actorRole: 'owner',
          reason,
          before: { status: 'vigente', amount: debt.amount },
          after: { status: 'anulado' },
          source: 'admin_web',
        });
        await this.notifications.notify(tx, {
          businessId: branch.businessId,
          branchId: shift.branchId,
          recipients: [debt.cashierId],
          type: 'adeudo_anulado',
          entityType: 'cashier_debt',
          entityId: debt.id,
          title: `Adeudo de $${money(debt.amount).toFixed(2)} anulado por reapertura del corte`,
          body: reason,
        });
      }
      await this.notifications.notify(tx, {
        businessId: branch.businessId,
        branchId: shift.branchId,
        recipients: (await this.scope.supervisorsOf(shift.branchId)).filter(
          (id) => id !== actor.id,
        ),
        type: 'aprobacion_pendiente',
        requiresAction: true,
        entityType: 'cash_shift',
        entityId: shift.id,
        title: `Corte Z reabierto por el owner · ${branch.name}`,
        body: reason,
      });
      return updated;
    });
  }

  /** P-2: owner lets the branch open a new shift; the corte stays pending at N1. */
  async overrideOpenBlock(shiftId: string, user: JwtUser, reasonInput: string) {
    const reason = guard(() =>
      requireReason(reasonInput, 'desbloquear la apertura'),
    );
    const { shift, actor, branch } = await this.loadShiftForAction(
      shiftId,
      user,
    );
    if (!actor.isOwner)
      throw new ForbiddenException(
        'Solo el owner puede desbloquear la apertura de turno.',
      );
    if (shift.openBlockOverriddenAt)
      throw new ConflictException(
        'La apertura ya fue desbloqueada para este corte.',
      );
    if (!isOpeningBlockedBy(shift))
      throw new ConflictException(
        'Este Corte Z no está bloqueando la apertura de turno.',
      );

    return this.db.transaction(async (tx) => {
      const updated = await this.casShift(tx, shift, {
        openBlockOverriddenBy: actor.id,
        openBlockOverriddenAt: new Date(),
        openBlockOverrideReason: reason,
      });
      await this.recordShift(
        tx,
        shift,
        branch.businessId,
        actor,
        user,
        'apertura_desbloqueada',
        'owner',
        reason,
        'admin_web',
        {
          before: { reviewStatus: shift.reviewStatus },
          after: {
            reviewStatus: shift.reviewStatus,
            openBlockOverridden: true,
          },
        },
      );
      await this.notifications.notify(tx, {
        businessId: branch.businessId,
        branchId: shift.branchId,
        recipients: [
          ...(await this.scope.operatorsOf(shift.branchId, branch.businessId)),
          ...(await this.scope.supervisorsOf(shift.branchId)),
        ].filter((id) => id !== actor.id),
        type: 'apertura_desbloqueada',
        entityType: 'cash_shift',
        entityId: shift.id,
        title: `Apertura de caja desbloqueada por el owner · ${branch.name}`,
        body: `${reason}. El Corte Z anterior sigue pendiente de nivel 1.`,
      });
      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // Cash movements (S-1: N1 only; S-4: ledger reversals)
  // ---------------------------------------------------------------------------

  async approveMovement(
    id: string,
    user: JwtUser,
    dto: ApproveDto,
    source: 'admin_web' | 'pos',
  ) {
    return this.resolveMovement(
      id,
      user,
      'approve',
      dto.version,
      dto.reason,
      source,
    );
  }

  async rejectMovement(
    id: string,
    user: JwtUser,
    dto: RejectDto,
    source: 'admin_web' | 'pos',
  ) {
    const reason = guard(() =>
      requireReason(dto.reason, 'rechazar el movimiento'),
    );
    return this.resolveMovement(
      id,
      user,
      'reject',
      dto.version,
      reason,
      source,
    );
  }

  async cancelMovement(id: string, user: JwtUser, dto: RejectDto) {
    const reason = guard(() =>
      requireReason(dto.reason, 'cancelar el movimiento'),
    );
    return this.correctMovement(id, user, 'cancel', dto.version, reason);
  }

  async adjustMovement(id: string, user: JwtUser, dto: AdjustMovementDto) {
    const reason = guard(() =>
      requireReason(dto.reason, 'ajustar el movimiento'),
    );
    const amount = money(dto.amount);
    if (amount <= 0)
      throw new BadRequestException('El monto ajustado debe ser mayor a cero.');
    return this.correctMovement(
      id,
      user,
      'adjust',
      dto.version,
      reason,
      amount,
    );
  }

  /** R-16: what a reject/cancel/adjust would do to the corte difference, shown before confirming. */
  async movementImpact(
    id: string,
    user: JwtUser,
    action: 'reject' | 'cancel' | 'adjust',
    newAmount?: number,
  ) {
    const { movement, shift } = await this.loadMovement(id, user, {
      forView: true,
    });
    const figures = await this.adjustedFigures(shift);
    const removed = -cashEffect(movement as any);
    const added =
      action === 'adjust' && newAmount !== undefined
        ? cashEffect({
            type: movement.type,
            amount: newAmount,
            entryKind: 'ajuste',
          })
        : 0;
    const resultingExpected = roundMoney(
      figures.adjustedExpected + removed + added,
    );
    const counted = shift.status === 'closed' ? figures.counted : null;
    return {
      movementId: movement.id,
      action,
      currentExpected: figures.adjustedExpected,
      resultingExpected,
      currentDifference: counted === null ? null : figures.adjustedDifference,
      resultingDifference:
        counted === null ? null : roundMoney(counted - resultingExpected),
      shiftClosed: shift.status === 'closed',
      message:
        counted === null
          ? `El efectivo esperado del turno pasará de $${figures.adjustedExpected.toFixed(2)} a $${resultingExpected.toFixed(2)}.`
          : `La diferencia del Corte Z pasará de $${(figures.adjustedDifference ?? 0).toFixed(2)} a $${roundMoney(counted - resultingExpected).toFixed(2)}.`,
    };
  }

  private async resolveMovement(
    id: string,
    user: JwtUser,
    action: 'approve' | 'reject',
    version: number,
    reason: string | undefined,
    source: 'admin_web' | 'pos',
  ) {
    const { movement, shift, actor, branch } = await this.loadMovement(
      id,
      user,
    );
    const authorRoles = movement.createdBy
      ? await this.scope.userRoles(movement.createdBy)
      : [];
    const n1ResolverRole = movement.createdBy
      ? n1ResolverRoleFor(authorRoles)
      : BRANCH_OPERATOR_ROLE;
    guard(() =>
      assertCanResolveN1(actor, {
        branchId: shift.branchId,
        authorId: movement.createdBy,
        n1ResolverRole,
      }),
    );
    const next = guard(() =>
      nextMovementStatus(movement.approvalStatus, action),
    );
    if (action === 'reject')
      guard(() => assertShiftLedgerOpen(shift.reviewStatus));
    this.assertVersion(movement.version, version);

    return this.db.transaction(async (tx) => {
      const updated = await this.casMovement(tx, movement, {
        approvalStatus: next,
        reviewedBy: actor.id,
        reviewedAt: new Date(),
        reviewReason: reason?.trim() || null,
        reviewLevel: 'n1',
      });
      let reversal: Movement | null = null;
      if (action === 'reject') {
        reversal = await this.insertReversal(
          tx,
          movement,
          shift,
          actor.id,
          reason!,
        );
      }
      await this.audit.record(tx, {
        businessId: branch.businessId,
        branchId: shift.branchId,
        entityType: 'cash_transaction',
        entityId: movement.id,
        action:
          action === 'approve' ? 'movimiento_aprobado' : 'movimiento_rechazado',
        approvalLevel: 'n1',
        actorId: actor.id,
        actorRole: actor.roles[0] ?? null,
        reason: reason?.trim() || null,
        before: { approvalStatus: movement.approvalStatus },
        after: { approvalStatus: next, reversalId: reversal?.id ?? null },
        source,
        deviceId: this.deviceId(user),
      });
      await this.notifications.resolveActionFor(
        tx,
        'cash_transaction',
        movement.id,
      );
      await this.notifications.notify(tx, {
        businessId: branch.businessId,
        branchId: shift.branchId,
        recipients: [movement.createdBy],
        type: 'aprobacion_resuelta',
        entityType: 'cash_transaction',
        entityId: movement.id,
        title: `${movement.type === 'cash-in' ? 'Ingreso' : 'Egreso'} de $${money(movement.amount).toFixed(2)} ${action === 'approve' ? 'aprobado' : 'rechazado'}`,
        body: reason?.trim() || null,
      });
      return { movement: updated, reversal };
    });
  }

  private async correctMovement(
    id: string,
    user: JwtUser,
    action: Extract<MovementAction, 'cancel' | 'adjust'>,
    version: number,
    reason: string,
    newAmount?: number,
  ) {
    const { movement, shift, actor, branch } = await this.loadMovement(
      id,
      user,
    );
    guard(() => assertCanCancelOrAdjust(actor, shift.branchId));
    guard(() => assertShiftLedgerOpen(shift.reviewStatus));
    const next = guard(() =>
      nextMovementStatus(movement.approvalStatus, action),
    );
    this.assertVersion(movement.version, version);

    return this.db.transaction(async (tx) => {
      const updated = await this.casMovement(tx, movement, {
        approvalStatus: next,
        reviewedBy: actor.id,
        reviewedAt: new Date(),
        reviewReason: reason,
        reviewLevel: 'n2',
      });
      const reversal = await this.insertReversal(
        tx,
        movement,
        shift,
        actor.id,
        reason,
      );
      let replacement: Movement | null = null;
      if (action === 'adjust') {
        replacement = await this.transactions.create(
          {
            shiftId: shift.id,
            type: movement.type,
            amount: newAmount!.toFixed(2),
            reason: `Ajuste: ${reason}`,
            createdAt: new Date(),
            createdBy: actor.id,
            category: movement.category,
            entryKind: 'ajuste',
            replacesTransactionId: movement.id,
            approvalStatus: 'no_aplica',
          },
          tx,
        );
        if (shift.status === 'open') {
          await this.bumpDrawerCache(
            tx,
            shift.id,
            cashEffect({
              type: movement.type,
              amount: newAmount!,
              entryKind: 'ajuste',
            }),
          );
        }
      }
      await this.audit.record(tx, {
        businessId: branch.businessId,
        branchId: shift.branchId,
        entityType: 'cash_transaction',
        entityId: movement.id,
        action:
          action === 'cancel' ? 'movimiento_cancelado' : 'movimiento_ajustado',
        approvalLevel: actor.isOwner ? 'owner' : 'n2',
        actorId: actor.id,
        actorRole: actor.isOwner ? 'owner' : BRANCH_SUPERVISOR_ROLE,
        reason,
        before: {
          approvalStatus: movement.approvalStatus,
          amount: money(movement.amount),
        },
        after: {
          approvalStatus: next,
          amount: action === 'adjust' ? newAmount : 0,
          reversalId: reversal.id,
          replacementId: replacement?.id ?? null,
        },
        source: 'admin_web',
      });
      await this.notifications.resolveActionFor(
        tx,
        'cash_transaction',
        movement.id,
      );
      await this.notifications.notify(tx, {
        businessId: branch.businessId,
        branchId: shift.branchId,
        recipients: [movement.createdBy, shift.cashierId].filter(
          (uid) => uid !== actor.id,
        ),
        type:
          action === 'cancel' ? 'movimiento_cancelado' : 'movimiento_ajustado',
        entityType: 'cash_transaction',
        entityId: movement.id,
        title:
          action === 'cancel'
            ? `Movimiento de $${money(movement.amount).toFixed(2)} cancelado por supervisión`
            : `Movimiento ajustado de $${money(movement.amount).toFixed(2)} a $${newAmount!.toFixed(2)}`,
        body: reason,
      });
      return { movement: updated, reversal, replacement };
    });
  }

  // ---------------------------------------------------------------------------
  // Inbox, detail, debts, assignments, audit
  // ---------------------------------------------------------------------------

  async listApprovals(
    user: JwtUser,
    filters: {
      type?: 'corte_z' | 'cash_movement';
      status?: string;
      branchId?: string;
      from?: string;
      to?: string;
      actionable?: boolean;
    },
  ) {
    const actor = await this.scope.buildActor(user);
    let branchIds = await this.scope.visibleBranchIds(actor, user);
    if (filters.branchId)
      branchIds = branchIds.filter((id) => id === filters.branchId);
    if (branchIds.length === 0) return { cortes: [], movements: [] };
    const from = filters.from ? new Date(`${filters.from}T00:00:00`) : null;
    const to = filters.to ? new Date(`${filters.to}T23:59:59`) : null;

    const cortes =
      filters.type === 'cash_movement'
        ? []
        : await this.listShiftItems(
            actor,
            user,
            branchIds,
            filters.status ? filters.status.split(',') : PENDING_SHIFT_STATUSES,
            from,
            to,
          );
    const movements =
      filters.type === 'corte_z'
        ? []
        : await this.listMovementItems(
            actor,
            user,
            branchIds,
            filters.status ? filters.status.split(',') : ['pendiente_n1'],
            from,
            to,
          );
    return {
      cortes: filters.actionable ? cortes.filter((c) => c.canAct) : cortes,
      movements: filters.actionable
        ? movements.filter((m) => m.canAct)
        : movements,
    };
  }

  /** Branches the caller can supervise or see (supervisor: assigned; owner: business-wide). */
  async visibleBranches(user: JwtUser) {
    const actor = await this.scope.buildActor(user);
    const ids = await this.scope.visibleBranchIds(actor, user);
    if (!ids.length) return [];
    return this.db
      .select({
        id: schema.branches.id,
        name: schema.branches.name,
        businessId: schema.branches.businessId,
      })
      .from(schema.branches)
      .where(inArray(schema.branches.id, ids))
      .orderBy(schema.branches.name);
  }

  async countActionable(user: JwtUser) {
    const result = await this.listApprovals(user, { actionable: true });
    return {
      cortes: result.cortes.length,
      movements: result.movements.length,
      total: result.cortes.length + result.movements.length,
    };
  }

  async getShiftDetail(shiftId: string, user: JwtUser) {
    const shift = await this.getShift(shiftId);
    const actor = await this.scope.buildActor(user);
    await this.assertCanView(actor, user, shift.branchId);
    const branch = await this.scope.getBranch(shift.branchId);
    const scopedActor = this.scope.actorForBusiness(
      actor,
      user,
      branch.businessId,
    );
    const figures = await this.adjustedFigures(shift);
    const report = await this.shifts.buildShiftReport(shift, {
      closedAt: shift.closedAt ? new Date(shift.closedAt) : new Date(),
      actualCash: shift.status === 'closed' ? figures.counted : undefined,
      denominationCounts: (shift.denominationCounts ?? undefined) as
        | Record<string, number>
        | undefined,
      closeNotes: shift.closeNotes ?? undefined,
      status: shift.status as 'open' | 'closed',
    });
    const history = await this.audit.query({
      entityType: 'cash_shift',
      entityId: shift.id,
      limit: 200,
    });
    const names = await this.userNames([
      shift.cashierId,
      shift.closedBy,
      shift.operatorReviewedBy,
      shift.reviewedBy,
    ]);
    return {
      shift: {
        id: shift.id,
        branchId: shift.branchId,
        branchName: branch.name,
        businessId: branch.businessId,
        cashierId: shift.cashierId,
        cashierName: names[shift.cashierId] ?? null,
        status: shift.status,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        reviewStatus: shift.reviewStatus,
        n1ResolverRole: shift.n1ResolverRole,
        closedBy: shift.closedBy,
        closedByName: shift.closedBy ? (names[shift.closedBy] ?? null) : null,
        operatorReviewedBy: shift.operatorReviewedBy,
        operatorReviewedByName: shift.operatorReviewedBy
          ? (names[shift.operatorReviewedBy] ?? null)
          : null,
        operatorReviewedAt: shift.operatorReviewedAt,
        operatorNotes: shift.operatorNotes,
        reviewedBy: shift.reviewedBy,
        reviewedByName: shift.reviewedBy
          ? (names[shift.reviewedBy] ?? null)
          : null,
        reviewedAt: shift.reviewedAt,
        reviewNotes: shift.reviewNotes,
        recountCount: shift.recountCount,
        closedOffline: shift.closedOffline,
        localExpectedCash:
          shift.localExpectedCash != null
            ? money(shift.localExpectedCash)
            : null,
        openBlockOverriddenAt: shift.openBlockOverriddenAt,
        openBlockOverrideReason: shift.openBlockOverrideReason,
        approvedAmount:
          shift.approvedAmount != null ? money(shift.approvedAmount) : null,
        approvedDifference:
          shift.approvedDifference != null
            ? money(shift.approvedDifference)
            : null,
        version: shift.version,
      },
      figures,
      report,
      approvalSnapshot: shift.approvalSnapshot ?? null,
      permissions: this.shiftPermissions(scopedActor, shift),
      history,
    };
  }

  async listDebts(
    user: JwtUser,
    filters: {
      branchId?: string;
      cashierId?: string;
      status?: string;
      mine?: boolean;
    },
  ) {
    const actor = await this.scope.buildActor(user);
    const conditions: SQL[] = [];
    if (filters.mine) {
      conditions.push(eq(schema.cashierDebts.cashierId, actor.id));
    } else {
      if (!actor.isOwner && !actor.roles.includes(BRANCH_SUPERVISOR_ROLE)) {
        throw new ForbiddenException(
          'Solo el supervisor o el owner consultan los adeudos de la sucursal.',
        );
      }
      let branchIds = await this.scope.visibleBranchIds(actor, user);
      if (filters.branchId)
        branchIds = branchIds.filter((id) => id === filters.branchId);
      if (branchIds.length === 0) return [];
      conditions.push(inArray(schema.cashierDebts.branchId, branchIds));
      if (filters.cashierId)
        conditions.push(eq(schema.cashierDebts.cashierId, filters.cashierId));
    }
    if (filters.status)
      conditions.push(eq(schema.cashierDebts.status, filters.status));
    return this.db
      .select({
        id: schema.cashierDebts.id,
        branchId: schema.cashierDebts.branchId,
        branchName: schema.branches.name,
        shiftId: schema.cashierDebts.shiftId,
        cashierId: schema.cashierDebts.cashierId,
        cashierName: schema.users.name,
        amount: schema.cashierDebts.amount,
        status: schema.cashierDebts.status,
        generatedBy: schema.cashierDebts.generatedBy,
        generatedAt: schema.cashierDebts.generatedAt,
        voidedAt: schema.cashierDebts.voidedAt,
      })
      .from(schema.cashierDebts)
      .innerJoin(
        schema.branches,
        eq(schema.cashierDebts.branchId, schema.branches.id),
      )
      .innerJoin(
        schema.users,
        eq(schema.cashierDebts.cashierId, schema.users.id),
      )
      .where(and(...conditions))
      .orderBy(desc(schema.cashierDebts.generatedAt));
  }

  async auditLog(
    user: JwtUser,
    filters: {
      branchId?: string;
      entityType?: string;
      entityId?: string;
      actorId?: string;
      action?: string;
      from?: string;
      to?: string;
    },
  ) {
    const actor = await this.scope.buildActor(user);
    if (!actor.isOwner && !actor.roles.includes(BRANCH_SUPERVISOR_ROLE)) {
      throw new ForbiddenException(
        'Solo el supervisor o el owner consultan la bitácora.',
      );
    }
    let branchIds = await this.scope.visibleBranchIds(actor, user);
    if (filters.branchId)
      branchIds = branchIds.filter((id) => id === filters.branchId);
    return this.audit.query({
      branchIds,
      entityType: filters.entityType,
      entityId: filters.entityId,
      actorId: filters.actorId,
      action: filters.action,
      from: filters.from ? new Date(`${filters.from}T00:00:00`) : undefined,
      to: filters.to ? new Date(`${filters.to}T23:59:59`) : undefined,
      limit: 500,
    });
  }

  async listAssignments(user: JwtUser, businessId: string) {
    this.assertOwnerOf(user, businessId);
    const supervisors = await this.db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.users)
      .where(
        and(
          isNull(schema.users.deletedAt),
          sql`(${schema.users.roles} ? 'branch_supervisor' OR ${schema.users.role} = 'branch_supervisor')`,
          sql`(${schema.users.businessId} = ${businessId} OR EXISTS (SELECT 1 FROM ${schema.adminBusinessAccess} aba WHERE aba.user_id = ${schema.users.id} AND aba.business_id = ${businessId} AND aba.deleted_at IS NULL))`,
        ),
      );
    const rows = supervisors.length
      ? await this.db
          .select({
            userId: schema.supervisorBranchAssignments.userId,
            branchId: schema.supervisorBranchAssignments.branchId,
            branchName: schema.branches.name,
            createdAt: schema.supervisorBranchAssignments.createdAt,
          })
          .from(schema.supervisorBranchAssignments)
          .innerJoin(
            schema.branches,
            eq(schema.supervisorBranchAssignments.branchId, schema.branches.id),
          )
          .where(
            and(
              eq(schema.supervisorBranchAssignments.businessId, businessId),
              isNull(schema.supervisorBranchAssignments.revokedAt),
              inArray(
                schema.supervisorBranchAssignments.userId,
                supervisors.map((s) => s.id),
              ),
            ),
          )
      : [];
    return supervisors.map((supervisor) => ({
      ...supervisor,
      branches: rows
        .filter((row) => row.userId === supervisor.id)
        .map(({ branchId, branchName, createdAt }) => ({
          branchId,
          branchName,
          createdAt,
        })),
    }));
  }

  async replaceAssignments(
    user: JwtUser,
    userId: string,
    businessId: string,
    branchIds: string[],
  ) {
    this.assertOwnerOf(user, businessId);
    const roles = await this.scope.userRoles(userId);
    if (!roles.includes(BRANCH_SUPERVISOR_ROLE)) {
      throw new BadRequestException(
        'El usuario no tiene el rol de supervisor de sucursal.',
      );
    }
    if (branchIds.length) {
      const valid = await this.db
        .select({ id: schema.branches.id })
        .from(schema.branches)
        .where(
          and(
            inArray(schema.branches.id, branchIds),
            eq(schema.branches.businessId, businessId),
            isNull(schema.branches.deletedAt),
          ),
        );
      if (valid.length !== branchIds.length)
        throw new BadRequestException(
          'Alguna sucursal no pertenece al negocio.',
        );
    }
    const actorId = (user.sub ?? user.id)!;
    return this.db.transaction(async (tx) => {
      const current = await tx
        .select()
        .from(schema.supervisorBranchAssignments)
        .where(
          and(
            eq(schema.supervisorBranchAssignments.userId, userId),
            eq(schema.supervisorBranchAssignments.businessId, businessId),
            isNull(schema.supervisorBranchAssignments.revokedAt),
          ),
        );
      const currentIds = current.map((row) => row.branchId);
      const toRevoke = current.filter(
        (row) => !branchIds.includes(row.branchId),
      );
      const toAdd = branchIds.filter((id) => !currentIds.includes(id));
      if (toRevoke.length) {
        await tx
          .update(schema.supervisorBranchAssignments)
          .set({ revokedAt: new Date() })
          .where(
            inArray(
              schema.supervisorBranchAssignments.id,
              toRevoke.map((row) => row.id),
            ),
          );
      }
      if (toAdd.length) {
        await tx.insert(schema.supervisorBranchAssignments).values(
          toAdd.map((branchId) => ({
            businessId,
            userId,
            branchId,
            assignedBy: actorId,
          })),
        );
      }
      if (toRevoke.length || toAdd.length) {
        await this.audit.record(tx, {
          businessId,
          entityType: 'supervisor_assignment',
          entityId: userId,
          action: 'asignacion_actualizada',
          approvalLevel: 'owner',
          actorId,
          actorRole: 'owner',
          before: { branchIds: currentIds },
          after: { branchIds },
          source: 'admin_web',
        });
      }
      return {
        userId,
        businessId,
        branchIds,
        added: toAdd,
        revoked: toRevoke.map((row) => row.branchId),
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * Spec §4.4.3: the close snapshot is never recalculated; reversals inserted after
   * the close are shown apart and produce the adjusted expected cash.
   */
  async adjustedFigures(shift: Shift, countedOverride?: number) {
    const movements = await this.transactions.findByShiftId(shift.id);
    const snapshot = (shift.closeSnapshot ?? null) as any;
    const closedAt = shift.closedAt ? new Date(shift.closedAt) : null;
    const live = await this.shifts.buildShiftReport(shift, {
      closedAt: closedAt ?? new Date(),
      status: shift.status as 'open' | 'closed',
    });
    const adjustedExpected = live.summary.expectedCash;
    const expectedAtClose =
      snapshot?.summary?.expectedCash ?? snapshot?.expectedCash ?? null;
    const postCloseEntries = closedAt
      ? movements
          .filter((m) => m.createdAt && new Date(m.createdAt) > closedAt)
          .map((m) => ({
            id: m.id,
            type: m.type,
            amount: money(m.amount),
            entryKind: m.entryKind,
            reason: m.reason,
            createdAt: m.createdAt,
            cashEffect: cashEffect(m as any),
            reversesTransactionId: m.reversesTransactionId,
            replacesTransactionId: m.replacesTransactionId,
          }))
      : [];
    const counted = countedOverride ?? money(shift.cashDrawerAmount);
    const isClosed = shift.status === 'closed';
    const adjustedDifference = isClosed
      ? roundMoney(counted - adjustedExpected)
      : null;
    return {
      expectedAtClose: expectedAtClose === null ? null : money(expectedAtClose),
      postCloseAdjustment: roundMoney(
        postCloseEntries.reduce((sum, entry) => sum + entry.cashEffect, 0),
      ),
      postCloseEntries,
      adjustedExpected,
      counted,
      originalDifference: snapshot?.summary?.cashDifference ?? null,
      adjustedDifference,
      reconciliationStatus: isClosed
        ? reconciliationStatus(adjustedExpected, counted)
        : null,
      movementTotals: live.movementTotals,
      pendingMovementsCount: live.summary.pendingMovementsCount,
      pendingMovementsAmount: live.summary.pendingMovementsAmount,
    };
  }

  private async afterFinalApproval(
    tx: DbExecutor,
    shift: Shift,
    branch: { businessId: string; name: string },
    actor: ApprovalActor,
    approvedDifference: number,
    user: JwtUser,
    source: 'admin_web' | 'pos',
  ) {
    await this.notifications.resolveActionFor(tx, 'cash_shift', shift.id);
    const debtAmount = debtAmountFor(approvedDifference);
    if (debtAmount > 0) {
      const [debt] = await tx
        .insert(schema.cashierDebts)
        .values({
          businessId: branch.businessId,
          branchId: shift.branchId,
          shiftId: shift.id,
          cashierId: shift.cashierId,
          amount: debtAmount.toFixed(2),
          generatedBy: actor.id,
        })
        .returning();
      await this.audit.record(tx, {
        businessId: branch.businessId,
        branchId: shift.branchId,
        entityType: 'cashier_debt',
        entityId: debt.id,
        action: 'adeudo_generado',
        approvalLevel: 'n2',
        actorId: actor.id,
        actorRole: actor.isOwner ? 'owner' : BRANCH_SUPERVISOR_ROLE,
        after: {
          amount: debtAmount,
          shiftId: shift.id,
          cashierId: shift.cashierId,
        },
        source,
        deviceId: this.deviceId(user),
      });
      await this.notifications.notify(tx, {
        businessId: branch.businessId,
        branchId: shift.branchId,
        recipients: [
          shift.cashierId,
          ...(await this.scope.supervisorsOf(shift.branchId)),
          ...(await this.scope.ownersOf(branch.businessId)),
        ].filter((id) => id !== actor.id),
        type: 'adeudo_generado',
        entityType: 'cashier_debt',
        entityId: debt.id,
        title: `Adeudo de $${debtAmount.toFixed(2)} por faltante en Corte Z · ${branch.name}`,
      });
    }
    await this.notifications.notify(tx, {
      businessId: branch.businessId,
      branchId: shift.branchId,
      recipients: [shift.cashierId, shift.closedBy].filter(
        (id) => id && id !== actor.id,
      ),
      type: 'aprobacion_resuelta',
      entityType: 'cash_shift',
      entityId: shift.id,
      title: `Corte Z aprobado · ${branch.name}`,
      body: `Diferencia final: $${approvedDifference.toFixed(2)}`,
    });
  }

  private async listShiftItems(
    actor: ApprovalActor,
    user: JwtUser,
    branchIds: string[],
    statuses: string[],
    from: Date | null,
    to: Date | null,
  ) {
    const rows = await this.db
      .select({
        shift: schema.cashShifts,
        branchName: schema.branches.name,
        businessId: schema.branches.businessId,
        cashierName: schema.users.name,
      })
      .from(schema.cashShifts)
      .innerJoin(
        schema.branches,
        eq(schema.cashShifts.branchId, schema.branches.id),
      )
      .leftJoin(schema.users, eq(schema.cashShifts.cashierId, schema.users.id))
      .where(
        and(
          inArray(schema.cashShifts.branchId, branchIds),
          inArray(schema.cashShifts.reviewStatus, statuses),
          from ? gte(schema.cashShifts.closedAt, from) : undefined,
          to ? lte(schema.cashShifts.closedAt, to) : undefined,
        ),
      )
      .orderBy(desc(schema.cashShifts.closedAt))
      .limit(300);
    return rows.map(({ shift, branchName, businessId, cashierName }) => {
      const scoped = this.scope.actorForBusiness(actor, user, businessId);
      const snapshot = (shift.closeSnapshot ?? null) as any;
      const permissions = this.shiftPermissions(scoped, shift);
      return {
        id: shift.id,
        branchId: shift.branchId,
        branchName,
        cashierId: shift.cashierId,
        cashierName,
        closedBy: shift.closedBy,
        closedAt: shift.closedAt,
        reviewStatus: shift.reviewStatus,
        n1ResolverRole: shift.n1ResolverRole,
        expectedCash: snapshot?.summary?.expectedCash ?? null,
        counted: money(shift.cashDrawerAmount),
        cashDifference: snapshot?.summary?.cashDifference ?? null,
        recountCount: shift.recountCount,
        closedOffline: shift.closedOffline,
        openBlocking: isOpeningBlockedBy(shift),
        version: shift.version,
        level: this.levelForSafe(shift.reviewStatus),
        canAct: permissions.canApprove || permissions.canReject,
        permissions,
      };
    });
  }

  private async listMovementItems(
    actor: ApprovalActor,
    user: JwtUser,
    branchIds: string[],
    statuses: string[],
    from: Date | null,
    to: Date | null,
  ) {
    const rows = await this.db
      .select({
        movement: schema.cashTransactions,
        branchId: schema.cashShifts.branchId,
        shiftReviewStatus: schema.cashShifts.reviewStatus,
        shiftStatus: schema.cashShifts.status,
        branchName: schema.branches.name,
        businessId: schema.branches.businessId,
        authorName: schema.users.name,
        authorRole: schema.users.role,
        authorRoles: schema.users.roles,
      })
      .from(schema.cashTransactions)
      .innerJoin(
        schema.cashShifts,
        eq(schema.cashTransactions.shiftId, schema.cashShifts.id),
      )
      .innerJoin(
        schema.branches,
        eq(schema.cashShifts.branchId, schema.branches.id),
      )
      .leftJoin(
        schema.users,
        eq(schema.cashTransactions.createdBy, schema.users.id),
      )
      .where(
        and(
          inArray(schema.cashShifts.branchId, branchIds),
          eq(schema.cashTransactions.entryKind, 'movimiento'),
          inArray(schema.cashTransactions.approvalStatus, statuses),
          from ? gte(schema.cashTransactions.createdAt, from) : undefined,
          to ? lte(schema.cashTransactions.createdAt, to) : undefined,
        ),
      )
      .orderBy(desc(schema.cashTransactions.createdAt))
      .limit(300);
    return rows.map((row) => {
      const scoped = this.scope.actorForBusiness(actor, user, row.businessId);
      const n1ResolverRole = row.movement.createdBy
        ? n1ResolverRoleFor(
            normalizeAuthorRoles(row.authorRoles, row.authorRole),
          )
        : BRANCH_OPERATOR_ROLE;
      let canAct = false;
      try {
        assertCanResolveN1(scoped, {
          branchId: row.branchId,
          authorId: row.movement.createdBy,
          n1ResolverRole,
        });
        nextMovementStatus(row.movement.approvalStatus, 'approve');
        canAct = true;
      } catch {
        canAct = false;
      }
      let canCorrect = false;
      try {
        assertCanCancelOrAdjust(scoped, row.branchId);
        assertShiftLedgerOpen(row.shiftReviewStatus);
        canCorrect = true;
      } catch {
        canCorrect = false;
      }
      return {
        id: row.movement.id,
        shiftId: row.movement.shiftId,
        branchId: row.branchId,
        branchName: row.branchName,
        type: row.movement.type,
        amount: money(row.movement.amount),
        category: row.movement.category,
        reason: row.movement.reason,
        createdAt: row.movement.createdAt,
        createdBy: row.movement.createdBy,
        authorName: row.authorName,
        approvalStatus: row.movement.approvalStatus,
        n1ResolverRole,
        shiftStatus: row.shiftStatus,
        shiftReviewStatus: row.shiftReviewStatus,
        version: row.movement.version,
        canAct,
        canCorrect,
      };
    });
  }

  private shiftPermissions(actor: ApprovalActor, shift: Shift) {
    const level = this.levelForSafe(shift.reviewStatus);
    const can = (fn: () => void) => {
      try {
        fn();
        return true;
      } catch {
        return false;
      }
    };
    const canLevel =
      level === 'n1'
        ? can(() => assertCanResolveN1(actor, this.n1Context(shift)))
        : level === 'n2'
          ? can(() => assertCanResolveN2(actor, this.n2Context(shift)))
          : false;
    return {
      level,
      canApprove:
        canLevel &&
        ['pendiente_n1', 'pendiente_n2'].includes(shift.reviewStatus),
      canReject:
        canLevel &&
        ['pendiente_n1', 'pendiente_n2'].includes(shift.reviewStatus),
      canAdjust:
        level === 'n2' &&
        can(() => assertCanResolveN2(actor, this.n2Context(shift))),
      canReopen:
        actor.isOwner &&
        ['aprobado', 'aprobado_con_ajuste'].includes(shift.reviewStatus),
      canUnblockOpening: actor.isOwner && isOpeningBlockedBy(shift),
      canCorrectMovements:
        can(() => assertCanCancelOrAdjust(actor, shift.branchId)) &&
        can(() => assertShiftLedgerOpen(shift.reviewStatus)),
    };
  }

  private levelFor(status: string): 'n1' | 'n2' {
    const level = this.levelForSafe(status);
    if (level !== 'n1' && level !== 'n2') {
      throw new ConflictException(
        `El Corte Z en estado "${status}" no está pendiente de aprobación.`,
      );
    }
    return level;
  }

  private levelForSafe(status: string): 'n1' | 'n2' | null {
    if (status === 'pendiente_n1' || status === 'rechazado_n1') return 'n1';
    if (status === 'pendiente_n2' || status === 'rechazado_n2') return 'n2';
    return null;
  }

  private authorizeShiftLevel(
    actor: ApprovalActor,
    shift: Shift,
    level: 'n1' | 'n2',
  ) {
    if (level === 'n1')
      guard(() => assertCanResolveN1(actor, this.n1Context(shift)));
    else guard(() => assertCanResolveN2(actor, this.n2Context(shift)));
  }

  private n1Context(shift: Shift) {
    return {
      branchId: shift.branchId,
      authorId: shift.closedBy ?? shift.cashierId,
      n1ResolverRole: shift.n1ResolverRole ?? BRANCH_OPERATOR_ROLE,
    };
  }

  private n2Context(shift: Shift) {
    return {
      branchId: shift.branchId,
      closedBy: shift.closedBy ?? shift.cashierId,
      operatorReviewedBy: shift.operatorReviewedBy,
    };
  }

  private async loadShiftForAction(shiftId: string, user: JwtUser) {
    const shift = await this.getShift(shiftId);
    if (shift.status !== 'closed')
      throw new ConflictException('El turno sigue abierto; no tiene Corte Z.');
    const branch = await this.scope.getBranch(shift.branchId);
    const actor = this.scope.actorForBusiness(
      await this.scope.buildActor(user),
      user,
      branch.businessId,
    );
    return { shift, actor, branch };
  }

  private async loadMovement(
    id: string,
    user: JwtUser,
    opts: { forView?: boolean } = {},
  ) {
    const movement = await this.transactions.findById(id);
    if (!movement) throw new NotFoundException('Movimiento no encontrado.');
    if ((movement.entryKind ?? 'movimiento') !== 'movimiento') {
      throw new ConflictException(
        'Solo se aprueban o corrigen movimientos originales, no reversos ni ajustes.',
      );
    }
    const shift = await this.getShift(movement.shiftId);
    const branch = await this.scope.getBranch(shift.branchId);
    const actor = this.scope.actorForBusiness(
      await this.scope.buildActor(user),
      user,
      branch.businessId,
    );
    if (opts.forView) await this.assertCanView(actor, user, shift.branchId);
    return { movement, shift, actor, branch };
  }

  private async getShift(id: string) {
    const [shift] = await this.db
      .select()
      .from(schema.cashShifts)
      .where(eq(schema.cashShifts.id, id))
      .limit(1);
    if (!shift) throw new NotFoundException('Turno no encontrado.');
    return shift;
  }

  private async assertCanView(
    actor: ApprovalActor,
    user: JwtUser,
    branchId: string,
  ) {
    const visible = await this.scope.visibleBranchIds(actor, user);
    if (!visible.includes(branchId))
      throw new ForbiddenException('No tienes acceso a esta sucursal.');
  }

  private assertOwnerOf(user: JwtUser, businessId: string) {
    const roles = (user.roles ?? [user.role]).filter(Boolean) as string[];
    if (!roles.includes('owner'))
      throw new ForbiddenException('Solo el owner administra supervisores.');
    const ids = [
      user.businessId,
      ...(user.businessAccess ?? []).map((a) => a.businessId),
    ].filter(Boolean);
    if (ids.length && !ids.includes(businessId))
      throw new ForbiddenException('No tienes acceso a este negocio.');
  }

  private assertVersion(current: number | null | undefined, expected: number) {
    if ((current ?? 1) !== expected) {
      throw new ConflictException(
        'Otra persona modificó este registro; recarga para ver su estado actual.',
      );
    }
  }

  /** Compare-and-set on version so two approvers cannot both win (CZ-09). */
  private async casShift(
    tx: DbExecutor,
    shift: Shift,
    updates: Partial<Shift>,
  ) {
    const rows = await tx
      .update(schema.cashShifts)
      .set({ ...updates, version: (shift.version ?? 1) + 1 })
      .where(
        and(
          eq(schema.cashShifts.id, shift.id),
          eq(schema.cashShifts.version, shift.version ?? 1),
        ),
      )
      .returning();
    if (rows.length === 0) {
      throw new ConflictException(
        'Otra persona modificó este Corte Z; recarga para ver su estado actual.',
      );
    }
    return rows[0];
  }

  private async casMovement(
    tx: DbExecutor,
    movement: Movement,
    updates: Partial<Movement>,
  ) {
    const rows = await tx
      .update(schema.cashTransactions)
      .set({ ...updates, version: (movement.version ?? 1) + 1 })
      .where(
        and(
          eq(schema.cashTransactions.id, movement.id),
          eq(schema.cashTransactions.version, movement.version ?? 1),
        ),
      )
      .returning();
    if (rows.length === 0) {
      throw new ConflictException(
        'Otra persona modificó este movimiento; recarga para ver su estado actual.',
      );
    }
    return rows[0];
  }

  /** S-4: compensating entry dated now, attributed to the original's shift (§4.4.2). */
  private async insertReversal(
    tx: DbExecutor,
    movement: Movement,
    shift: Shift,
    actorId: string,
    reason: string,
  ) {
    const reversal = await this.transactions.create(
      {
        shiftId: movement.shiftId,
        type: movement.type,
        amount: movement.amount,
        reason: `Reverso: ${reason}`,
        createdAt: new Date(),
        createdBy: actorId,
        category: movement.category,
        entryKind: 'reverso',
        reversesTransactionId: movement.id,
        approvalStatus: 'no_aplica',
      },
      tx,
    );
    if (shift.status === 'open') {
      await this.bumpDrawerCache(
        tx,
        shift.id,
        cashEffect({
          type: movement.type,
          amount: movement.amount,
          entryKind: 'reverso',
        }),
      );
    }
    return reversal;
  }

  /** Keeps the legacy running cache of an open shift in step with the ledger (R-15). */
  private async bumpDrawerCache(
    tx: DbExecutor,
    shiftId: string,
    delta: number,
  ) {
    await tx
      .update(schema.cashShifts)
      .set({
        cashDrawerAmount: sql`${schema.cashShifts.cashDrawerAmount} + ${delta.toFixed(2)}`,
      })
      .where(
        and(
          eq(schema.cashShifts.id, shiftId),
          eq(schema.cashShifts.status, 'open'),
        ),
      );
  }

  private async recordShift(
    tx: DbExecutor,
    shift: Shift,
    businessId: string,
    actor: ApprovalActor,
    user: JwtUser,
    action: string,
    level: 'n1' | 'n2' | 'owner',
    reason: string | undefined,
    source: 'admin_web' | 'pos',
    values: { before: unknown; after: unknown },
  ) {
    await this.audit.record(tx, {
      businessId,
      branchId: shift.branchId,
      entityType: 'cash_shift',
      entityId: shift.id,
      action,
      approvalLevel: level,
      actorId: actor.id,
      actorRole:
        level === 'owner' || (level === 'n2' && actor.isOwner)
          ? 'owner'
          : level === 'n2'
            ? BRANCH_SUPERVISOR_ROLE
            : (shift.n1ResolverRole ?? BRANCH_OPERATOR_ROLE),
      reason: reason?.trim() || null,
      before: values.before,
      after: values.after,
      source,
      deviceId: this.deviceId(user),
    });
  }

  private async n2Recipients(branchId: string, businessId: string) {
    return [
      ...(await this.scope.supervisorsOf(branchId)),
      ...(await this.scope.ownersOf(businessId)),
    ];
  }

  private async userNames(ids: Array<string | null | undefined>) {
    const unique = Array.from(
      new Set(ids.filter((id): id is string => Boolean(id))),
    );
    if (!unique.length) return {} as Record<string, string>;
    const rows = await this.db
      .select({ id: schema.users.id, name: schema.users.name })
      .from(schema.users)
      .where(inArray(schema.users.id, unique));
    return Object.fromEntries(rows.map((row) => [row.id, row.name])) as Record<
      string,
      string
    >;
  }

  private deviceId(user: JwtUser & { deviceId?: string }) {
    return (user as any)?.deviceId ?? null;
  }
}

function normalizeAuthorRoles(roles: unknown, role: string | null) {
  const source =
    Array.isArray(roles) && roles.length ? roles : role ? [role] : [];
  return source.map((r: string) =>
    r === 'encargado' || r === 'responsable' ? BRANCH_OPERATOR_ROLE : r,
  );
}
