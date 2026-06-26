import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, isNull } from 'drizzle-orm';

@Injectable()
export class CategoriesRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findAll(businessId?: string) {
    if (businessId) {
      return this.db
        .select()
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.businessId, businessId),
            isNull(schema.categories.deletedAt),
          ),
        );
    }
    return this.db
      .select()
      .from(schema.categories)
      .where(isNull(schema.categories.deletedAt));
  }

  async findById(id: string) {
    const results = await this.db
      .select()
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.id, id),
          isNull(schema.categories.deletedAt),
        ),
      );
    return results[0] || null;
  }

  async create(data: typeof schema.categories.$inferInsert) {
    const results = await this.db
      .insert(schema.categories)
      .values(data)
      .returning();
    return results[0];
  }

  async update(id: string, updates: Partial<typeof schema.categories.$inferInsert>) {
    const results = await this.db
      .update(schema.categories)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.categories.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: string) {
    const results = await this.db
      .update(schema.categories)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.categories.id, id))
      .returning();
    return results[0];
  }
}
