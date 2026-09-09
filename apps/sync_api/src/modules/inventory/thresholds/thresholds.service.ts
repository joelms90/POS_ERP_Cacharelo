import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, sql, gte, isNull } from 'drizzle-orm';

export interface UpsertThresholdInput {
  businessId: string;
  productId: string;
  branchId: string;
  minStock?: number;
  maxStock?: number;
  updatedBy?: string;
}

export interface UpsertWarehouseThresholdInput {
  businessId: string;
  productId: string;
  warehouseId: string;
  minStock?: number;
  maxStock?: number;
  updatedBy?: string;
}

@Injectable()
export class ThresholdsService {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async upsert(input: UpsertThresholdInput) {
    const { businessId, productId, branchId, minStock, maxStock, updatedBy } = input;

    // Validate product and branch belong to the business
    const [product] = await this.db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(
        and(eq(schema.products.id, productId), eq(schema.products.businessId, businessId)),
      )
      .limit(1);

    if (!product) {
      throw new BadRequestException('El producto no pertenece a este negocio.');
    }

    const [branch] = await this.db
      .select({ id: schema.branches.id })
      .from(schema.branches)
      .where(and(eq(schema.branches.id, branchId), eq(schema.branches.businessId, businessId)))
      .limit(1);

    if (!branch) {
      throw new BadRequestException('La sucursal no pertenece a este negocio.');
    }

