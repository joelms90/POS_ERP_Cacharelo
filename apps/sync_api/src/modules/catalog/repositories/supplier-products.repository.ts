import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, isNull } from 'drizzle-orm';

@Injectable()
export class SupplierProductsRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findAll(businessId?: string, productId?: string, providerId?: string) {
    const conditions = [isNull(schema.supplierProducts.deletedAt)];
    if (businessId) {
      conditions.push(eq(schema.supplierProducts.businessId, businessId));
    }
    if (productId) {
      conditions.push(eq(schema.supplierProducts.productId, productId));
    }
    if (providerId) {
      conditions.push(eq(schema.supplierProducts.providerId, providerId));
    }
    
    return this.db
      .select()
      .from(schema.supplierProducts)
      .where(and(...conditions));
  }

  async findById(id: string) {
    const results = await this.db
      .select()
      .from(schema.supplierProducts)
      .where(
        and(
          eq(schema.supplierProducts.id, id),
          isNull(schema.supplierProducts.deletedAt),
        ),
      );
    return results[0] || null;
  }

  async create(data: typeof schema.supplierProducts.$inferInsert) {
    const results = await this.db
      .insert(schema.supplierProducts)
      .values(data)
      .returning();
    return results[0];
  }

  async update(id: string, updates: Partial<typeof schema.supplierProducts.$inferInsert>) {
    const results = await this.db
      .update(schema.supplierProducts)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.supplierProducts.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: string) {
    const results = await this.db
      .update(schema.supplierProducts)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.supplierProducts.id, id))
      .returning();
    return results[0];
  }
}
