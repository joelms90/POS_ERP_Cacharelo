import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';

@Injectable()
export class OrdersRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: string) {
    const order = await this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, id));

    if (order.length === 0) return null;

    const items = await this.db
      .select()
      .from(schema.orderItems)
      .where(
        and(
          eq(schema.orderItems.orderId, id),
          isNull(schema.orderItems.deletedAt),
        ),
      );

    const payments = await this.db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.orderId, id));

    return {
      ...order[0],
      items,
      payments,
    };
  }

  async findActiveByBranch(branchId: string) {
    // Returns active orders (open, billing) for a branch
    const activeOrders = await this.db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.branchId, branchId),
          isNull(schema.orders.deletedAt),
          sql`state IN ('open', 'billing')`,
        ),
      );

    const hydrated = [];
    for (const order of activeOrders) {
      const items = await this.db
        .select()
        .from(schema.orderItems)
        .where(
          and(
            eq(schema.orderItems.orderId, order.id),
            isNull(schema.orderItems.deletedAt),
          ),
        );

      const payments = await this.db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.orderId, order.id));

      hydrated.push({
        ...order,
        items,
        payments,
      });
    }

    return hydrated;
  }

  async create(orderData: typeof schema.orders.$inferInsert, itemsData: Omit<typeof schema.orderItems.$inferInsert, 'orderId'>[]) {
    return this.db.transaction(async (tx) => {
      // 1. Insert order
      const [newOrder] = await tx
        .insert(schema.orders)
        .values(orderData)
        .returning();

      // 2. Insert items
      const itemsToInsert = itemsData.map((item) => ({
        ...item,
        orderId: newOrder.id,
      }));

      const newItems = await tx
        .insert(schema.orderItems)
        .values(itemsToInsert)
        .returning();

      // 3. Update table state to 'occupied'
      await tx
        .update(schema.branchTables)
        .set({ state: 'occupied', updatedAt: new Date() })
        .where(eq(schema.branchTables.id, orderData.tableId));

      return {
        ...newOrder,
        items: newItems,
        payments: [],
      };
    });
  }

  async addItems(orderId: string, itemsData: Omit<typeof schema.orderItems.$inferInsert, 'orderId'>[], newTotals: { subtotal: string; total: string; tax?: string }) {
    return this.db.transaction(async (tx) => {
      // 1. Insert new items
      const itemsToInsert = itemsData.map((item) => ({
        ...item,
        orderId,
      }));

      const newItems = await tx
        .insert(schema.orderItems)
        .values(itemsToInsert)
        .returning();

      // 2. Update order totals
      const [updatedOrder] = await tx
        .update(schema.orders)
        .set({
          subtotal: newTotals.subtotal,
          total: newTotals.total,
          tax: newTotals.tax || '0.00',
          updatedAt: new Date(),
        })
        .where(eq(schema.orders.id, orderId))
        .returning();

      return {
        ...updatedOrder,
        newItems,
      };
    });
  }

  async updateOrderAndTableState(orderId: string, orderState: string, tableState: string) {
    return this.db.transaction(async (tx) => {
      const [updatedOrder] = await tx
        .update(schema.orders)
        .set({ state: orderState, updatedAt: new Date() })
        .where(eq(schema.orders.id, orderId))
        .returning();

      await tx
        .update(schema.branchTables)
        .set({ state: tableState, updatedAt: new Date() })
        .where(eq(schema.branchTables.id, updatedOrder.tableId));

      return updatedOrder;
    });
  }

  async createPayment(orderId: string, paymentData: typeof schema.payments.$inferInsert) {
    return this.db.transaction(async (tx) => {
      // 1. Insert payment record
      const [newPayment] = await tx
        .insert(schema.payments)
        .values(paymentData)
        .returning();

      // 2. Calculate total paid so far
      const allPayments = await tx
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.orderId, orderId));

      const totalPaid = allPayments.reduce(
        (sum, p) => sum + parseFloat(p.amount),
        0,
      );

      // 3. Get order total
      const [order] = await tx
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId));

      const orderTotal = parseFloat(order.total);

      let orderState = order.state;
      let tableState = 'occupied';

      // 4. If paid in full, close the order and set table to 'cleaning'
      if (totalPaid >= orderTotal) {
        orderState = 'closed';
        tableState = 'cleaning';

        await tx
          .update(schema.orders)
          .set({ state: orderState, updatedAt: new Date() })
          .where(eq(schema.orders.id, orderId));

        await tx
          .update(schema.branchTables)
          .set({ state: tableState, updatedAt: new Date() })
          .where(eq(schema.branchTables.id, order.tableId));

        // Hybrid Recipe / Inventory Stock Deduction
        const orderItems = await tx
          .select()
          .from(schema.orderItems)
          .where(
            and(
              eq(schema.orderItems.orderId, orderId),
              isNull(schema.orderItems.deletedAt)
            )
          );

        // Get branch to find businessId
        const [branch] = await tx
          .select()
          .from(schema.branches)
          .where(eq(schema.branches.id, order.branchId))
          .limit(1);

        const businessId = branch ? branch.businessId : null;

        if (businessId) {
          // Find primary warehouse for this business
          const [warehouse] = await tx
            .select()
            .from(schema.warehouses)
            .where(
              and(
                eq(schema.warehouses.businessId, businessId),
                eq(schema.warehouses.isActive, true)
              )
            )
            .limit(1);

          let warehouseId = warehouse ? warehouse.id : null;
          if (!warehouseId) {
            const [anyWarehouse] = await tx
              .select()
              .from(schema.warehouses)
              .where(eq(schema.warehouses.businessId, businessId))
              .limit(1);
            warehouseId = anyWarehouse ? anyWarehouse.id : null;
          }

          if (warehouseId) {
            for (const item of orderItems) {
              const qtySold = item.quantity;
              if (qtySold <= 0) continue;

            // Check if product has a recipe
            const recipe = await tx
              .select()
              .from(schema.recipes)
              .where(eq(schema.recipes.parentProductId, item.productId));

            if (recipe.length > 0) {
              // Product has a recipe. Check finished product stock in warehouse
              const [finishedStock] = await tx
                .select()
                .from(schema.stockLevels)
                .where(
                  and(
                    eq(schema.stockLevels.productId, item.productId),
                    eq(schema.stockLevels.warehouseId, warehouseId)
                  )
                )
                .limit(1);

              const availableFinishedQty = finishedStock ? parseFloat(finishedStock.quantity) : 0;

              if (availableFinishedQty > 0) {
                const coveredQty = Math.min(qtySold, availableFinishedQty);
                const remainingQtyToDeduct = qtySold - coveredQty;

                // Decrement finished stock level
                const newFinishedQty = availableFinishedQty - coveredQty;
                await tx
                  .update(schema.stockLevels)
                  .set({
                    quantity: newFinishedQty.toString(),
                    updatedAt: new Date(),
                  })
                  .where(eq(schema.stockLevels.id, finishedStock.id));

                if (remainingQtyToDeduct > 0) {
                  await deductIngredients(tx, recipe, remainingQtyToDeduct, warehouseId);
                }
              } else {
                await deductIngredients(tx, recipe, qtySold, warehouseId);
              }
            } else {
              // Product doesn't have a recipe. Deduct directly from product stock level
              await deductDirectStock(tx, item.productId, qtySold, warehouseId);
            }
          }
        }
      }
    }

      return {
        payment: newPayment,
        orderState,
        tableState,
        totalPaid: totalPaid.toFixed(2),
        isFullyPaid: totalPaid >= orderTotal,
      };
    });
  }
}