    const [existing] = await this.db
      .select()
      .from(schema.branchStockThresholds)
      .where(
        and(
          eq(schema.branchStockThresholds.productId, productId),
          eq(schema.branchStockThresholds.branchId, branchId),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await this.db
        .update(schema.branchStockThresholds)
        .set({
          minStock: minStock != null ? minStock.toString() : existing.minStock,
          maxStock: maxStock != null ? maxStock.toString() : existing.maxStock,
          updatedAt: new Date(),
          updatedBy: updatedBy ?? existing.updatedBy,
        })
        .where(eq(schema.branchStockThresholds.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await this.db
      .insert(schema.branchStockThresholds)
      .values({
        businessId,
        productId,
        branchId,
        minStock: (minStock ?? 0).toString(),
        maxStock: (maxStock ?? 0).toString(),
        updatedBy: updatedBy ?? null,
      })
      .returning();
    return created;
  }

  async remove(id: string) {
    await this.db.delete(schema.branchStockThresholds).where(eq(schema.branchStockThresholds.id, id));
    return { success: true };
  }

  async listByBusiness(businessId: string, branchId?: string) {
    const conditions = [eq(schema.branchStockThresholds.businessId, businessId)];
    if (branchId) {
      conditions.push(eq(schema.branchStockThresholds.branchId, branchId));
    }

    return this.db
      .select({
        id: schema.branchStockThresholds.id,
        productId: schema.branchStockThresholds.productId,
        branchId: schema.branchStockThresholds.branchId,
        minStock: schema.branchStockThresholds.minStock,
        maxStock: schema.branchStockThresholds.maxStock,
        productName: schema.products.name,
        branchName: schema.branches.name,
      })
      .from(schema.branchStockThresholds)
      .innerJoin(schema.products, eq(schema.branchStockThresholds.productId, schema.products.id))
      .innerJoin(schema.branches, eq(schema.branchStockThresholds.branchId, schema.branches.id))
      .where(and(...conditions));
  }

  async getEffectiveThreshold(
    productId: string,
    branchId: string,
    productMin: number,
    productMax: number,
  ) {
    const [threshold] = await this.db
      .select()
      .from(schema.branchStockThresholds)
      .where(
        and(
          eq(schema.branchStockThresholds.productId, productId),
          eq(schema.branchStockThresholds.branchId, branchId),
        ),
      )
      .limit(1);

    const min = threshold && parseFloat(threshold.minStock || '0') > 0
      ? parseFloat(threshold.minStock || '0')
      : productMin;
    const max = threshold && parseFloat(threshold.maxStock || '0') > 0
      ? parseFloat(threshold.maxStock || '0')
      : productMax;

    return { minStock: min, maxStock: max, hasOverride: !!threshold };
  }

  // ---------------------------------------------------------------------------
  // Warehouse thresholds (bodegas / fábricas)
  // ---------------------------------------------------------------------------

  async upsertWarehouse(input: UpsertWarehouseThresholdInput) {
    const { businessId, productId, warehouseId, minStock, maxStock, updatedBy } = input;

    const [product] = await this.db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(
        and(eq(schema.products.id, productId), eq(schema.products.businessId, businessId)),
      )
      .limit(1);

    if (!product) {
      throw new BadRequestException('El producto no pertenece a este negocio.');
    }

    const [warehouse] = await this.db
      .select({ id: schema.warehouses.id })
      .from(schema.warehouses)
      .where(
        and(eq(schema.warehouses.id, warehouseId), eq(schema.warehouses.businessId, businessId)),
      )
      .limit(1);

    if (!warehouse) {
      throw new BadRequestException('La bodega no pertenece a este negocio.');
    }

    const [existing] = await this.db
      .select()
      .from(schema.warehouseStockThresholds)
      .where(
        and(
          eq(schema.warehouseStockThresholds.productId, productId),
          eq(schema.warehouseStockThresholds.warehouseId, warehouseId),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await this.db
        .update(schema.warehouseStockThresholds)
        .set({
          minStock: minStock != null ? minStock.toString() : existing.minStock,
          maxStock: maxStock != null ? maxStock.toString() : existing.maxStock,
          updatedAt: new Date(),
          updatedBy: updatedBy ?? existing.updatedBy,
        })
        .where(eq(schema.warehouseStockThresholds.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await this.db
      .insert(schema.warehouseStockThresholds)
      .values({
        businessId,
        productId,
        warehouseId,
        minStock: (minStock ?? 0).toString(),
        maxStock: (maxStock ?? 0).toString(),
        updatedBy: updatedBy ?? null,
      })
      .returning();
    return created;
  }

  async removeWarehouse(id: string) {
    await this.db
      .delete(schema.warehouseStockThresholds)
      .where(eq(schema.warehouseStockThresholds.id, id));
    return { success: true };
  }

  async listWarehousesByBusiness(businessId: string, warehouseId?: string) {
    const conditions = [eq(schema.warehouseStockThresholds.businessId, businessId)];
    if (warehouseId) {
      conditions.push(eq(schema.warehouseStockThresholds.warehouseId, warehouseId));
    }

    return this.db
      .select({
        id: schema.warehouseStockThresholds.id,
        productId: schema.warehouseStockThresholds.productId,
        warehouseId: schema.warehouseStockThresholds.warehouseId,
        minStock: schema.warehouseStockThresholds.minStock,
        maxStock: schema.warehouseStockThresholds.maxStock,
        productName: schema.products.name,
        warehouseName: schema.warehouses.name,
      })
      .from(schema.warehouseStockThresholds)
      .innerJoin(schema.products, eq(schema.warehouseStockThresholds.productId, schema.products.id))
      .innerJoin(schema.warehouses, eq(schema.warehouseStockThresholds.warehouseId, schema.warehouses.id))
      .where(and(...conditions));
  }

  async getEffectiveWarehouseThreshold(
    productId: string,
    warehouseId: string,
    productMin: number,
    productMax: number,
  ) {
    const [threshold] = await this.db
      .select()
      .from(schema.warehouseStockThresholds)
      .where(
        and(
          eq(schema.warehouseStockThresholds.productId, productId),
          eq(schema.warehouseStockThresholds.warehouseId, warehouseId),
        ),
      )
      .limit(1);

    const min = threshold && parseFloat(threshold.minStock || '0') > 0
      ? parseFloat(threshold.minStock || '0')
      : productMin;
    const max = threshold && parseFloat(threshold.maxStock || '0') > 0
      ? parseFloat(threshold.maxStock || '0')
      : productMax;

    return { minStock: min, maxStock: max, hasOverride: !!threshold };
  }

  /**
   * Suggest min/max stock for a business's products based on weekly sales
   * average over the last N weeks.
   *
   * suggestedMin = 1 week of sales (safety stock).
   * suggestedMax = 2 weeks of sales (reorder ceiling).
   */
  async getSuggestions(businessId: string, weeks = 4) {
    const weeksNum = Math.max(1, Math.min(Number(weeks) || 4, 12));
    const since = new Date();
    since.setDate(since.getDate() - weeksNum * 7);

    const rows = await this.db
      .select({
        productId: schema.orderItems.productId,
        productName: schema.products.name,
        totalQty: sql<string>`COALESCE(SUM(${schema.orderItems.quantity}), 0)::int`,
      })
      .from(schema.orderItems)
      .innerJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .innerJoin(schema.branches, eq(schema.orders.branchId, schema.branches.id))
      .where(
        and(
          eq(schema.branches.businessId, businessId),
          eq(schema.orders.state, 'closed'),
          isNull(schema.orders.deletedAt),
          isNull(schema.orderItems.deletedAt),
          gte(schema.orders.createdAt, since),
        ),
      )
      .groupBy(schema.orderItems.productId, schema.products.name);

    const round3 = (n: number) => Math.round(n * 1000) / 1000;

    return rows
      .map((r) => {
        const total = parseFloat(r.totalQty || '0');
        const weeklyAverage = round3(total / weeksNum);
        return {
          productId: r.productId,
          productName: r.productName,
          weeklyAverage,
          suggestedMin: Math.ceil(weeklyAverage),
          suggestedMax: Math.ceil(weeklyAverage * 2),
        };
      })
      .filter((s) => s.weeklyAverage > 0)
      .sort((a, b) => b.weeklyAverage - a.weeklyAverage);
  }
}
