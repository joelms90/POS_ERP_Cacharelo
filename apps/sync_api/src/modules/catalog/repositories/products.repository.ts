import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, isNull } from 'drizzle-orm';

@Injectable()
export class ProductsRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  getDb() {
    return this.db;
  }

  async findAll(businessId?: string, categoryId?: string) {
    const conditions = [isNull(schema.products.deletedAt)];
    if (businessId) {
      conditions.push(eq(schema.products.businessId, businessId));
    }
    if (categoryId) {
      conditions.push(eq(schema.products.categoryId, categoryId));
    }
    
    return this.db
      .select()
      .from(schema.products)
      .where(and(...conditions));
  }

  async findById(id: string) {
    const results = await this.db
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.id, id),
          isNull(schema.products.deletedAt),
        ),
      );
    return results[0] || null;
  }

  async create(data: typeof schema.products.$inferInsert) {
    const results = await this.db
      .insert(schema.products)
      .values(data)
      .returning();
    return results[0];
  }

  async update(id: string, updates: Partial<typeof schema.products.$inferInsert>) {
    const results = await this.db
      .update(schema.products)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: string) {
    const results = await this.db
      .update(schema.products)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, id))
      .returning();
    return results[0];
  }
}
