import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, isNull, inArray, desc } from 'drizzle-orm';

@Injectable()
export class PurchaseOrdersRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findAll(businessId: string) {
    const orders = await this.db
      .select({
        purchaseOrder: schema.purchaseOrders,
        providerName: schema.providers.name,
        warehouseName: schema.warehouses.name,
      })
      .from(schema.purchaseOrders)
      .leftJoin(schema.providers, eq(schema.purchaseOrders.providerId, schema.providers.id))
      .leftJoin(schema.warehouses, eq(schema.purchaseOrders.warehouseId, schema.warehouses.id))
      .where(
        and(
          eq(schema.purchaseOrders.businessId, businessId),
          isNull(schema.purchaseOrders.deletedAt),
        ),
      )
      .orderBy(desc(schema.purchaseOrders.createdAt));

    if (orders.length === 0) return [];

    const orderIds = orders.map((o) => o.purchaseOrder.id);

    const items = await this.db
      .select({
        purchaseOrderItem: schema.purchaseOrderItems,
        productName: schema.products.name,
        unit: schema.products.uom,
      })
      .from(schema.purchaseOrderItems)
      .leftJoin(schema.products, eq(schema.purchaseOrderItems.productId, schema.products.id))
      .where(inArray(schema.purchaseOrderItems.poId, orderIds));

    const itemsMap = new Map<string, any[]>();
    for (const item of items) {
      const list = itemsMap.get(item.purchaseOrderItem.poId) || [];
      list.push({
        ...item.purchaseOrderItem,
        productName: item.productName || 'Insumo',
        unit: item.unit || 'pza',
      });
      itemsMap.set(item.purchaseOrderItem.poId, list);
    }

    return orders.map((o) => {
      const poItems = itemsMap.get(o.purchaseOrder.id) || [];
      return {
        ...o.purchaseOrder,
        providerName: o.providerName || null,
        warehouseName: o.warehouseName || null,
        itemCount: poItems.length,
        items: poItems,
      };
    });
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
    const results = await this.db
      .select({
        purchaseOrder: schema.purchaseOrders,
        providerName: schema.providers.name,
        warehouseName: schema.warehouses.name,
      })
      .from(schema.purchaseOrders)
      .leftJoin(schema.providers, eq(schema.purchaseOrders.providerId, schema.providers.id))
      .leftJoin(schema.warehouses, eq(schema.purchaseOrders.warehouseId, schema.warehouses.id))
      .where(
        and(
          eq(schema.purchaseOrders.id, id),
          isNull(schema.purchaseOrders.deletedAt),
        ),
      );

    const orderRow = results[0];
    if (!orderRow) return null;

    const items = await this.db
      .select({
        purchaseOrderItem: schema.purchaseOrderItems,
        productName: schema.products.name,
        unit: schema.products.uom,
      })
      .from(schema.purchaseOrderItems)
      .leftJoin(schema.products, eq(schema.purchaseOrderItems.productId, schema.products.id))
      .where(eq(schema.purchaseOrderItems.poId, id));

    return {
      ...orderRow.purchaseOrder,
      providerName: orderRow.providerName || null,
      warehouseName: orderRow.warehouseName || null,
      itemCount: items.length,
      items: items.map((i) => ({
        ...i.purchaseOrderItem,
        productName: i.productName || 'Insumo',
        unit: i.unit || 'pza',
      })),
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
