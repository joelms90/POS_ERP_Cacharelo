import { Injectable, ConflictException, NotFoundException, Inject } from '@nestjs/common';
import { ShiftsRepository } from './repositories/shifts.repository';
import { TransactionsRepository } from './repositories/transactions.repository';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';
import { eq, and, gte, lte, isNull } from 'drizzle-orm';

@Injectable()
export class ShiftsService {
  constructor(
    private readonly shiftsRepository: ShiftsRepository,
    private readonly transactionsRepository: TransactionsRepository,
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async openShift(openShiftDto: OpenShiftDto) {
    const { branchId, cashierId, initialFloat } = openShiftDto;

    // Prevent opening a shift if one is already open for that cashier & branch
    const activeShift = await this.shiftsRepository.findActiveShift(branchId, cashierId);
    if (activeShift) {
      throw new ConflictException('A cash shift is already active for this cashier and branch.');
    }

    // Auto-close any other open shifts for this branch (stale/abandoned by other cashiers)
    await this.shiftsRepository.closeAllOpenForBranch(branchId);

    return this.shiftsRepository.create({
      branchId,
      cashierId,
      initialFloat,
      cashDrawerAmount: initialFloat,
      status: 'open',
      openedAt: new Date(),
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

  async createTransaction(shiftId: string, createTransactionDto: CreateTransactionDto) {
    const { type, amount, reason } = createTransactionDto;

    const shift = await this.shiftsRepository.findById(shiftId);
    if (!shift) {
      throw new NotFoundException(`Cash shift with ID ${shiftId} not found.`);
    }
    if (shift.status !== 'open') {
      throw new ConflictException('Cannot add transactions to a closed shift.');
    }

    // Insert the cash transaction
    const transaction = await this.transactionsRepository.create({
      shiftId,
      type,
      amount,
      reason,
      createdAt: new Date(),
    });

    // Update current drawer amount in shift
    const currentDrawer = parseFloat(shift.cashDrawerAmount);
    const txAmount = parseFloat(amount);
    let newDrawerAmount = currentDrawer;

    if (type === 'cash-in') {
      newDrawerAmount += txAmount;
    } else if (type === 'cash-out') {
      newDrawerAmount -= txAmount;
    }

    const updatedShift = await this.shiftsRepository.update(shiftId, {
      cashDrawerAmount: newDrawerAmount.toFixed(2),
    });

    return {
      transaction,
      shift: updatedShift,
    };
  }

  async closeShift(shiftId: string, closeShiftDto: CloseShiftDto) {
    const { actualAmount, closedAt, denominationCounts, closeNotes } = closeShiftDto;
    const closedAtDate = closedAt ? new Date(closedAt) : new Date();

    const shift = await this.shiftsRepository.findById(shiftId);
    if (!shift) {
      throw new NotFoundException(`Cash shift with ID ${shiftId} not found.`);
    }
    if (shift.status !== 'open') {
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

    const closedShift = await this.shiftsRepository.update(shiftId, {
      status: 'closed',
      closedAt: closedAtDate,
      cashDrawerAmount: finalActual.toFixed(2), // store counted cash as final drawer amount
      denominationCounts: denominationCounts ?? null,
      closeNotes: closeNotes?.trim() || null,
      closeSnapshot: report,
    });

    return {
      shift: closedShift,
      reconciliation: {
        initialFloat: report.summary.initialFloat.toFixed(2),
        totalCashSales: report.summary.cashSales.toFixed(2),
        totalCashIn: report.summary.manualCashIn.toFixed(2),
        totalCashOut: report.summary.manualCashOut.toFixed(2),
        expectedAmount: report.summary.expectedCash.toFixed(2),
        actualAmount: finalActual.toFixed(2),
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
      },
      report,
    };
  }

  private async buildShiftReport(
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
      const amt = this.parseMoney(t.amount);
      if (t.type === 'cash-in') manualCashIn += amt;
      if (t.type === 'cash-out') manualCashOut += amt;
    }

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

    return {
      shiftInfo: {
        id: shift.id,
        cashierId: shift.cashierId,
        branchId: shift.branchId,
        status: options.status ?? shift.status,
        openedAt: shift.openedAt,
        closedAt: options.closedAt,
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
      },
      salesByPaymentMethod,
      cashMovements: txs.map((t) => ({
        id: t.id,
        type: t.type,
        amount: this.parseMoney(t.amount),
        reason: t.reason,
        createdAt: t.createdAt,
      })),
      denominationCounts: options.denominationCounts ?? null,
      closeNotes: options.closeNotes?.trim() || null,
      generatedAt: new Date(),
    };
  }

  private parseMoney(value: unknown) {
    return Number.parseFloat(value?.toString() ?? '0') || 0;
  }

  private roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
