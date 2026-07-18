import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, isNull, count, inArray } from 'drizzle-orm';

@Injectable()
export class PurchaseOrdersRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findAll(businessId: string) {
    const orders = await this.db
      .select()
      .from(schema.purchaseOrders)
      .where(
        and(
          eq(schema.purchaseOrders.businessId, businessId),
          isNull(schema.purchaseOrders.deletedAt),
        ),
      )
      .orderBy(schema.purchaseOrders.createdAt);

    if (orders.length === 0) return [];

    const orderIds = orders.map((o) => o.id);

    const itemCounts = await this.db
      .select({
        poId: schema.purchaseOrderItems.poId,
        itemCount: count(schema.purchaseOrderItems.id),
      })
      .from(schema.purchaseOrderItems)
      .where(inArray(schema.purchaseOrderItems.poId, orderIds))
      .groupBy(schema.purchaseOrderItems.poId);

    const countMap = new Map(itemCounts.map((ic) => [ic.poId, Number(ic.itemCount)]));

    return orders.map((o) => ({
      ...o,
      itemCount: countMap.get(o.id) || 0,
    }));
  }

  async findById(id: string) {
    const results = await this.db
      .select()
      .from(schema.purchaseOrders)
      .where(
        and(
          eq(schema.purchaseOrders.id, id),
          isNull(schema.purchaseOrders.deletedAt),
        ),
      );
    return results[0] || null;
  }

  async findByIdWithItems(id: string) {
    const order = await this.findById(id);
    if (!order) return null;

    const items = await this.db
      .select()
      .from(schema.purchaseOrderItems)
      .where(eq(schema.purchaseOrderItems.poId, id));

    return {
      ...order,
      items,
    };
  }

  async create(data: {
    businessId: string;
    providerId: string;
    warehouseId: string;
    orderNumber: string;
    createdBy: string;
    notes?: string;
    items: Array<{
      productId: string;
      quantity: number;
      estimatedUnitCost: number;
    }>;
  }) {
    return await this.db.transaction(async (tx) => {
      // Create purchase order
      const [order] = await tx
        .insert(schema.purchaseOrders)
        .values({
          businessId: data.businessId,
          providerId: data.providerId,
          warehouseId: data.warehouseId,
          poNumber: data.orderNumber,
          status: 'draft',
          notes: data.notes || null,
          createdBy: data.createdBy,
        })
        .returning();

      // Create purchase order items
      if (data.items && data.items.length > 0) {
        await tx.insert(schema.purchaseOrderItems).values(
          data.items.map((item) => ({
            poId: order.id,
            productId: item.productId,
            quantityOrdered: item.quantity.toString(),
            unitCostEstimated: item.estimatedUnitCost.toString(),
          })),
        );
      }

      const items = data.items && data.items.length > 0
        ? await tx
            .select()
            .from(schema.purchaseOrderItems)
            .where(eq(schema.purchaseOrderItems.poId, order.id))
        : [];

      return { ...order, items };
    });
  }

  async update(id: string, updates: Partial<typeof schema.purchaseOrders.$inferInsert>) {
    const results = await this.db
      .update(schema.purchaseOrders)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.purchaseOrders.id, id))
      .returning();
    return results[0];
  }

  async updateStatus(id: string, status: 'draft' | 'sent' | 'received' | 'cancelled') {
    return this.update(id, { status });
  }

  async softDelete(id: string) {
    const results = await this.db
      .update(schema.purchaseOrders)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.purchaseOrders.id, id))
      .returning();
    return results[0];
  }
}
