import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, isNull } from 'drizzle-orm';

@Injectable()
export class ProvidersRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findAll(businessId?: string) {
    const conditions = [isNull(schema.providers.deletedAt)];
    if (businessId) {
      conditions.push(eq(schema.providers.businessId, businessId));
    }
    
    return this.db
      .select()
      .from(schema.providers)
      .where(and(...conditions));
  }

  async findById(id: string) {
    const results = await this.db
      .select()
      .from(schema.providers)
      .where(
        and(
          eq(schema.providers.id, id),
          isNull(schema.providers.deletedAt),
        ),
      );
    return results[0] || null;
  }

  async create(data: typeof schema.providers.$inferInsert) {
    const results = await this.db
      .insert(schema.providers)
      .values(data)
      .returning();
    return results[0];
  }

  async update(id: string, updates: Partial<typeof schema.providers.$inferInsert>) {
    const results = await this.db
      .update(schema.providers)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.providers.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: string) {
    const results = await this.db
      .update(schema.providers)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.providers.id, id))
      .returning();
    return results[0];
  }
}
