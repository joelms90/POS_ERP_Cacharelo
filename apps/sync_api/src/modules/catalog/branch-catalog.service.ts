import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';
import { eq, and } from 'drizzle-orm';

export interface UpsertBranchProductInput {
  businessId: string;
  branchId: string;
  productId: string;
  isSellable: boolean;
}

@Injectable()
export class BranchCatalogService {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async listByBranch(branchId: string) {
    return this.db
      .select({
        id: schema.branchProducts.id,
        branchId: schema.branchProducts.branchId,
        productId: schema.branchProducts.productId,
        isSellable: schema.branchProducts.isSellable,
        isActive: schema.branchProducts.isActive,
        productName: schema.products.name,
        productItemType: schema.products.itemType,
        globalIsSellable: schema.products.isSellable,
      })
      .from(schema.branchProducts)
      .innerJoin(schema.products, eq(schema.branchProducts.productId, schema.products.id))
      .where(
        and(
          eq(schema.branchProducts.branchId, branchId),
          eq(schema.branchProducts.isActive, true),
        ),
      );
  }

  async upsert(input: UpsertBranchProductInput) {
    const { businessId, branchId, productId, isSellable } = input;

    const [branch] = await this.db
      .select({ id: schema.branches.id })
      .from(schema.branches)
      .where(and(eq(schema.branches.id, branchId), eq(schema.branches.businessId, businessId)))
      .limit(1);

    if (!branch) {
      throw new BadRequestException('La sucursal no pertenece a este negocio.');
    }

    const [product] = await this.db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(and(eq(schema.products.id, productId), eq(schema.products.businessId, businessId)))
      .limit(1);

    if (!product) {
      throw new BadRequestException('El producto no pertenece a este negocio.');
    }

    const [existing] = await this.db
      .select()
      .from(schema.branchProducts)
      .where(
        and(
          eq(schema.branchProducts.branchId, branchId),
          eq(schema.branchProducts.productId, productId),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await this.db
        .update(schema.branchProducts)
        .set({ isSellable, isActive: true, updatedAt: new Date() })
        .where(eq(schema.branchProducts.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await this.db
      .insert(schema.branchProducts)
      .values({ businessId, branchId, productId, isSellable, isActive: true })
      .returning();
    return created;
  }

  async remove(id: string) {
    await this.db
      .update(schema.branchProducts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.branchProducts.id, id));
    return { success: true };
  }

  async copyCatalog(input: {
    businessId: string;
    fromBranchId: string;
    toBranchId: string;
  }) {
    const { businessId, fromBranchId, toBranchId } = input;

    if (fromBranchId === toBranchId) {
      throw new BadRequestException('El origen y destino deben ser sucursales distintas.');
    }

    const source = await this.db
      .select()
      .from(schema.branchProducts)
      .where(
        and(
          eq(schema.branchProducts.branchId, fromBranchId),
          eq(schema.branchProducts.isActive, true),
        ),
      );

    if (source.length === 0) {
      return { success: true, copied: 0 };
    }

    let copied = 0;
    for (const row of source) {
      const [existing] = await this.db
        .select()
        .from(schema.branchProducts)
        .where(
          and(
            eq(schema.branchProducts.branchId, toBranchId),
            eq(schema.branchProducts.productId, row.productId),
          ),
        )
        .limit(1);

      if (existing) {
        await this.db
          .update(schema.branchProducts)
          .set({ isSellable: row.isSellable, isActive: true, updatedAt: new Date() })
          .where(eq(schema.branchProducts.id, existing.id));
      } else {
        await this.db.insert(schema.branchProducts).values({
          businessId,
          branchId: toBranchId,
          productId: row.productId,
          isSellable: row.isSellable,
          isActive: true,
        });
      }
      copied++;
    }

    return { success: true, copied };
  }
}
