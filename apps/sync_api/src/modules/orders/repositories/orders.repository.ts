import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, isNull, sql, inArray } from 'drizzle-orm';
import * as crypto from 'crypto';
import { LedgerService } from '../../inventory/ledger.service';

@Injectable()
export class OrdersRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly ledgerService: LedgerService,
  ) {}

  async findById(id: string) {
    return this.hydrateOrder(this.db, id);
  }

  private async hydrateOrder(db: any, id: string) {
    const order = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, id));

    if (order.length === 0) return null;

    const items = await db
      .select()
      .from(schema.orderItems)
      .where(
        and(
          eq(schema.orderItems.orderId, id),
          isNull(schema.orderItems.deletedAt),
        ),
      );

    const payments = await db
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

  async findActiveByBusiness(businessId: string) {
    const branchIds = await this.db
      .select({ id: schema.branches.id })
      .from(schema.branches)
      .where(eq(schema.branches.businessId, businessId))
      .then((rows) => rows.map((r) => r.id));

    if (branchIds.length === 0) return [];

    const rows = await this.db
      .select({
        orderId: schema.orders.id,
        orderState: schema.orders.state,
        orderTotal: schema.orders.total,
        orderSubtotal: schema.orders.subtotal,
        orderTax: schema.orders.tax,
        orderDiscount: schema.orders.discount,
        orderCreatedAt: schema.orders.createdAt,
        branchId: schema.orders.branchId,
        branchName: schema.branches.name,
        tableId: schema.orders.tableId,
        tableLabel: schema.branchTables.label,
        tableRoom: schema.branchTables.room,
        waiterName: schema.users.name,
        itemId: schema.orderItems.id,
        itemQuantity: schema.orderItems.quantity,
        itemPrice: schema.orderItems.price,
        itemNotes: schema.orderItems.notes,
        itemAssignedGuest: schema.orderItems.assignedGuest,
        productName: schema.products.name,
        paymentAmount: schema.payments.amount,
        paymentMethod: schema.payments.paymentMethod,
        paymentRef: schema.payments.referenceCode,
      })
      .from(schema.orders)
      .innerJoin(schema.branches, eq(schema.orders.branchId, schema.branches.id))
      .innerJoin(schema.branchTables, eq(schema.orders.tableId, schema.branchTables.id))
      .innerJoin(schema.users, eq(schema.orders.waiterId, schema.users.id))
      .leftJoin(schema.orderItems, and(
        eq(schema.orderItems.orderId, schema.orders.id),
        isNull(schema.orderItems.deletedAt),
      ))
      .leftJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
      .leftJoin(schema.payments, eq(schema.payments.orderId, schema.orders.id))
      .where(
        and(
          inArray(schema.orders.branchId, branchIds),
          isNull(schema.orders.deletedAt),
          sql`${schema.orders.state} IN ('open', 'billing')`,
        ),
      )
      .orderBy(schema.orders.createdAt);

    // Group flat rows back into orders
    const orderMap = new Map<string, any>();
    for (const row of rows) {
      if (!orderMap.has(row.orderId)) {
        orderMap.set(row.orderId, {
          id: row.orderId,
          state: row.orderState,
          total: row.orderTotal,
          subtotal: row.orderSubtotal,
          tax: row.orderTax,
          discount: row.orderDiscount,
          createdAt: row.orderCreatedAt,
          branchId: row.branchId,
          branchName: row.branchName,
          tableLabel: row.tableLabel,
          tableRoom: row.tableRoom,
          waiterName: row.waiterName,
          items: [],
          payments: [],
        });
      }
      const order = orderMap.get(row.orderId);
      if (row.itemId && !order.items.find((i: any) => i.id === row.itemId)) {
        order.items.push({
          id: row.itemId,
          quantity: row.itemQuantity,
          price: row.itemPrice,
          notes: row.itemNotes,
          assignedGuest: row.itemAssignedGuest,
          productName: row.productName,
        });
      }
      if (row.paymentAmount != null && !order.payments.find((p: any) => p.amount === row.paymentAmount && p.method === row.paymentMethod)) {
        order.payments.push({
          amount: row.paymentAmount,
          method: row.paymentMethod,
          reference: row.paymentRef,
        });
      }
    }

    return Array.from(orderMap.values());
  }

  async create(orderData: typeof schema.orders.$inferInsert, itemsData: Omit<typeof schema.orderItems.$inferInsert, 'orderId'>[]) {
    return this.db.transaction(async (tx) => {
      if (orderData.clientUuid) {
        const existing = await tx
          .select({ id: schema.orders.id })
          .from(schema.orders)
          .where(eq(schema.orders.clientUuid, orderData.clientUuid));
        if (existing[0]?.id) {
          return this.hydrateOrder(tx, existing[0].id);
        }
      }

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
      const clientUuids = itemsData
        .map((item) => item.clientUuid)
        .filter((clientUuid): clientUuid is string => Boolean(clientUuid));
      let itemsToCreate = itemsData;
      if (clientUuids.length > 0) {
        const existingItems = await tx
          .select({ clientUuid: schema.orderItems.clientUuid })
          .from(schema.orderItems)
          .where(
            and(
              eq(schema.orderItems.orderId, orderId),
              inArray(schema.orderItems.clientUuid, clientUuids),
              isNull(schema.orderItems.deletedAt),
            ),
          );
        const existingClientUuids = new Set(
          existingItems
            .map((item) => item.clientUuid)
            .filter((clientUuid): clientUuid is string => Boolean(clientUuid)),
        );
        itemsToCreate = itemsData.filter(
          (item) => !item.clientUuid || !existingClientUuids.has(item.clientUuid),
        );
      }

      if (itemsToCreate.length === 0) {
        const order = await this.hydrateOrder(tx, orderId);
        if (!order) {
          throw new NotFoundException(`Order ${orderId} not found`);
        }
        return {
          ...order,
          newItems: [],
        };
      }

      // 1. Insert new items
      const itemsToInsert = itemsToCreate.map((item) => ({
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

  async findExistingOrderItemClientUuids(orderId: string, clientUuids: string[]) {
    if (clientUuids.length === 0) return new Set<string>();

    const rows = await this.db
      .select({ clientUuid: schema.orderItems.clientUuid })
      .from(schema.orderItems)
      .where(
        and(
          eq(schema.orderItems.orderId, orderId),
          inArray(schema.orderItems.clientUuid, clientUuids),
          isNull(schema.orderItems.deletedAt),
        ),
      );

    return new Set(
      rows
        .map((row) => row.clientUuid)
        .filter((clientUuid): clientUuid is string => Boolean(clientUuid)),
    );
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

  async cancelOrderWithAudit(orderId: string, reason: string, cancelledBy: string) {
    return this.db.transaction(async (tx) => {
      const [updatedOrder] = await tx
        .update(schema.orders)
        .set({
          state: 'cancelled',
          cancellationReason: reason,
          cancelledBy,
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.orders.id, orderId))
        .returning();
      await tx.update(schema.branchTables)
        .set({ state: 'free', updatedAt: new Date() })
        .where(eq(schema.branchTables.id, updatedOrder.tableId));
      return updatedOrder;
    });
  }

  async getDailyPaymentSummary(branchId: string, date: string) {
    const rows = await this.db
      .select({
        method: schema.payments.paymentMethod,
        amount: schema.payments.amount,
      })
      .from(schema.payments)
      .innerJoin(schema.orders, eq(schema.payments.orderId, schema.orders.id))
      .where(and(
        eq(schema.orders.branchId, branchId),
        sql`${schema.payments.createdAt} >= ${date}::date`,
        sql`${schema.payments.createdAt} < (${date}::date + interval '1 day')`,
        sql`${schema.orders.state} <> 'cancelled'`,
      ));
    const byMethod: Record<string, number> = {};
    for (const row of rows) byMethod[row.method] = (byMethod[row.method] || 0) + Number(row.amount);
    const cash = byMethod.cash || 0;
    const card = byMethod.card || 0;
    return {
      date,
      branchId,
      transactionCount: rows.length,
      totals: { cash, card, other: Object.entries(byMethod).filter(([method]) => method !== 'cash' && method !== 'card').reduce((sum, [, amount]) => sum + amount, 0), total: rows.reduce((sum, row) => sum + Number(row.amount), 0) },
      byMethod,
    };
  }

  async getTodayTickets(branchId: string, dateStr?: string) {
    const date = dateStr || new Date().toISOString().slice(0, 10);
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
      .leftJoin(schema.branchTables, eq(schema.orders.tableId, schema.branchTables.id))
      .leftJoin(schema.users, eq(schema.orders.waiterId, schema.users.id))
      .where(and(
        eq(schema.orders.branchId, branchId),
        eq(schema.orders.state, 'closed'),
        sql`${schema.orders.createdAt} >= ${date}::date`,
        sql`${schema.orders.createdAt} < (${date}::date + interval '1 day')`,
        isNull(schema.orders.deletedAt),
      ))
      .orderBy(sql`${schema.orders.createdAt} DESC`);

    if (closedOrders.length === 0) {
      return { tickets: [], date };
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
      .leftJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
      .where(and(
        inArray(schema.orderItems.orderId, orderIds),
        isNull(schema.orderItems.deletedAt),
      ));

    const allPayments = await this.db
      .select({
        orderId: schema.payments.orderId,
        amount: schema.payments.amount,
        paymentMethod: schema.payments.paymentMethod,
        referenceCode: schema.payments.referenceCode,
      })
      .from(schema.payments)
      .where(inArray(schema.payments.orderId, orderIds));

    const tickets = closedOrders.map((order) => {
      const items = allItems
        .filter((i) => i.orderId === order.id)
        .map((i) => ({
          quantity: i.quantity,
          productName: i.productName || 'Producto',
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
        tableLabel: order.tableLabel || 'Para Llevar',
        waiterName: order.waiterName || 'Cajero',
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
      date,
      ticketCount: tickets.length,
      tickets,
    };
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

      // Check under the row lock; the service precheck can race another payment.
      if (order.state === 'closed' || order.state === 'cancelled') {
        throw new ConflictException(`Cannot process payment for a ${order.state} order.`);
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
              inArray(schema.orderItems.id, paidOrderItemIds),
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
      for (const item of orderItems) {
        const qtySold = item.quantity;
        if (qtySold <= 0) continue;

        // Check if product has a recipe
        const recipe = await tx
          .select()
          .from(schema.recipes)
          .where(eq(schema.recipes.parentProductId, item.productId));

        if (recipe.length > 0) {
          // Product has a recipe. Check finished product stock at THIS branch
          const [finishedStock] = await tx
            .select()
            .from(schema.stockLevels)
            .where(
              and(
                eq(schema.stockLevels.productId, item.productId),
                eq(schema.stockLevels.branchId, branchId),
              ),
            )
            .limit(1);

          const availableFinishedQty = finishedStock ? parseFloat(finishedStock.quantity) : 0;

          if (availableFinishedQty > 0) {
            const coveredQty = Math.min(qtySold, availableFinishedQty);
            const remainingQtyToDeduct = qtySold - coveredQty;

            // Decrement finished stock via ledger
            await this.ledgerService.applyMovement(tx, {
              businessId,
              productId: item.productId,
              quantityDelta: -coveredQty,
              eventType: 'sale',
              branchId,
              notes: 'Venta POS',
            });

            if (remainingQtyToDeduct > 0) {
              await deductIngredients(this.ledgerService, tx, businessId, recipe, remainingQtyToDeduct, branchId);
            }
          } else {
            await deductIngredients(this.ledgerService, tx, businessId, recipe, qtySold, branchId);
          }
        } else {
          // Product doesn't have a recipe. Deduct directly from product stock at this branch
          await deductDirectStock(this.ledgerService, tx, businessId, item.productId, qtySold, branchId);
        }
      }
    }
  }
}

async function deductIngredients(
  ledgerService: LedgerService,
  tx: any,
  businessId: string,
  recipe: any[],
  quantity: number,
  branchId: string,
) {
  for (const item of recipe) {
    const requiredQty = parseFloat(item.quantityNeeded) * quantity;
    await deductDirectStock(ledgerService, tx, businessId, item.ingredientProductId, requiredQty, branchId);
  }
}

async function deductDirectStock(
  ledgerService: LedgerService,
  tx: any,
  businessId: string,
  productId: string,
  quantity: number,
  branchId: string,
) {
  await ledgerService.applyMovement(tx, {
    businessId,
    productId,
    quantityDelta: -quantity,
    eventType: 'sale',
    branchId,
    notes: 'Venta POS',
  });
}
