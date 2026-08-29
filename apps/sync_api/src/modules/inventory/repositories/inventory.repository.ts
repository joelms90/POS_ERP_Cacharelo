import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

@Injectable()
export class InventoryRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  getDb() {
    return this.db;
  }

  async getStockLevels(businessId: string, warehouseId?: string, branchId?: string) {
    const conditions = [];
    if (warehouseId) {
      conditions.push(eq(schema.stockLevels.warehouseId, warehouseId));
    }
    if (branchId) {
      conditions.push(eq(schema.stockLevels.branchId, branchId));
    }
    
    return this.db
      .select({
        id: schema.stockLevels.id,
        productId: schema.stockLevels.productId,
        productName: schema.products.name,
        sku: schema.products.sku,
        internalCode: schema.products.internalCode,
        itemType: schema.products.itemType,
        uom: schema.products.uom,
        warehouseId: schema.stockLevels.warehouseId,
        warehouseName: schema.warehouses.name,
        warehouseLocationType: schema.warehouses.locationType,
        branchId: schema.stockLevels.branchId,
        branchName: schema.branches.name,
        quantity: schema.stockLevels.quantity,
        updatedAt: schema.stockLevels.updatedAt,
      })
      .from(schema.stockLevels)
      .innerJoin(schema.products, eq(schema.stockLevels.productId, schema.products.id))
      .leftJoin(schema.warehouses, eq(schema.stockLevels.warehouseId, schema.warehouses.id))
      .leftJoin(schema.branches, eq(schema.stockLevels.branchId, schema.branches.id))
      .where(
        and(
          eq(schema.products.businessId, businessId),
          ...conditions,
        ),
      );
  }

  async getReceipts(businessId: string) {
    return this.db
      .select({
        id: schema.inventoryReceipts.id,
        providerId: schema.inventoryReceipts.providerId,
        providerName: schema.providers.name,
        documentNumber: schema.inventoryReceipts.documentNumber,
        warehouseId: schema.inventoryReceipts.warehouseId,
        warehouseName: schema.warehouses.name,
        branchId: schema.inventoryReceipts.branchId,
        branchName: schema.branches.name,
        receivedAt: schema.inventoryReceipts.receivedAt,
        notes: schema.inventoryReceipts.notes,
      })
      .from(schema.inventoryReceipts)
      .innerJoin(schema.providers, eq(schema.inventoryReceipts.providerId, schema.providers.id))
      .leftJoin(schema.warehouses, eq(schema.inventoryReceipts.warehouseId, schema.warehouses.id))
      .leftJoin(schema.branches, eq(schema.inventoryReceipts.branchId, schema.branches.id))
      .where(eq(schema.inventoryReceipts.businessId, businessId));
  }

  async getProductionRuns(businessId: string) {
    const originWarehouse = alias(schema.warehouses, 'origin_warehouse');
    const destinationWarehouse = alias(schema.warehouses, 'destination_warehouse');

    return this.db
      .select({
        id: schema.productionRuns.id,
        warehouseId: schema.productionRuns.warehouseId,
        warehouseName: originWarehouse.name,
        destinationWarehouseId: schema.productionRuns.destinationWarehouseId,
        destinationWarehouseName: destinationWarehouse.name,
        productId: schema.productionRuns.productId,
        productName: schema.products.name,
        productSku: schema.products.sku,
        quantityProduced: schema.productionRuns.quantityProduced,
        actualQuantityProduced: schema.productionRuns.actualQuantityProduced,
        status: schema.productionRuns.status,
        startedAt: schema.productionRuns.startedAt,
        assembledAt: schema.productionRuns.assembledAt,
        notes: schema.productionRuns.notes,
        createdAt: schema.productionRuns.createdAt,
      })
      .from(schema.productionRuns)
      .innerJoin(originWarehouse, eq(schema.productionRuns.warehouseId, originWarehouse.id))
      .leftJoin(destinationWarehouse, eq(schema.productionRuns.destinationWarehouseId, destinationWarehouse.id))
      .innerJoin(schema.products, eq(schema.productionRuns.productId, schema.products.id))
      .where(eq(originWarehouse.businessId, businessId))
      .orderBy(desc(schema.productionRuns.createdAt));
  }
}
