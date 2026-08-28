import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, isNull, ne } from 'drizzle-orm';

@Injectable()
export class WarehousesRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findAll(businessId?: string) {
    const conditions = [
      isNull(schema.warehouses.deletedAt),
      ne(schema.warehouses.locationType, 'transit'),
    ];
    if (businessId) {
      conditions.push(eq(schema.warehouses.businessId, businessId));
    }

    return this.db
      .select()
      .from(schema.warehouses)
      .where(and(...conditions));
  }

  async findById(id: string) {
    const results = await this.db
      .select()
      .from(schema.warehouses)
      .where(
        and(
          eq(schema.warehouses.id, id),
          isNull(schema.warehouses.deletedAt),
        ),
      );
    return results[0] || null;
  }

  async create(data: typeof schema.warehouses.$inferInsert) {
    const results = await this.db
      .insert(schema.warehouses)
      .values(data)
      .returning();
    return results[0];
  }

  async update(id: string, updates: Partial<typeof schema.warehouses.$inferInsert>) {
    const results = await this.db
      .update(schema.warehouses)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.warehouses.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: string) {
    const results = await this.db
      .update(schema.warehouses)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.warehouses.id, id))
      .returning();
    return results[0];
  }
}
