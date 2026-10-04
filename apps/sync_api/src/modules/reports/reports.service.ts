import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';
import { eq, and, isNull, gte, lte, lt, gt, inArray, desc } from 'drizzle-orm';

export type ReconciliationExceptionType =
  | 'zero_total_with_items'
  | 'missing_payment'
  | 'payment_mismatch'
  | 'item_subtotal_mismatch';

export interface ReconciliationException {
  orderId: string;
  type: ReconciliationExceptionType;
  orderTotal: number;
  paymentTotal: number;
  itemsGrossTotal: number;
  subtotal: number;
  difference: number;
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getSalesDashboard(businessId: string, startDate?: string, endDate?: string, branchId?: string) {
    // 1. Resolve date filters (default to current month if not specified)
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1); // Start of month
    const defaultEnd = now;

    const start = startDate ? new Date(startDate) : defaultStart;
    const end = endDate ? new Date(endDate) : defaultEnd;

    // 2. Build order conditions
    const orderConditions = [
      eq(schema.orders.state, 'closed'),
      eq(schema.branches.businessId, businessId),
      isNull(schema.orders.deletedAt),
      gte(schema.orders.createdAt, start),
      lte(schema.orders.createdAt, end),
    ];

    if (branchId) {
      orderConditions.push(eq(schema.orders.branchId, branchId));
    }

    // 3. Fetch all closed orders for this business within the date range
    const ordersList = await this.db
      .select({
        id: schema.orders.id,
        total: schema.orders.total,
        subtotal: schema.orders.subtotal,
        discount: schema.orders.discount,
        tax: schema.orders.tax,
        createdAt: schema.orders.createdAt,
        branchId: schema.orders.branchId,
        branchName: schema.branches.name,
        waiterId: schema.orders.waiterId,
        waiterName: schema.users.name,
        waiterRole: schema.users.role,
      })
      .from(schema.orders)
      .innerJoin(schema.branches, eq(schema.orders.branchId, schema.branches.id))
      .innerJoin(schema.users, eq(schema.orders.waiterId, schema.users.id))
      .where(and(...orderConditions));

    // Initial default response if no orders found
    if (ordersList.length === 0) {
      return {
        totalSales: 0,
        totalOrdersCount: 0,
        averageTicket: 0,
        salesByBranch: [],
        topProducts: [],
        topWaiters: [],
        topCashiers: [],
        hourlySales: Array.from({ length: 24 }, (_, i) => ({ hour: i, totalSales: 0 })),
        financial: {
          grossSales: 0,
          discounts: 0,
          taxes: 0,
          netSales: 0,
          collectedSales: 0,
          ordersCount: 0,
          paidOrdersCount: 0,
          itemsCount: 0,
          averageCheck: 0,
          estimatedCogs: 0,
          contributionMargin: 0,
          contributionMarginPercent: 0,
          paymentMix: [],
        },
        reconciliation: {
          status: 'ok',
          ordersTotal: 0,
          paymentsTotal: 0,
          itemsGrossTotal: 0,
          exceptionsCount: 0,
          exceptions: [],
        },
      };
    }

    const orderIds = ordersList.map((o) => o.id);

    // 3. Fetch all order items for the resolved orders to calculate product margins
    const itemsList = await this.db
      .select({
        productId: schema.orderItems.productId,
        productName: schema.products.name,
        sku: schema.products.sku,
        quantity: schema.orderItems.quantity,
        price: schema.orderItems.price,
        cost: schema.products.cost,
        orderId: schema.orderItems.orderId,
      })
      .from(schema.orderItems)
      .innerJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
      .where(
        and(
          inArray(schema.orderItems.orderId, orderIds),
          isNull(schema.orderItems.deletedAt),
        )
      );

    const paymentsList = await this.db
      .select({
        orderId: schema.payments.orderId,
        amount: schema.payments.amount,
        paymentMethod: schema.payments.paymentMethod,
        createdAt: schema.payments.createdAt,
      })
      .from(schema.payments)
      .where(inArray(schema.payments.orderId, orderIds));

    // 4. Perform In-Memory Aggregations for speed and flexibility

    // Total metrics
    let ordersTotal = 0;
    let discounts = 0;
    let taxes = 0;
    let grossSales = 0;
    ordersList.forEach((o) => {
      ordersTotal += this.parseMoney(o.total);
      discounts += this.parseMoney(o.discount);
      taxes += this.parseMoney(o.tax);
      grossSales += this.parseMoney(o.subtotal) + this.parseMoney(o.discount);
    });

