import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and } from 'drizzle-orm';

export interface UpsertThresholdInput {
  businessId: string;
  productId: string;
  branchId: string;
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
}