async function deductIngredients(tx: any, recipe: any[], quantity: number, warehouseId: string) {
  for (const item of recipe) {
    const requiredQty = parseFloat(item.quantityNeeded) * quantity;
    await deductDirectStock(tx, item.ingredientProductId, requiredQty, warehouseId);
  }
}

async function deductDirectStock(tx: any, productId: string, quantity: number, warehouseId: string) {
  const [stock] = await tx
    .select()
    .from(schema.stockLevels)
    .where(
      and(
        eq(schema.stockLevels.productId, productId),
        eq(schema.stockLevels.warehouseId, warehouseId)
      )
    )
    .limit(1);

  if (stock) {
    const newQty = (parseFloat(stock.quantity) - quantity).toString();
    await tx
      .update(schema.stockLevels)
      .set({
        quantity: newQty,
        updatedAt: new Date(),
      })
      .where(eq(schema.stockLevels.id, stock.id));
  } else {
    await tx
      .insert(schema.stockLevels)
      .values({
        productId,
        warehouseId,
        quantity: (-quantity).toString(),
        updatedAt: new Date(),
      });
  }

  // Record stock movement
  const [product] = await tx
    .select()
    .from(schema.products)
    .where(eq(schema.products.id, productId))
    .limit(1);

  if (product) {
    await tx.insert(schema.inventoryMovements).values({
      businessId: product.businessId,
      productId,
      warehouseId,
      quantity: (-quantity).toString(),
      type: 'sale',
      notes: `Venta POS`,
    });
  }
}
