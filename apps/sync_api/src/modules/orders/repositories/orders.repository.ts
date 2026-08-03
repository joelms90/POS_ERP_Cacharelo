import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import * as crypto from 'crypto';

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

  async createPayment(
    orderId: string,
    paymentData: {
      orderId: string;
      amount: string;
      paymentMethod: string;
      referenceCode: string | null;
      paidOrderItemIds?: string[];
    },
  ) {
    return this.db.transaction(async (tx) => {
      const { paidOrderItemIds, ...payData } = paymentData;

      // Lock the order row to serialize concurrent payments for the same order.
      // This prevents race conditions when multiple payments arrive simultaneously
      // (e.g. by-items flow where checkoutTable is called multiple times).
      const [order] = await tx
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId))
        .for('update');

      if (!order) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      const now = new Date();

      let processedByItems = false;

      if (paidOrderItemIds && paidOrderItemIds.length > 0) {
        // --- SPLIT BY ITEMS FLOW ---
        // Fetch the items to be paid
        const itemsToPay = await tx
          .select()
          .from(schema.orderItems)
          .where(
            and(
              eq(schema.orderItems.orderId, orderId),
              sql`id = ANY(${paidOrderItemIds})`,
              isNull(schema.orderItems.deletedAt),
            ),
          );

        if (itemsToPay.length > 0) {
          // 1. Create a new closed order for the paid items
          const newOrderId = crypto.randomUUID();

          // Calculate totals for the paid items
          let paidSubtotal = 0;
          for (const item of itemsToPay) {
            paidSubtotal += parseFloat(item.price) * item.quantity;
          }
          const paidTax = paidSubtotal * 0.16;

          // Apply the original order's discount percentage to these items
          const originalSubtotal = parseFloat(order.subtotal);
          const originalDiscount = parseFloat(order.discount);
          const discountRatio = originalSubtotal > 0 ? (originalDiscount / originalSubtotal) : 0;
          const itemDiscount = paidSubtotal * discountRatio;
          const itemTotal = paidSubtotal - itemDiscount + paidTax;

          // Create the new closed order record
          const [closedOrder] = await tx
            .insert(schema.orders)
            .values({
              id: newOrderId,
              branchId: order.branchId,
              tableId: order.tableId,
              waiterId: order.waiterId,
              state: 'closed',
              subtotal: paidSubtotal.toFixed(2),
              discount: itemDiscount.toFixed(2),
              tax: paidTax.toFixed(2),
              total: itemTotal.toFixed(2),
              createdAt: order.createdAt,
              updatedAt: now,
            })
            .returning();

          // Move the paid items to the new order
          for (const item of itemsToPay) {
            await tx
              .update(schema.orderItems)
              .set({ orderId: newOrderId, updatedAt: now })
              .where(eq(schema.orderItems.id, item.id));
          }

          // Insert the payment associated with the new closed order
          const [newPayment] = await tx
            .insert(schema.payments)
            .values({
              orderId: newOrderId,
              amount: payData.amount,
              paymentMethod: payData.paymentMethod,
              referenceCode: payData.referenceCode,
            })
            .returning();

          // 2. Update the original order's totals with remaining items
          const remainingItems = await tx
            .select()
            .from(schema.orderItems)
            .where(
              and(
                eq(schema.orderItems.orderId, orderId),
                isNull(schema.orderItems.deletedAt),
              ),
            );

          let tableState = 'occupied';
          let orderState = order.state;

          if (remainingItems.length === 0) {
            // If no items remain, close the original order too!
            orderState = 'closed';
            const [table] = await tx
              .select()
              .from(schema.branchTables)
              .where(eq(schema.branchTables.id, order.tableId));

            tableState = (table && table.room === 'Para Llevar') ? 'free' : 'cleaning';

            await tx
              .update(schema.orders)
              .set({
                state: 'closed',
                subtotal: '0.00',
                discount: '0.00',
                tax: '0.00',
                total: '0.00',
                updatedAt: now,
              })
              .where(eq(schema.orders.id, orderId));

            await tx
              .update(schema.branchTables)
              .set({ state: tableState, updatedAt: now })
              .where(eq(schema.branchTables.id, order.tableId));
          } else {
            // Recalculate remaining order totals
            let remSubtotal = 0;
            for (const item of remainingItems) {
              remSubtotal += parseFloat(item.price) * item.quantity;
            }
            const remDiscount = remSubtotal * discountRatio;
            const remTax = remSubtotal * 0.16;
            const remTotal = remSubtotal - remDiscount + remTax;

            // Preserve current table state (e.g. billing)
            const [table] = await tx
              .select()
              .from(schema.branchTables)
              .where(eq(schema.branchTables.id, order.tableId));
            tableState = table ? table.state : 'billing';

            await tx
              .update(schema.orders)
              .set({
                subtotal: remSubtotal.toFixed(2),
                discount: remDiscount.toFixed(2),
                tax: remTax.toFixed(2),
                total: remTotal.toFixed(2),
                updatedAt: now,
              })
              .where(eq(schema.orders.id, orderId));
          }

          // Deduct inventory stock for the moved paid items
          await this.deductInventoryForItems(tx, itemsToPay, order.branchId);

          processedByItems = true;

          return {
            payment: newPayment,
            orderState,
            tableState,
            totalPaid: payData.amount,
            isFullyPaid: remainingItems.length === 0,
            splitOrder: closedOrder,
          };
        }

        // Items not found — may have been moved by a concurrent payment.
        // Fall through to the normal payment flow gracefully instead of throwing.
        console.warn(
          `createPayment: No items found for paidOrderItemIds in order ${orderId}. ` +
          `Falling back to normal payment flow. Ids: ${paidOrderItemIds.join(', ')}`,
        );
      }

      if (!processedByItems) {
        // --- NORMAL / EQUAL SPLIT FLOW ---
        // 1. Insert payment record
        const [newPayment] = await tx
          .insert(schema.payments)
          .values(payData)
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
        const orderTotal = parseFloat(order.total);

        let orderState = order.state;

        // Get current table state to preserve it
        const [table] = await tx
          .select()
          .from(schema.branchTables)
          .where(eq(schema.branchTables.id, order.tableId));
        let tableState = table ? table.state : 'occupied';

        const isFullyPaid = totalPaid >= orderTotal;

        // 4. If paid in full, close the order and set table to 'cleaning' (or 'free' for 'Para Llevar')
        if (isFullyPaid) {
          orderState = 'closed';
          tableState = (table && table.room === 'Para Llevar') ? 'free' : 'cleaning';

          await tx
            .update(schema.orders)
            .set({ state: orderState, updatedAt: now })
            .where(eq(schema.orders.id, orderId));

          await tx
            .update(schema.branchTables)
            .set({ state: tableState, updatedAt: now })
            .where(eq(schema.branchTables.id, order.tableId));

          // Deduct inventory stock for the whole order items
          const orderItems = await tx
            .select()
            .from(schema.orderItems)
            .where(
              and(
                eq(schema.orderItems.orderId, orderId),
                isNull(schema.orderItems.deletedAt)
              )
            );
          await this.deductInventoryForItems(tx, orderItems, order.branchId);
        }

        return {
          payment: newPayment,
          orderState,
          tableState,
          totalPaid: totalPaid.toFixed(2),
          isFullyPaid,
        };
      }
    });
  }

  async deductInventoryForItems(tx: any, orderItems: any[], branchId: string) {
    // Get branch to find businessId
    const [branch] = await tx
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.id, branchId))
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