    const totalOrdersCount = ordersList.length;
    const paymentsByOrder = new Map<string, number>();
    const paymentMixMap = new Map<string, { paymentMethod: string; total: number; paymentsCount: number }>();
    let paymentsTotal = 0;

    paymentsList.forEach((payment) => {
      const amount = this.parseMoney(payment.amount);
      paymentsTotal += amount;
      paymentsByOrder.set(payment.orderId, (paymentsByOrder.get(payment.orderId) || 0) + amount);

      const existingMix = paymentMixMap.get(payment.paymentMethod);
      if (existingMix) {
        existingMix.total += amount;
        existingMix.paymentsCount += 1;
      } else {
        paymentMixMap.set(payment.paymentMethod, {
          paymentMethod: payment.paymentMethod,
          total: amount,
          paymentsCount: 1,
        });
      }
    });

    const paymentMix = Array.from(paymentMixMap.values())
      .map((mix) => ({
        ...mix,
        total: this.roundMoney(mix.total),
        sharePercent: paymentsTotal > 0 ? this.roundMoney((mix.total / paymentsTotal) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const paidOrdersCount = ordersList.filter((o) => (paymentsByOrder.get(o.id) || 0) > 0).length;
    const totalSales = this.roundMoney(paymentsTotal);
    const averageTicket = paidOrdersCount > 0 ? paymentsTotal / paidOrdersCount : 0;

    const itemsByOrder = new Map<string, { grossTotal: number; estimatedCogs: number; itemsCount: number }>();
    itemsList.forEach((item) => {
      const qty = item.quantity;
      const priceVal = this.parseMoney(item.price);
      const costVal = this.parseMoney(item.cost);
      const existing = itemsByOrder.get(item.orderId) || { grossTotal: 0, estimatedCogs: 0, itemsCount: 0 };
      existing.grossTotal += priceVal * qty;
      existing.estimatedCogs += costVal * qty;
      existing.itemsCount += qty;
      itemsByOrder.set(item.orderId, existing);
    });

    const itemsGrossTotal = Array.from(itemsByOrder.values()).reduce((sum, item) => sum + item.grossTotal, 0);
    const estimatedCogs = Array.from(itemsByOrder.values()).reduce((sum, item) => sum + item.estimatedCogs, 0);
    const itemsCount = Array.from(itemsByOrder.values()).reduce((sum, item) => sum + item.itemsCount, 0);
    const contributionMargin = paymentsTotal - estimatedCogs;
    const contributionMarginPercent = paymentsTotal > 0 ? (contributionMargin / paymentsTotal) * 100 : 0;

    const exceptions = this.buildReconciliationExceptions(
      ordersList.map((order) => ({
        id: order.id,
        total: this.parseMoney(order.total),
        subtotal: this.parseMoney(order.subtotal),
      })),
      paymentsByOrder,
      itemsByOrder,
    );

    // A. Sales by Branch
    const branchMap = new Map<string, { id: string; name: string; totalSales: number; ordersCount: number }>();
    ordersList.forEach((o) => {
      const existing = branchMap.get(o.branchId);
      const val = paymentsByOrder.get(o.id) || 0;
      if (existing) {
        existing.totalSales += val;
        existing.ordersCount += 1;
      } else {
        branchMap.set(o.branchId, {
          id: o.branchId,
          name: o.branchName,
          totalSales: val,
          ordersCount: 1,
        });
      }
    });
    const salesByBranch = Array.from(branchMap.values())
      .map((branch) => ({ ...branch, totalSales: this.roundMoney(branch.totalSales) }))
      .sort((a, b) => b.totalSales - a.totalSales);

    // B. Top Products (Units, Revenue, Margin)
    const productMap = new Map<
      string,
      {
        id: string;
        name: string;
        sku: string | null;
        quantitySold: number;
        totalSales: number;
        profitMargin: number;
        grossSales: number;
        estimatedCogs: number;
        contributionMargin: number;
        contributionMarginPercent: number;
      }
    >();
    itemsList.forEach((item) => {
      const existing = productMap.get(item.productId);
      const qty = item.quantity;
      const priceVal = this.parseMoney(item.price);
      const costVal = this.parseMoney(item.cost);
      const revenue = priceVal * qty;
      const cost = costVal * qty;
      const profit = revenue - cost;

      if (existing) {
        existing.quantitySold += qty;
        existing.totalSales += revenue;
        existing.profitMargin += profit;
        existing.grossSales += revenue;
        existing.estimatedCogs += cost;
        existing.contributionMargin += profit;
      } else {
        productMap.set(item.productId, {
          id: item.productId,
          name: item.productName,
          sku: item.sku,
          quantitySold: qty,
          totalSales: revenue,
          profitMargin: profit,
          grossSales: revenue,
          estimatedCogs: cost,
          contributionMargin: profit,
          contributionMarginPercent: 0,
        });
      }
    });
    const topProducts = Array.from(productMap.values())
      .map((product) => ({
        ...product,
        totalSales: this.roundMoney(product.totalSales),
        profitMargin: this.roundMoney(product.profitMargin),
        grossSales: this.roundMoney(product.grossSales),
        estimatedCogs: this.roundMoney(product.estimatedCogs),
        contributionMargin: this.roundMoney(product.contributionMargin),
        contributionMarginPercent: product.grossSales > 0
          ? this.roundMoney((product.contributionMargin / product.grossSales) * 100)
          : 0,
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold);

    // C. Waiters Performance (waiter role)
    const waiterMap = new Map<string, { id: string; name: string; totalSales: number; ordersCount: number }>();
    // D. Cashiers/Admins Performance (cashier/admin role)
    const cashierMap = new Map<string, { id: string; name: string; totalSales: number; ordersCount: number }>();

    ordersList.forEach((o) => {
      const orderVal = paymentsByOrder.get(o.id) || 0;
      const targetMap = o.waiterRole === 'cashier' || o.waiterRole === 'admin' ? cashierMap : waiterMap;
      const existing = targetMap.get(o.waiterId);

      if (existing) {
        existing.totalSales += orderVal;
        existing.ordersCount += 1;
      } else {
        targetMap.set(o.waiterId, {
          id: o.waiterId,
          name: o.waiterName,
          totalSales: orderVal,
          ordersCount: 1,
        });
      }
    });

    const topWaiters = Array.from(waiterMap.values())
      .map((waiter) => ({ ...waiter, totalSales: this.roundMoney(waiter.totalSales) }))
      .sort((a, b) => b.totalSales - a.totalSales);
    const topCashiers = Array.from(cashierMap.values())
      .map((cashier) => ({ ...cashier, totalSales: this.roundMoney(cashier.totalSales) }))
      .sort((a, b) => b.totalSales - a.totalSales);

    // E. Hourly Sales Peak
    const hourlyMap = Array.from({ length: 24 }, (_, i) => ({ hour: i, totalSales: 0 }));
    ordersList.forEach((o) => {
      const hour = new Date(o.createdAt).getHours();
      hourlyMap[hour].totalSales += paymentsByOrder.get(o.id) || 0;
    });

    return {
      totalSales: this.roundMoney(totalSales),
      totalOrdersCount,
      averageTicket: this.roundMoney(averageTicket),
      salesByBranch,
      topProducts,
      topWaiters,
      topCashiers,
      hourlySales: hourlyMap.map((hour) => ({ ...hour, totalSales: this.roundMoney(hour.totalSales) })),
      financial: {
        grossSales: this.roundMoney(grossSales),
        discounts: this.roundMoney(discounts),
        taxes: this.roundMoney(taxes),
        netSales: this.roundMoney(ordersTotal),
        collectedSales: this.roundMoney(paymentsTotal),
        ordersCount: totalOrdersCount,
        paidOrdersCount,
        itemsCount,
        averageCheck: this.roundMoney(averageTicket),
        estimatedCogs: this.roundMoney(estimatedCogs),
        contributionMargin: this.roundMoney(contributionMargin),
        contributionMarginPercent: this.roundMoney(contributionMarginPercent),
        paymentMix,
      },
      reconciliation: {
        status: exceptions.length > 0 ? 'warning' : 'ok',
        ordersTotal: this.roundMoney(ordersTotal),
        paymentsTotal: this.roundMoney(paymentsTotal),
        itemsGrossTotal: this.roundMoney(itemsGrossTotal),
        exceptionsCount: exceptions.length,
        exceptions,
      },
    };
  }

  async getProductSalesReport(query: {
    businessId: string;
    startDate?: string;
    endDate?: string;
    branchId?: string;
    categoryId?: string;
  }) {
    const { businessId, startDate, endDate, branchId, categoryId } = query;

    const start = startDate ? new Date(startDate + 'T00:00:00') : null;
    const end = endDate ? new Date(endDate + 'T23:59:59') : null;

    const itemsList = await this.db
      .select({
        productId: schema.orderItems.productId,
        productName: schema.products.name,
        sku: schema.products.sku,
        categoryName: schema.categories.name,
        price: schema.orderItems.price,
        quantity: schema.orderItems.quantity,
      })
      .from(schema.orderItems)
      .leftJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
      .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .innerJoin(schema.branches, eq(schema.orders.branchId, schema.branches.id))
      .where(
        and(
          eq(schema.branches.businessId, businessId),
          eq(schema.orders.state, 'closed'),
          isNull(schema.orders.deletedAt),
          isNull(schema.orderItems.deletedAt),
          start ? gte(schema.orders.createdAt, start) : undefined,
          end ? lte(schema.orders.createdAt, end) : undefined,
          branchId ? eq(schema.orders.branchId, branchId) : undefined,
          categoryId ? eq(schema.products.categoryId, categoryId) : undefined,
        ),
      );

    const productMap = new Map<string, {
      productId: string;
      productName: string;
      sku: string;
      categoryName: string;
      quantitySold: number;
      grossSales: number;
    }>();

    itemsList.forEach((item) => {
      if (!item.productId) return;
      const existing = productMap.get(item.productId);
      const qty = item.quantity;
      const priceVal = this.parseMoney(item.price);
      const revenue = priceVal * qty;

      if (existing) {
        existing.quantitySold += qty;
        existing.grossSales += revenue;
      } else {
        productMap.set(item.productId, {
          productId: item.productId,
          productName: item.productName || 'Producto Eliminado',
          sku: item.sku || '',
          categoryName: item.categoryName || 'Otros',
          quantitySold: qty,
          grossSales: revenue,
        });
      }
    });

    return Array.from(productMap.values())
      .map((row) => {
        const grossSalesRounded = this.roundMoney(row.grossSales);
        const averagePrice = row.quantitySold > 0 ? this.roundMoney(row.grossSales / row.quantitySold) : 0;
        const taxAmount = this.roundMoney(grossSalesRounded - (grossSalesRounded / 1.16));
        const netSales = this.roundMoney(grossSalesRounded / 1.16);

        return {
          productId: row.productId,
          productName: row.productName,
          sku: row.sku,
          categoryName: row.categoryName,
          quantitySold: row.quantitySold,
          averagePrice,
          grossSales: grossSalesRounded,
          taxAmount,
          netSales,
        };
      })
      .sort((a, b) => b.quantitySold - a.quantitySold);
  }

  async getPaymentMethodsSalesReport(query: {
    businessId: string;
    startDate?: string;
    endDate?: string;
    branchId?: string;
  }) {
    const { businessId, startDate, endDate, branchId } = query;

    const start = startDate ? new Date(startDate + 'T00:00:00') : null;
    const end = endDate ? new Date(endDate + 'T23:59:59') : null;

    const paymentsList = await this.db
      .select({
        paymentMethod: schema.payments.paymentMethod,
        amount: schema.payments.amount,
      })
      .from(schema.payments)
      .innerJoin(schema.orders, eq(schema.payments.orderId, schema.orders.id))
      .innerJoin(schema.branches, eq(schema.orders.branchId, schema.branches.id))
      .where(
        and(
          eq(schema.branches.businessId, businessId),
          eq(schema.orders.state, 'closed'),
          isNull(schema.orders.deletedAt),
          start ? gte(schema.payments.createdAt, start) : undefined,
          end ? lte(schema.payments.createdAt, end) : undefined,
          branchId ? eq(schema.orders.branchId, branchId) : undefined,
        ),
      );

    const methodsMap = new Map<string, {
      paymentMethod: string;
      totalAmount: number;
      paymentsCount: number;
    }>();

    let totalSum = 0;

    paymentsList.forEach((item) => {
      const method = item.paymentMethod || 'Otros';
      const amountVal = this.parseMoney(item.amount);
      totalSum += amountVal;

      const existing = methodsMap.get(method);
      if (existing) {
        existing.totalAmount += amountVal;
        existing.paymentsCount += 1;
      } else {
        methodsMap.set(method, {
          paymentMethod: method,
          totalAmount: amountVal,
          paymentsCount: 1,
        });
      }
    });

    return Array.from(methodsMap.values()).map((row) => {
      const totalAmountRounded = this.roundMoney(row.totalAmount);
      const sharePercent = totalSum > 0 ? this.roundMoney((row.totalAmount / totalSum) * 100) : 0;
      return {
        paymentMethod: row.paymentMethod,
        totalAmount: totalAmountRounded,
        paymentsCount: row.paymentsCount,
        sharePercent,
      };
    }).sort((a, b) => b.totalAmount - a.totalAmount);
  }

  async getCashShiftsList(query: {
    businessId: string;
    startDate?: string;
    endDate?: string;
    branchId?: string;
  }) {
    const { businessId, startDate, endDate, branchId } = query;

    const start = startDate ? new Date(startDate + 'T00:00:00') : null;
    const end = endDate ? new Date(endDate + 'T23:59:59') : null;

    return await this.db
      .select({
        id: schema.cashShifts.id,
        cashierName: schema.users.name,
        branchName: schema.branches.name,
        initialFloat: schema.cashShifts.initialFloat,
        cashDrawerAmount: schema.cashShifts.cashDrawerAmount,
        status: schema.cashShifts.status,
        openedAt: schema.cashShifts.openedAt,
        closedAt: schema.cashShifts.closedAt,
      })
      .from(schema.cashShifts)
      .innerJoin(schema.users, eq(schema.cashShifts.cashierId, schema.users.id))
      .innerJoin(schema.branches, eq(schema.cashShifts.branchId, schema.branches.id))
      .where(
        and(
          eq(schema.branches.businessId, businessId),
          start ? gte(schema.cashShifts.openedAt, start) : undefined,
          end ? lte(schema.cashShifts.openedAt, end) : undefined,
          branchId ? eq(schema.cashShifts.branchId, branchId) : undefined,
        ),
      )
      .orderBy(desc(schema.cashShifts.openedAt));
  }

  async getCashShiftAuditReport(
    shiftId: string,
    actor?: { sub?: string; branchId?: string; businessId?: string },
  ) {
    const shiftList = await this.db
      .select({
        id: schema.cashShifts.id,
        cashierId: schema.cashShifts.cashierId,
        cashierName: schema.users.name,
        businessId: schema.branches.businessId,
        branchId: schema.cashShifts.branchId,
        branchName: schema.branches.name,
        initialFloat: schema.cashShifts.initialFloat,
        cashDrawerAmount: schema.cashShifts.cashDrawerAmount,
        status: schema.cashShifts.status,
        openedAt: schema.cashShifts.openedAt,
        closedAt: schema.cashShifts.closedAt,
        denominationCounts: schema.cashShifts.denominationCounts,
        closeNotes: schema.cashShifts.closeNotes,
        closeSnapshot: schema.cashShifts.closeSnapshot,
      })
      .from(schema.cashShifts)
      .innerJoin(schema.users, eq(schema.cashShifts.cashierId, schema.users.id))
      .innerJoin(schema.branches, eq(schema.cashShifts.branchId, schema.branches.id))
      .where(eq(schema.cashShifts.id, shiftId));

    if (shiftList.length === 0) {
      throw new Error('Shift not found');
    }

    const shift = shiftList[0];
    if (!actor?.sub || !actor.branchId || !actor.businessId ||
        shift.cashierId !== actor.sub || shift.branchId !== actor.branchId ||
        shift.businessId !== actor.businessId) {
      throw new ForbiddenException('Solo puedes acceder a la auditoria de tu caja y sucursal.');
    }
    if (shift.status === 'closed' && shift.closeSnapshot) {
      return shift.closeSnapshot;
    }

    const openedAt = new Date(shift.openedAt);
    const closedAt = shift.closedAt ? new Date(shift.closedAt) : new Date();

    const transactionsList = await this.db
      .select({
        id: schema.cashTransactions.id,
        type: schema.cashTransactions.type,
        amount: schema.cashTransactions.amount,
        reason: schema.cashTransactions.reason,
        createdAt: schema.cashTransactions.createdAt,
      })
      .from(schema.cashTransactions)
      .where(eq(schema.cashTransactions.shiftId, shiftId))
      .orderBy(schema.cashTransactions.createdAt);

    let totalCashIn = 0;
    let totalCashOut = 0;
    transactionsList.forEach((t) => {
      const amt = this.parseMoney(t.amount);
      if (t.type === 'cash-in') {
        totalCashIn += amt;
      } else if (t.type === 'cash-out') {
        totalCashOut += amt;
      }
    });

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
          gte(schema.payments.createdAt, openedAt),
          lte(schema.payments.createdAt, closedAt),
        ),
      );

    const paymentMethods = new Map<string, { paymentMethod: string; total: number; count: number }>();
    paymentsList.forEach((p) => {
      const method = p.paymentMethod || 'other';
      const amt = this.parseMoney(p.amount);
      const row = paymentMethods.get(method) ?? { paymentMethod: method, total: 0, count: 0 };
      row.total += amt;
      row.count += 1;
      paymentMethods.set(method, row);
    });
    const salesByPaymentMethod = Array.from(paymentMethods.values()).map((row) => ({
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

    const initialFloatVal = this.parseMoney(shift.initialFloat);
    const countedCashVal = this.parseMoney(shift.cashDrawerAmount);
    const expectedCash = initialFloatVal + cashSales + totalCashIn - totalCashOut;
    const discrepancy = countedCashVal - expectedCash;

    const summary = {
      initialFloat: this.roundMoney(initialFloatVal),
      cashSales: this.roundMoney(cashSales),
      cardSales: this.roundMoney(cardSales),
      otherSales: this.roundMoney(otherSales),
      totalSales: this.roundMoney(totalSales),
      manualCashIn: this.roundMoney(totalCashIn),
      manualCashOut: this.roundMoney(totalCashOut),
      expectedCash: this.roundMoney(expectedCash),
      actualCash: shift.status === 'closed' ? this.roundMoney(countedCashVal) : null,
      cashDifference:
        shift.status === 'closed' ? this.roundMoney(discrepancy) : null,
    };

    return {
      shiftInfo: {
        id: shift.id,
        cashierName: shift.cashierName,
        branchId: shift.branchId,
        branchName: shift.branchName,
        status: shift.status,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        initialFloat: initialFloatVal,
        cashDrawerAmount: countedCashVal,
      },
      summary,
      salesSummary: {
        cashSales: this.roundMoney(cashSales),
        cardSales: this.roundMoney(cardSales),
        totalSales: this.roundMoney(totalSales),
      },
      salesByPaymentMethod,
      transactions: transactionsList.map((t) => ({
        id: t.id,
        type: t.type,
        amount: this.parseMoney(t.amount),
        reason: t.reason,
        createdAt: t.createdAt,
      })),
      cashMovements: transactionsList.map((t) => ({
        id: t.id,
        type: t.type,
        amount: this.parseMoney(t.amount),
        reason: t.reason,
        createdAt: t.createdAt,
      })),
      expectedCash: this.roundMoney(expectedCash),
      discrepancy: shift.status === 'closed' ? this.roundMoney(discrepancy) : 0,
      denominationCounts: shift.denominationCounts ?? null,
      closeNotes: shift.closeNotes ?? null,
      generatedAt: new Date(),
    };
  }

  private buildReconciliationExceptions(
    orders: Array<{ id: string; total: number; subtotal: number }>,
    paymentsByOrder: Map<string, number>,
    itemsByOrder: Map<string, { grossTotal: number; estimatedCogs: number; itemsCount: number }>,
  ): ReconciliationException[] {
    const tolerance = 0.01;
    const exceptions: ReconciliationException[] = [];

    orders.forEach((order) => {
      const paymentTotal = paymentsByOrder.get(order.id) || 0;
      const itemsGrossTotal = itemsByOrder.get(order.id)?.grossTotal || 0;
      const hasZeroTotalWithItems = order.total === 0 && itemsGrossTotal > tolerance;
      const hasMissingPayment = order.total > tolerance && paymentTotal <= tolerance;

      if (hasZeroTotalWithItems) {
        exceptions.push(this.createReconciliationException(
          order,
          paymentTotal,
          itemsGrossTotal,
          'zero_total_with_items',
          itemsGrossTotal,
        ));
      }

      if (hasMissingPayment) {
        exceptions.push(this.createReconciliationException(
          order,
          paymentTotal,
          itemsGrossTotal,
          'missing_payment',
          order.total,
        ));
      }

      const paymentDifference = this.roundMoney(paymentTotal - order.total);
      if (!hasMissingPayment && order.total > tolerance && Math.abs(paymentDifference) > tolerance) {
        exceptions.push(this.createReconciliationException(
          order,
          paymentTotal,
          itemsGrossTotal,
          'payment_mismatch',
          paymentDifference,
        ));
      }

      const itemDifference = this.roundMoney(itemsGrossTotal - order.subtotal);
      if (!hasZeroTotalWithItems && itemsGrossTotal > tolerance && Math.abs(itemDifference) > tolerance) {
        exceptions.push(this.createReconciliationException(
          order,
          paymentTotal,
          itemsGrossTotal,
          'item_subtotal_mismatch',
          itemDifference,
        ));
      }
    });

    return exceptions;
  }

  private createReconciliationException(
    order: { id: string; total: number; subtotal: number },
    paymentTotal: number,
    itemsGrossTotal: number,
    type: ReconciliationExceptionType,
    difference: number,
  ): ReconciliationException {
    return {
      orderId: order.id,
      type,
      orderTotal: this.roundMoney(order.total),
      paymentTotal: this.roundMoney(paymentTotal),
      itemsGrossTotal: this.roundMoney(itemsGrossTotal),
      subtotal: this.roundMoney(order.subtotal),
      difference: this.roundMoney(difference),
    };
  }

  private parseMoney(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  async getInventoryExistence(query: {
    businessId: string;
    warehouseId?: string;
    branchId?: string;
    categoryId?: string;
    productId?: string;
    status?: string;
    stockFilter?: string;
    consolidated?: string;
  }) {
    const { businessId, warehouseId, branchId, categoryId, productId, status = 'active', stockFilter = 'all' } = query;

    const conditions = [eq(schema.products.businessId, businessId)];

    if (warehouseId) {
      conditions.push(eq(schema.stockLevels.warehouseId, warehouseId));
    }
    if (branchId) {
      conditions.push(eq(schema.stockLevels.branchId, branchId));
    }
    if (categoryId) {
      conditions.push(eq(schema.products.categoryId, categoryId));
    }
    if (productId) {
      conditions.push(eq(schema.products.id, productId));
    }

    if (status === 'active') {
      conditions.push(eq(schema.products.isActive, true));
    } else if (status === 'inactive') {
      conditions.push(eq(schema.products.isActive, false));
    }

    const data = await this.db
      .select({
        id: schema.stockLevels.id,
        productId: schema.stockLevels.productId,
        productName: schema.products.name,
        sku: schema.products.sku,
        internalCode: schema.products.internalCode,
        categoryName: schema.categories.name,
        isActive: schema.products.isActive,
        quantity: schema.stockLevels.quantity,
        cost: schema.products.cost,
        minStock: schema.products.minStock,
        warehouseId: schema.stockLevels.warehouseId,
        warehouseName: schema.warehouses.name,
        branchId: schema.stockLevels.branchId,
        branchName: schema.branches.name,
      })
      .from(schema.stockLevels)
      .innerJoin(schema.products, eq(schema.stockLevels.productId, schema.products.id))
      .innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
      .leftJoin(schema.warehouses, eq(schema.stockLevels.warehouseId, schema.warehouses.id))
      .leftJoin(schema.branches, eq(schema.stockLevels.branchId, schema.branches.id))
      .where(and(...conditions));

    // Post-filter stock levels in JS for flexibility
    let filtered = data.map((item) => {
      const quantity = parseFloat(item.quantity);
      const cost = parseFloat(item.cost || '0');
      const minStock = parseFloat(item.minStock || '0');
      const totalCost = quantity * cost;

      return {
        ...item,
        quantity,
        cost,
        minStock,
        totalCost,
      };
    });

    if (stockFilter === 'aboveZero') {
      filtered = filtered.filter((item) => item.quantity > 0);
    } else if (stockFilter === 'zero') {
      filtered = filtered.filter((item) => item.quantity === 0);
    } else if (stockFilter === 'belowMin') {
      filtered = filtered.filter((item) => item.quantity < item.minStock);
    }

    if (query.consolidated === 'true') {
      const productMap = new Map<string, any>();
      filtered.forEach((item) => {
        const existing = productMap.get(item.productId);
        if (existing) {
          existing.quantity += item.quantity;
          existing.totalCost += item.totalCost;
        } else {
          productMap.set(item.productId, {
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            internalCode: item.internalCode,
            categoryName: item.categoryName,
            isActive: item.isActive,
            quantity: item.quantity,
            cost: item.cost,
            minStock: item.minStock,
            totalCost: item.totalCost,
          });
        }
      });
      filtered = Array.from(productMap.values());
    }

    // Calculations of aggregates
    const totalProducts = filtered.length;
    const totalQuantity = filtered.reduce((sum, item) => sum + item.quantity, 0);
    const totalCost = filtered.reduce((sum, item) => sum + item.totalCost, 0);

    return {
      data: filtered,
      summary: {
        totalProducts,
        totalQuantity,
        totalCost,
      },
    };
  }

  async getInventoryKardex(query: {
    businessId: string;
    productId: string;
    warehouseId?: string;
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { businessId, productId, warehouseId, branchId, startDate, endDate } = query;

    const conditions = [
      eq(schema.stockLedger.businessId, businessId),
      eq(schema.stockLedger.productId, productId),
    ];

    if (warehouseId) {
      conditions.push(eq(schema.stockLedger.warehouseId, warehouseId));
    }
    if (branchId) {
      conditions.push(eq(schema.stockLedger.branchId, branchId));
    }

    const movements = await this.db
      .select({
        id: schema.stockLedger.id,
        productId: schema.stockLedger.productId,
        warehouseId: schema.stockLedger.warehouseId,
        warehouseName: schema.warehouses.name,
        branchId: schema.stockLedger.branchId,
        branchName: schema.branches.name,
        quantity: schema.stockLedger.quantityDelta,
        type: schema.stockLedger.eventType,
        referenceId: schema.stockLedger.referenceId,
        documentNumber: schema.stockLedger.documentNumber,
        notes: schema.stockLedger.notes,
        lotNumber: schema.stockLedger.lotNumber,
        expirationDate: schema.stockLedger.expirationDate,
        createdAt: schema.stockLedger.createdAt,
        createdById: schema.stockLedger.createdById,
        createdByName: schema.users.name,
      })
      .from(schema.stockLedger)
      .leftJoin(schema.warehouses, eq(schema.stockLedger.warehouseId, schema.warehouses.id))
      .leftJoin(schema.branches, eq(schema.stockLedger.branchId, schema.branches.id))
      .leftJoin(schema.users, eq(schema.stockLedger.createdById, schema.users.id))
      .where(and(...conditions))
      .orderBy(schema.stockLedger.createdAt);

    // Calculate balances sequentially in memory
    let runningBalance = 0;
    const data = movements.map((m) => {
      const quantity = parseFloat(m.quantity);
      const previousBalance = runningBalance;
      runningBalance += quantity;
      return {
        ...m,
        quantity,
        previousBalance,
        finalBalance: runningBalance,
      };
    });

    let filtered = data;
    if (startDate) {
      filtered = filtered.filter((m) => new Date(m.createdAt) >= new Date(startDate));
    }
    if (endDate) {
      filtered = filtered.filter((m) => new Date(m.createdAt) <= new Date(endDate));
    }

    return filtered;
  }

  async getTicketsToday(businessId: string, branchId?: string) {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const branchFilter = branchId ? and(eq(schema.orders.branchId, branchId)) : undefined;

    const closedOrders = await this.db
      .select({
        id: schema.orders.id,
        createdAt: schema.orders.createdAt,
        total: schema.orders.total,
        discount: schema.orders.discount,
        subtotal: schema.orders.subtotal,
        tax: schema.orders.tax,
        state: schema.orders.state,
        tableLabel: schema.branchTables.label,
        tableId: schema.orders.tableId,
        waiterName: schema.users.name,
      })
      .from(schema.orders)
      .innerJoin(schema.branchTables, eq(schema.orders.tableId, schema.branchTables.id))
      .innerJoin(schema.users, eq(schema.orders.waiterId, schema.users.id))
      .innerJoin(schema.branches, eq(schema.orders.branchId, schema.branches.id))
      .where(
        and(
          eq(schema.branches.businessId, businessId),
          eq(schema.orders.state, 'closed'),
          gte(schema.orders.createdAt, todayStart),
          lt(schema.orders.createdAt, todayEnd),
          isNull(schema.orders.deletedAt),
          ...(branchFilter ? [branchFilter] : []),
        ),
      )
      .orderBy(schema.orders.createdAt);

    if (closedOrders.length === 0) {
      return { tickets: [], branchName: '', date: todayStart.toISOString().substring(0, 10) };
    }

    const orderIds = closedOrders.map((o) => o.id);

    const allItems = await this.db
      .select({
        orderId: schema.orderItems.orderId,
        quantity: schema.orderItems.quantity,
        productName: schema.products.name,
        price: schema.orderItems.price,
        notes: schema.orderItems.notes,
        assignedGuest: schema.orderItems.assignedGuest,
      })
      .from(schema.orderItems)
      .innerJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
      .where(inArray(schema.orderItems.orderId, orderIds));

    const allPayments = await this.db
      .select({
        orderId: schema.payments.orderId,
        amount: schema.payments.amount,
        paymentMethod: schema.payments.paymentMethod,
        referenceCode: schema.payments.referenceCode,
      })
      .from(schema.payments)
      .where(inArray(schema.payments.orderId, orderIds));

    const branchName = await this.db
      .select({ name: schema.branches.name })
      .from(schema.branches)
      .where(
        branchId
          ? eq(schema.branches.id, branchId)
          : eq(schema.branches.businessId, businessId),
      )
      .limit(1)
      .then((rows) => rows[0]?.name ?? '');

    const tickets = closedOrders.map((order) => {
      const items = allItems
        .filter((i) => i.orderId === order.id)
        .map((i) => ({
          quantity: i.quantity,
          productName: i.productName,
          price: Number(i.price),
          notes: i.notes,
          assignedGuest: i.assignedGuest,
        }));

      const payments = allPayments
        .filter((p) => p.orderId === order.id)
        .map((p) => ({
          method: p.paymentMethod,
          amount: Number(p.amount),
          reference: p.referenceCode,
        }));

      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

      return {
        id: order.id,
        tableLabel: order.tableLabel,
        waiterName: order.waiterName,
        createdAt: order.createdAt,
        subtotal: Number(order.subtotal),
        discount: Number(order.discount),
        tax: Number(order.tax),
        total: Number(order.total),
        totalPaid,
        items,
        payments,
      };
    });

    return {
      branchName,
      date: todayStart.toISOString().substring(0, 10),
      tickets,
    };
  }
}
