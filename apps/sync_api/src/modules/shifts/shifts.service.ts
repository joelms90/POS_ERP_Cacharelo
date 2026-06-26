import { Injectable, ConflictException, NotFoundException, Inject } from '@nestjs/common';
import { ShiftsRepository } from './repositories/shifts.repository';
import { TransactionsRepository } from './repositories/transactions.repository';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';
import { eq, and, sql } from 'drizzle-orm';

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
    const { actualAmount, closedAt } = closeShiftDto;
    const closedAtDate = closedAt ? new Date(closedAt) : new Date();

    const shift = await this.shiftsRepository.findById(shiftId);
    if (!shift) {
      throw new NotFoundException(`Cash shift with ID ${shiftId} not found.`);
    }
    if (shift.status !== 'open') {
      throw new ConflictException('This cash shift is already closed.');
    }

    // 1. Calculate Expected Cash Drawer Balance:
    // Expected = initialFloat + cashIn - cashOut + cashSales
    const initialFloat = parseFloat(shift.initialFloat);

    // Sum of drops/withdrawals (cashTransactions)
    const txs = await this.transactionsRepository.findByShiftId(shiftId);
    let cashIn = 0;
    let cashOut = 0;
    for (const t of txs) {
      const amt = parseFloat(t.amount);
      if (t.type === 'cash-in') {
        cashIn += amt;
      } else if (t.type === 'cash-out') {
        cashOut += amt;
      }
    }

    // Sum of cash sales (payments table joined with orders) during shift duration
    const cashSalesResult = await this.db
      .select({
        totalCashSales: sql<string>`coalesce(sum(${schema.payments.amount}), '0')`,
      })
      .from(schema.payments)
      .innerJoin(schema.orders, eq(schema.payments.orderId, schema.orders.id))
      .where(
        and(
          eq(schema.orders.branchId, shift.branchId),
          eq(schema.payments.paymentMethod, 'cash'),
          sql`${schema.payments.createdAt} >= ${shift.openedAt}`,
          sql`${schema.payments.createdAt} <= ${closedAtDate}`,
        ),
      );

    const cashSales = parseFloat(cashSalesResult[0]?.totalCashSales || '0');
    const expectedAmount = initialFloat + cashIn - cashOut + cashSales;
    const finalActual = parseFloat(actualAmount);
    const discrepancy = finalActual - expectedAmount;

    // 2. Perform close update
    const closedShift = await this.shiftsRepository.update(shiftId, {
      status: 'closed',
      closedAt: closedAtDate,
      cashDrawerAmount: finalActual.toFixed(2), // store counted cash as final drawer amount
    });

    return {
      shift: closedShift,
      reconciliation: {
        initialFloat: initialFloat.toFixed(2),
        totalCashSales: cashSales.toFixed(2),
        totalCashIn: cashIn.toFixed(2),
        totalCashOut: cashOut.toFixed(2),
        expectedAmount: expectedAmount.toFixed(2),
        actualAmount: finalActual.toFixed(2),
        discrepancy: discrepancy.toFixed(2),
      },
    };
  }
}
