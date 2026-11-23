import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, isNull, inArray, desc, asc } from 'drizzle-orm';

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

  async findByIdWithItems(id: string, exec: Pick<NodePgDatabase<typeof schema>, 'select'> = this.db) {
    const results = await exec
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

    const items = await exec
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

  async findByStatuses(businessId: string, statuses: string[]) {
    const all = await this.findAll(businessId);
    return all.filter((po) => statuses.includes(po.status));
  }

  /** Every entrada line, oldest first, with product and actor names. */
  async findReceiptLedger(purchaseOrderId: string) {
    return this.db
      .select({
        id: schema.purchaseOrderReceiptLedger.id,
        receiptId: schema.purchaseOrderReceiptLedger.receiptId,
        productId: schema.purchaseOrderReceiptLedger.productId,
        productName: schema.products.name,
        quantityOrdered: schema.purchaseOrderReceiptLedger.quantityOrdered,
        previouslyReceived: schema.purchaseOrderReceiptLedger.previouslyReceived,
        quantityReceived: schema.purchaseOrderReceiptLedger.quantityReceived,
        pendingAfter: schema.purchaseOrderReceiptLedger.pendingAfter,
        quantityDifference: schema.purchaseOrderReceiptLedger.quantityDifference,
        unitCostEstimated: schema.purchaseOrderReceiptLedger.unitCostEstimated,
        unitCostActual: schema.purchaseOrderReceiptLedger.unitCostActual,
        costDifference: schema.purchaseOrderReceiptLedger.costDifference,
        note: schema.purchaseOrderReceiptLedger.note,
        documentNumber: schema.purchaseOrderReceiptLedger.documentNumber,
        actorName: schema.users.name,
        actorRole: schema.purchaseOrderReceiptLedger.actorRole,
        source: schema.purchaseOrderReceiptLedger.source,
        createdAt: schema.purchaseOrderReceiptLedger.createdAt,
      })
      .from(schema.purchaseOrderReceiptLedger)
      .leftJoin(schema.products, eq(schema.purchaseOrderReceiptLedger.productId, schema.products.id))
      .leftJoin(schema.users, eq(schema.purchaseOrderReceiptLedger.actorId, schema.users.id))
      .where(eq(schema.purchaseOrderReceiptLedger.purchaseOrderId, purchaseOrderId))
      .orderBy(asc(schema.purchaseOrderReceiptLedger.createdAt), asc(schema.purchaseOrderReceiptLedger.id));
  }
}
