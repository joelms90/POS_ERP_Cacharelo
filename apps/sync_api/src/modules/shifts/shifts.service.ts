import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
  Optional,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ShiftsRepository } from './repositories/shifts.repository';
import { TransactionsRepository } from './repositories/transactions.repository';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { RecountShiftDto } from './dto/recount-shift.dto';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';
import { eq, and, gte, lte, isNull, gt, asc } from 'drizzle-orm';
import type { DbExecutor } from '../audit/db-executor';
import { AuditLogService } from '../audit/audit-log.service';
import { NotificationsService } from '../audit/notifications.service';
import { SupervisorScopeService } from '../audit/supervisor-scope.service';
import { BRANCH_OPERATOR_ROLE, BRANCH_SUPERVISOR_ROLE } from '../auth/roles';
import {
  ApprovalRuleError,
  cashEffect,
  groupMovements,
  isOpeningBlockedBy,
  n1ResolverRoleFor,
  nextShiftStatus,
  normalizeRoles,
  reconciliationStatus,
} from '../supervision/cash-approval.rules';
import { isOpenBlockEnforced } from '../supervision/cash-approval.config';

/** Authenticated operator acting on a shift (from the JWT). */
export interface ShiftActor {
  id: string;
  roles?: string[];
  role?: string;
  deviceId?: string | null;
}

export const OPEN_BLOCKED_MESSAGE =
  'El Corte Z anterior de esta sucursal debe ser aprobado (nivel 1) antes de abrir un nuevo turno.';

@Injectable()
export class ShiftsService {
  constructor(
    private readonly shiftsRepository: ShiftsRepository,
    private readonly transactionsRepository: TransactionsRepository,
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    // Spec 019 collaborators. Global in the app; optional so isolated unit tests
    // can exercise the cash logic without the audit/notification tables.
    @Optional() private readonly audit?: AuditLogService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly scope?: SupervisorScopeService,
  ) {}

  async openShift(openShiftDto: OpenShiftDto & { branchId: string; cashierId: string }) {
    const { branchId, cashierId, initialFloat } = openShiftDto;

    // Prevent opening a shift if one is already open for that cashier & branch
    const activeShift = await this.shiftsRepository.findActiveShift(branchId, cashierId);
    if (activeShift) {
      throw new ConflictException('A cash shift is already active for this cashier and branch.');
    }

    // Find the latest closed shift for this branch to avoid overlapping
    const lastClosedShift = await this.shiftsRepository.findLastClosedShift(branchId);

    // Spec 019 D-4 / C-2 / P-2: the previous Corte Z must have its N1 approval.
    if (isOpenBlockEnforced() && isOpeningBlockedBy(lastClosedShift)) {
      await this.recordOpeningBlocked(lastClosedShift!, cashierId);
      throw new ConflictException({
        statusCode: 409,
        code: 'OPENING_BLOCKED_PENDING_CORTE',
        message: OPEN_BLOCKED_MESSAGE,
        blockingShiftId: lastClosedShift!.id,
        reviewStatus: lastClosedShift!.reviewStatus,
      });
    }

    // Check if another shift is currently active for this branch
    const otherActiveShift = await this.shiftsRepository.findActiveShift(branchId);
    if (otherActiveShift) {
      // If the other shift is older than 24 hours (e.g. from a previous date), auto-close it
      // so morning shift opening is not permanently blocked by an unclosed historical shift.
      // Spec 019 D-11: auto-closed shifts stay out of the approval chain (review_status no_aplica).
      const isStale = (Date.now() - new Date(otherActiveShift.openedAt).getTime()) > 24 * 60 * 60 * 1000;
      if (isStale) {
        await this.shiftsRepository.update(otherActiveShift.id, {
          status: 'closed',
          closedAt: new Date(),
          closeNotes: 'Cierre automático por turno previo no cerrado (>24h)',
        });
      } else {
        throw new ConflictException('Another cash shift is active for this branch. Close it before opening a new one.');
      }
    }

    const minTimestamp = lastClosedShift?.closedAt
      ? new Date(lastClosedShift.closedAt)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);

