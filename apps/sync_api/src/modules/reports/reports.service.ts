import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';
import { eq, and, isNull, gte, lte, inArray } from 'drizzle-orm';

@Injectable()
export class ReportsService {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getSalesDashboard(businessId: string, startDate?: string, endDate?: string) {
    // 1. Resolve date filters (default to current month if not specified)
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1); // Start of month
    const defaultEnd = now;

    const start = startDate ? new Date(startDate) : defaultStart;
    const end = endDate ? new Date(endDate) : defaultEnd;

    // 2. Fetch all closed orders for this business within the date range
    const ordersList = await this.db
      .select({
        id: schema.orders.id,
        total: schema.orders.total,
        subtotal: schema.orders.subtotal,
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
      .where(
        and(
          eq(schema.orders.state, 'closed'),
          eq(schema.branches.businessId, businessId),
          isNull(schema.orders.deletedAt),
          gte(schema.orders.createdAt, start),
          lte(schema.orders.createdAt, end),
        )
      );

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

    // 4. Perform In-Memory Aggregations for speed and flexibility

    // Total metrics
    let totalSales = 0;
    ordersList.forEach((o) => {
      totalSales += parseFloat(o.total as string || '0');
    });

    const totalOrdersCount = ordersList.length;
    const averageTicket = totalOrdersCount > 0 ? totalSales / totalOrdersCount : 0;

    // A. Sales by Branch
    const branchMap = new Map<string, { id: string; name: string; totalSales: number; ordersCount: number }>();
    ordersList.forEach((o) => {
      const existing = branchMap.get(o.branchId);
      const val = parseFloat(o.total as string || '0');
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
    const salesByBranch = Array.from(branchMap.values()).sort((a, b) => b.totalSales - a.totalSales);

    // B. Top Products (Units, Revenue, Margin)
    const productMap = new Map<
      string,
      { id: string; name: string; sku: string | null; quantitySold: number; totalSales: number; profitMargin: number }
    >();
    itemsList.forEach((item) => {
      const existing = productMap.get(item.productId);
      const qty = item.quantity;
      const priceVal = parseFloat(item.price as string || '0');
      const costVal = parseFloat(item.cost as string || '0');
      const revenue = priceVal * qty;
      const profit = (priceVal - costVal) * qty;

      if (existing) {
        existing.quantitySold += qty;
        existing.totalSales += revenue;
        existing.profitMargin += profit;
      } else {
        productMap.set(item.productId, {
          id: item.productId,
          name: item.productName,
          sku: item.sku,
          quantitySold: qty,
          totalSales: revenue,
          profitMargin: profit,
        });
      }
    });
    const topProducts = Array.from(productMap.values()).sort((a, b) => b.quantitySold - a.quantitySold);

    // C. Waiters Performance (waiter role)
    const waiterMap = new Map<string, { id: string; name: string; totalSales: number; ordersCount: number }>();
    // D. Cashiers/Admins Performance (cashier/admin role)
    const cashierMap = new Map<string, { id: string; name: string; totalSales: number; ordersCount: number }>();

    ordersList.forEach((o) => {
      const orderVal = parseFloat(o.total as string || '0');
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

    const topWaiters = Array.from(waiterMap.values()).sort((a, b) => b.totalSales - a.totalSales);
    const topCashiers = Array.from(cashierMap.values()).sort((a, b) => b.totalSales - a.totalSales);

    // E. Hourly Sales Peak
    const hourlyMap = Array.from({ length: 24 }, (_, i) => ({ hour: i, totalSales: 0 }));
    ordersList.forEach((o) => {
      const hour = new Date(o.createdAt).getHours();
      hourlyMap[hour].totalSales += parseFloat(o.total as string || '0');
    });

    return {
      totalSales,
      totalOrdersCount,
      averageTicket,
      salesByBranch,
      topProducts,
      topWaiters,
      topCashiers,
      hourlySales: hourlyMap,
    };
  }
}
