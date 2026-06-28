import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, isNull } from 'drizzle-orm';

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
        isIngredient: schema.products.isIngredient,
        quantity: schema.stockLevels.quantity,
        updatedAt: schema.stockLevels.updatedAt,
        warehouseId: schema.stockLevels.warehouseId,
        branchId: schema.stockLevels.branchId,
      })
      .from(schema.stockLevels)
      .innerJoin(schema.products, eq(schema.stockLevels.productId, schema.products.id))
      .where(
        and(
          eq(schema.products.businessId, businessId),
          ...conditions,
        )
      );
  }

  async getReceipts(businessId: string) {
    return this.db
      .select({
        id: schema.inventoryReceipts.id,
        providerName: schema.providers.name,
        documentNumber: schema.inventoryReceipts.documentNumber,
        receivedAt: schema.inventoryReceipts.receivedAt,
        notes: schema.inventoryReceipts.notes,
        warehouseName: schema.warehouses.name,
        branchName: schema.branches.name,
      })
      .from(schema.inventoryReceipts)
      .innerJoin(schema.providers, eq(schema.inventoryReceipts.providerId, schema.providers.id))
      .leftJoin(schema.warehouses, eq(schema.inventoryReceipts.warehouseId, schema.warehouses.id))
      .leftJoin(schema.branches, eq(schema.inventoryReceipts.branchId, schema.branches.id))
      .where(eq(schema.inventoryReceipts.businessId, businessId));
  }
}