    // If there were sales made today before the register was officially opened,
    // start openedAt from the earliest unassigned payment so they are included in Corte X/Z
    const unassignedPayments = await this.db
      .select({ createdAt: schema.payments.createdAt })
      .from(schema.payments)
      .innerJoin(schema.orders, eq(schema.payments.orderId, schema.orders.id))
      .where(
        and(
          eq(schema.orders.branchId, branchId),
          eq(schema.orders.state, 'closed'),
          isNull(schema.orders.deletedAt),
          gt(schema.payments.createdAt, minTimestamp),
        ),
      )
      .orderBy(asc(schema.payments.createdAt))
      .limit(1);

    const openedAt =
      unassignedPayments.length > 0 && unassignedPayments[0].createdAt < new Date()
        ? unassignedPayments[0].createdAt
        : new Date();

    return this.shiftsRepository.create({
      branchId,
      cashierId,
      initialFloat,
      cashDrawerAmount: initialFloat,
      status: 'open',
      openedAt,
    });
  }

  async getActiveShift(branchId: string, cashierId: string) {
    const shift = await this.shiftsRepository.findActiveShift(branchId, cashierId);
    if (!shift) {
      throw new NotFoundException('No active cash shift found for this cashier and branch.');
    }
    return shift;
  }

  async getShiftById(id: string) {
    const shift = await this.shiftsRepository.findById(id);
    if (!shift) {
      throw new NotFoundException(`Cash shift with ID ${id} not found.`);
    }
    return shift;
  }

  /**
   * Generate a live Corte X (open shift) or final Corte Z (closed shift).
   * Both reports use the same payment and cash-movement calculations as closeShift,
   * keeping cash/card totals consistent across the POS and branch dashboard.
   */
  async getCorteReport(shiftId: string, corte: 'x' | 'z') {
    const shift = await this.getShiftById(shiftId);
    if (corte === 'z' && shift.status !== 'closed') {
      throw new ConflictException('El Corte Z solo está disponible para turnos cerrados.');
    }

    const closedAt = shift.closedAt ? new Date(shift.closedAt) : new Date();
    const actualCash = shift.status === 'closed' ? this.parseMoney(shift.cashDrawerAmount) : undefined;
    const report = await this.buildShiftReport(shift, {
      closedAt,
      actualCash,
      denominationCounts: (shift.denominationCounts ?? undefined) as Record<string, number> | undefined,
      closeNotes: shift.closeNotes ?? undefined,
      status: shift.status as 'open' | 'closed',
    });
    return { ...report, review: this.reviewInfo(shift) };
  }

  /**
   * Record a manual cash-in / cash-out as an entry of the append-only cash ledger
   * (spec 019, S-4). It counts towards expected cash immediately and waits for N1.
   */
  async createTransaction(shiftId: string, createTransactionDto: CreateTransactionDto, actor?: ShiftActor) {
    const { type, amount, reason, category, clientUuid } = createTransactionDto;

    if (clientUuid) {
      const existing = await this.transactionsRepository.findByClientUuid(clientUuid);
      if (existing) {
        if (existing.shiftId !== shiftId) {
          throw new ConflictException('El identificador del movimiento ya se usó en otro turno.');
        }
        const currentShift = await this.shiftsRepository.findById(shiftId);
        return { transaction: existing, shift: currentShift, duplicate: true };
      }
    }

    const shift = await this.shiftsRepository.findById(shiftId);
    if (!shift) {
      throw new NotFoundException(`Cash shift with ID ${shiftId} not found.`);
    }
    if (shift.status !== 'open') {
      throw new ConflictException('Cannot add transactions to a closed shift.');
    }

    const txAmount = parseFloat(amount);
    // MV-05: a new cash-out may not push expected cash below zero (reversals are never blocked).
    if (type === 'cash-out') {
      const live = await this.buildShiftReport(shift, { closedAt: new Date() });
      if (this.roundMoney(live.summary.expectedCash - txAmount) < 0) {
        throw new UnprocessableEntityException(
          `El retiro de $${txAmount.toFixed(2)} deja el efectivo esperado en negativo (disponible: $${live.summary.expectedCash.toFixed(2)}).`,
        );
      }
    }

    const authorId = actor?.id ?? shift.cashierId;
    const authorRoles = normalizeRoles(actor?.roles, actor?.role);
    const n1ResolverRole = n1ResolverRoleFor(authorRoles);

    return this.inTransaction(async (exec) => {
      const transaction = await this.transactionsRepository.create(
        {
          shiftId,
          type,
          amount,
          reason,
          createdAt: new Date(),
          createdBy: authorId,
          category: category ?? null,
          clientUuid: clientUuid ?? null,
          entryKind: 'movimiento',
          approvalStatus: 'pendiente_n1',
          deviceId: actor?.deviceId ?? null,
        },
        exec,
      );

      // cash_drawer_amount is kept as a running cache for existing clients; expected
      // cash is always derived from the ledger (spec 019 R-15).
      const currentDrawer = parseFloat(shift.cashDrawerAmount);
      let newDrawerAmount = currentDrawer;
      if (type === 'cash-in') {
        newDrawerAmount += txAmount;
      } else if (type === 'cash-out') {
        newDrawerAmount -= txAmount;
      }

      const updatedShift = await this.shiftsRepository.update(
        shiftId,
        { cashDrawerAmount: newDrawerAmount.toFixed(2) },
        exec,
      );

      if (this.audit && this.scope && transaction) {
        const branch = await this.scope.getBranch(shift.branchId);
        await this.audit.record(exec, {
          businessId: branch.businessId,
          branchId: shift.branchId,
          entityType: 'cash_transaction',
          entityId: transaction.id,
          action: 'movimiento_creado',
          actorId: authorId,
          actorRole: authorRoles[0] ?? null,
          after: { type, amount, category: category ?? null, reason, approvalStatus: 'pendiente_n1', n1ResolverRole },
          source: 'pos',
          deviceId: actor?.deviceId ?? null,
        });
        await this.notifications?.notify(exec, {
          businessId: branch.businessId,
          branchId: shift.branchId,
          recipients: await this.n1Recipients(shift.branchId, branch.businessId, n1ResolverRole),
          type: 'aprobacion_pendiente',
          requiresAction: true,
          entityType: 'cash_transaction',
          entityId: transaction.id,
          title: `${type === 'cash-in' ? 'Ingreso' : 'Egreso'} de $${txAmount.toFixed(2)} por aprobar · ${branch.name}`,
          body: reason,
        });
      }

      return {
        transaction,
        shift: updatedShift,
      };
    });
  }

  async closeShift(shiftId: string, closeShiftDto: CloseShiftDto, actor?: ShiftActor) {
    const { actualAmount, closedAt, denominationCounts, closeNotes, clientUuid, closedOffline, localExpectedCash } =
      closeShiftDto;
    const closedAtDate = closedAt ? new Date(closedAt) : new Date();

    const shift = await this.shiftsRepository.findById(shiftId);
    if (!shift) {
      throw new NotFoundException(`Cash shift with ID ${shiftId} not found.`);
    }
    if (shift.status !== 'open') {
      // Idempotent retry of the same close (e.g. offline sync, D-5).
      if (clientUuid && shift.clientUuid === clientUuid) {
        const report = await this.getCorteReport(shiftId, 'z');
        return { shift, reconciliation: this.reconciliationFrom(report), report, duplicate: true };
      }
      throw new ConflictException('This cash shift is already closed.');
    }

    const finalActual = parseFloat(actualAmount);
    const report = await this.buildShiftReport(shift, {
      closedAt: closedAtDate,
      actualCash: finalActual,
      denominationCounts,
      closeNotes,
      status: 'closed',
    });

    const closedBy = actor?.id ?? shift.cashierId;
    const authorRoles = normalizeRoles(actor?.roles, actor?.role);
    // S-3: a corte closed by the OIS is resolved at N1 by the assigned supervisor.
    const n1ResolverRole = n1ResolverRoleFor(authorRoles);

    return this.inTransaction(async (exec) => {
      const closedShift = await this.shiftsRepository.update(
        shiftId,
        {
          status: 'closed',
          closedAt: closedAtDate,
          cashDrawerAmount: finalActual.toFixed(2), // store counted cash as final drawer amount
          denominationCounts: denominationCounts ?? null,
          closeNotes: closeNotes?.trim() || null,
          closeSnapshot: report,
          reviewStatus: 'pendiente_n1',
          closedBy,
          n1ResolverRole,
          clientUuid: clientUuid ?? null,
          closedOffline: closedOffline ?? false,
          localExpectedCash: localExpectedCash ?? null,
        },
        exec,
      );

      if (this.audit && this.scope) {
        const branch = await this.scope.getBranch(shift.branchId);
        await this.audit.record(exec, {
          businessId: branch.businessId,
          branchId: shift.branchId,
          entityType: 'cash_shift',
          entityId: shiftId,
          action: 'corte_z_cerrado',
          actorId: closedBy,
          actorRole: authorRoles[0] ?? null,
          after: {
            reviewStatus: 'pendiente_n1',
            n1ResolverRole,
            expectedCash: report.summary.expectedCash,
            actualCash: report.summary.actualCash,
            cashDifference: report.summary.cashDifference,
            closedOffline: closedOffline ?? false,
            localExpectedCash: localExpectedCash ?? null,
          },
          source: 'pos',
          deviceId: actor?.deviceId ?? null,
        });
        await this.notifications?.notify(exec, {
          businessId: branch.businessId,
          branchId: shift.branchId,
          recipients: await this.n1Recipients(shift.branchId, branch.businessId, n1ResolverRole),
          type: 'aprobacion_pendiente',
          requiresAction: true,
          entityType: 'cash_shift',
          entityId: shiftId,
          title: `Corte Z por aprobar (nivel 1) · ${branch.name}`,
          body: `Diferencia: $${(report.summary.cashDifference ?? 0).toFixed(2)}`,
        });
      }

      return {
        shift: closedShift,
        reconciliation: this.reconciliationFrom(report),
        report,
      };
    });
  }

  /**
   * New physical count after a rejection (spec 019 CZ-02 / CZ-04, S-5):
   * rechazado_n1 → pendiente_n1 (by the corte author); rechazado_n2 → pendiente_n2
   * (by the cashier of the shift or an OIS of the branch). close_snapshot stays intact.
   */
  async recountShift(shiftId: string, dto: RecountShiftDto, actor: ShiftActor & { branchId?: string | null }) {
    const shift = await this.getShiftById(shiftId);
    if (actor.branchId && shift.branchId !== actor.branchId) {
      throw new ForbiddenException('Solo puedes recontar cortes de tu sucursal.');
    }
    const roles = normalizeRoles(actor.roles, actor.role);
    const author = shift.closedBy ?? shift.cashierId;
    if (shift.reviewStatus === 'rechazado_n1' && actor.id !== author) {
      throw new ForbiddenException('El reconteo tras un rechazo de nivel 1 lo registra quien hizo el Corte Z.');
    }
    if (
      shift.reviewStatus === 'rechazado_n2' &&
      actor.id !== shift.cashierId &&
      !(roles.includes(BRANCH_OPERATOR_ROLE) && actor.branchId === shift.branchId)
    ) {
      throw new ForbiddenException('El reconteo lo registra el cajero del turno o un operador de la sucursal.');
    }

    let next;
    try {
      next = nextShiftStatus(shift.reviewStatus, 'recount');
    } catch (error) {
      if (error instanceof ApprovalRuleError) throw new ConflictException(error.message);
      throw error;
    }

    const counted = parseFloat(dto.actualAmount);
    return this.inTransaction(async (exec) => {
      const updated = await this.shiftsRepository.update(
        shiftId,
        {
          reviewStatus: next,
          cashDrawerAmount: counted.toFixed(2),
          denominationCounts: dto.denominationCounts ?? shift.denominationCounts ?? null,
          recountCount: (shift.recountCount ?? 0) + 1,
          version: (shift.version ?? 1) + 1,
        },
        exec,
      );
      if (this.audit && this.scope) {
        const branch = await this.scope.getBranch(shift.branchId);
        await this.audit.record(exec, {
          businessId: branch.businessId,
          branchId: shift.branchId,
          entityType: 'cash_shift',
          entityId: shiftId,
          action: 'corte_z_reconteo',
          actorId: actor.id,
          actorRole: roles[0] ?? null,
          reason: dto.notes?.trim() || null,
          before: {
            reviewStatus: shift.reviewStatus,
            actualCash: this.parseMoney(shift.cashDrawerAmount),
            denominationCounts: shift.denominationCounts ?? null,
          },
          after: { reviewStatus: next, actualCash: counted, denominationCounts: dto.denominationCounts ?? null },
          source: 'pos',
          deviceId: actor.deviceId ?? null,
        });
        const recipients =
          next === 'pendiente_n2'
            ? [
                ...(await this.scope.supervisorsOf(shift.branchId)),
                ...(await this.scope.ownersOf(branch.businessId)),
              ]
            : await this.n1Recipients(shift.branchId, branch.businessId, shift.n1ResolverRole ?? BRANCH_OPERATOR_ROLE);
        await this.notifications?.notify(exec, {
          businessId: branch.businessId,
          branchId: shift.branchId,
          recipients,
          type: 'aprobacion_pendiente',
          requiresAction: true,
          entityType: 'cash_shift',
          entityId: shiftId,
          title: `Reconteo de Corte Z por aprobar (${next === 'pendiente_n2' ? 'nivel 2' : 'nivel 1'}) · ${branch.name}`,
          body: `Nuevo conteo: $${counted.toFixed(2)}`,
        });
      }
      return updated;
    });
  }

  /** Expected cash including reversals inserted after the close (spec 019 §4.4.3). */
  async buildShiftReport(
    shift: any,
    options: {
      closedAt: Date;
      actualCash?: number;
      denominationCounts?: Record<string, number>;
      closeNotes?: string;
      status?: 'open' | 'closed';
    },
  ) {
    const txs = await this.transactionsRepository.findByShiftId(shift.id);
    let manualCashIn = 0;
    let manualCashOut = 0;
    for (const t of txs) {
      const effect = cashEffect(t as any);
      if (t.type === 'cash-in') manualCashIn += effect;
      if (t.type === 'cash-out') manualCashOut -= effect;
    }
    const movementGroups = groupMovements(txs as any);

    const paymentsList = await this.db
      .select({
        paymentMethod: schema.payments.paymentMethod,
        amount: schema.payments.amount,
      })
      .from(schema.payments)
      .innerJoin(schema.orders, eq(schema.payments.orderId, schema.orders.id))
      .where(
        and(
          eq(schema.orders.branchId, shift.branchId),
          eq(schema.orders.state, 'closed'),
          isNull(schema.orders.deletedAt),
          gte(schema.payments.createdAt, new Date(shift.openedAt)),
          lte(schema.payments.createdAt, options.closedAt),
        ),
      );

    const methods = new Map<string, { paymentMethod: string; total: number; count: number }>();
    for (const payment of paymentsList) {
      const method = payment.paymentMethod || 'other';
      const row = methods.get(method) ?? { paymentMethod: method, total: 0, count: 0 };
      row.total += this.parseMoney(payment.amount);
      row.count += 1;
      methods.set(method, row);
    }

    const salesByPaymentMethod = Array.from(methods.values()).map((row) => ({
      paymentMethod: row.paymentMethod,
      total: this.roundMoney(row.total),
      count: row.count,
    }));
    const cashSales = salesByPaymentMethod
      .filter((row) => row.paymentMethod === 'cash')
      .reduce((sum, row) => sum + row.total, 0);
    const cardSales = salesByPaymentMethod
      .filter((row) => row.paymentMethod === 'card')
      .reduce((sum, row) => sum + row.total, 0);
    const totalSales = salesByPaymentMethod.reduce((sum, row) => sum + row.total, 0);
    const otherSales = totalSales - cashSales - cardSales;
    const initialFloat = this.parseMoney(shift.initialFloat);
    const expectedCash = initialFloat + cashSales + manualCashIn - manualCashOut;
    const actualCash = options.actualCash;
    const cashDifference =
      actualCash === undefined ? null : this.roundMoney(actualCash - expectedCash);

    let cashierName: string | null = null;
    let branchName: string | null = null;
    try {
      if (shift.cashierId) {
        const [u] = await this.db
          .select({ name: schema.users.name })
          .from(schema.users)
          .where(eq(schema.users.id, shift.cashierId))
          .limit(1);
        cashierName = u?.name ?? null;
      }
      if (shift.branchId) {
        const [b] = await this.db
          .select({ name: schema.branches.name })
          .from(schema.branches)
          .where(eq(schema.branches.id, shift.branchId))
          .limit(1);
        branchName = b?.name ?? null;
      }
    } catch (_) {
      // Non-critical fallback
    }

    const isShiftClosed = (options.status ?? shift.status) === 'closed';

    return {
      shiftInfo: {
        id: shift.id,
        cashierId: shift.cashierId,
        cashierName,
        branchId: shift.branchId,
        branchName,
        status: options.status ?? shift.status,
        openedAt: shift.openedAt,
        closedAt: isShiftClosed ? (shift.closedAt || options.closedAt) : null,
      },
      summary: {
        initialFloat: this.roundMoney(initialFloat),
        cashSales: this.roundMoney(cashSales),
        cardSales: this.roundMoney(cardSales),
        otherSales: this.roundMoney(otherSales),
        totalSales: this.roundMoney(totalSales),
        manualCashIn: this.roundMoney(manualCashIn),
        manualCashOut: this.roundMoney(manualCashOut),
        expectedCash: this.roundMoney(expectedCash),
        actualCash: actualCash === undefined ? null : this.roundMoney(actualCash),
        cashDifference,
        pendingMovementsAmount: movementGroups.totals.pending,
        pendingMovementsCount: movementGroups.pendientes.length,
        reconciliationStatus:
          actualCash === undefined ? null : reconciliationStatus(this.roundMoney(expectedCash), actualCash),
      },
      salesByPaymentMethod,
      cashMovements: txs.map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: this.parseMoney(t.amount),
        reason: t.reason,
        createdAt: t.createdAt,
        category: t.category ?? null,
        entryKind: t.entryKind ?? 'movimiento',
        approvalStatus: t.approvalStatus ?? 'aprobado_historico',
        reversesTransactionId: t.reversesTransactionId ?? null,
        replacesTransactionId: t.replacesTransactionId ?? null,
        createdBy: t.createdBy ?? null,
        version: t.version ?? 1,
        cashEffect: cashEffect(t),
      })),
      movementTotals: movementGroups.totals,
      denominationCounts: options.denominationCounts ?? null,
      closeNotes: options.closeNotes?.trim() || null,
      generatedAt: new Date(),
    };
  }

  private reviewInfo(shift: any) {
    return {
      reviewStatus: shift.reviewStatus ?? 'no_aplica',
      n1ResolverRole: shift.n1ResolverRole ?? null,
      closedBy: shift.closedBy ?? null,
      operatorReviewedBy: shift.operatorReviewedBy ?? null,
      reviewedBy: shift.reviewedBy ?? null,
      reviewNotes: shift.reviewNotes ?? null,
      operatorNotes: shift.operatorNotes ?? null,
      recountCount: shift.recountCount ?? 0,
      approvedDifference: shift.approvedDifference != null ? this.parseMoney(shift.approvedDifference) : null,
      version: shift.version ?? 1,
    };
  }

  private reconciliationFrom(report: Awaited<ReturnType<ShiftsService['buildShiftReport']>>) {
    return {
      initialFloat: report.summary.initialFloat.toFixed(2),
      totalCashSales: report.summary.cashSales.toFixed(2),
      totalCashIn: report.summary.manualCashIn.toFixed(2),
      totalCashOut: report.summary.manualCashOut.toFixed(2),
      expectedAmount: report.summary.expectedCash.toFixed(2),
      actualAmount: (report.summary.actualCash ?? 0).toFixed(2),
      discrepancy: (report.summary.cashDifference ?? 0).toFixed(2),
      cashSales: report.summary.cashSales,
      cardSales: report.summary.cardSales,
      otherSales: report.summary.otherSales,
      totalSales: report.summary.totalSales,
      manualCashIn: report.summary.manualCashIn,
      manualCashOut: report.summary.manualCashOut,
      expectedCash: report.summary.expectedCash,
      actualCash: report.summary.actualCash,
      cashDifference: report.summary.cashDifference,
    };
  }

  private async n1Recipients(branchId: string, businessId: string, n1ResolverRole: string) {
    if (!this.scope) return [];
    return n1ResolverRole === BRANCH_SUPERVISOR_ROLE
      ? this.scope.supervisorsOf(branchId)
      : this.scope.operatorsOf(branchId, businessId);
  }

  private async recordOpeningBlocked(lastShift: any, attemptedBy: string) {
    if (!this.audit || !this.scope) return;
    const branch = await this.scope.getBranch(lastShift.branchId);
    await this.inTransaction(async (exec) => {
      await this.audit!.record(exec, {
        businessId: branch.businessId,
        branchId: lastShift.branchId,
        entityType: 'cash_shift',
        entityId: lastShift.id,
        action: 'apertura_bloqueada',
        actorId: attemptedBy,
        after: { reviewStatus: lastShift.reviewStatus },
        source: 'pos',
      });
      await this.notifications?.notify(exec, {
        businessId: branch.businessId,
        branchId: lastShift.branchId,
        recipients: [
          ...(await this.n1Recipients(lastShift.branchId, branch.businessId, lastShift.n1ResolverRole ?? BRANCH_OPERATOR_ROLE)),
          ...(await this.scope!.supervisorsOf(lastShift.branchId)),
        ],
        type: 'apertura_bloqueada',
        requiresAction: false,
        entityType: 'cash_shift',
        entityId: lastShift.id,
        title: `Apertura de caja bloqueada · ${branch.name}`,
        body: 'El Corte Z anterior espera la aprobación de nivel 1.',
      });
    });
  }

  /**
   * Runs the write, its audit entry and its notifications in one transaction
   * (spec 019 AU-02). Unit tests with a mocked connection fall back to direct execution.
   */
  private async inTransaction<T>(work: (exec: DbExecutor) => Promise<T>): Promise<T> {
    if (typeof (this.db as any)?.transaction === 'function') {
      return this.db.transaction((tx) => work(tx as unknown as DbExecutor));
    }
    return work(this.db as unknown as DbExecutor);
  }

  private parseMoney(value: unknown) {
    return Number.parseFloat(value?.toString() ?? '0') || 0;
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
