import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, isNull } from 'drizzle-orm';

@Injectable()
export class UsersRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findAll(businessId?: string, branchId?: string) {
    const conditions: any[] = [isNull(schema.users.deletedAt)];
    if (businessId) {
      conditions.push(eq(schema.users.businessId, businessId));
    }
    if (branchId) {
      conditions.push(eq(schema.users.branchId, branchId));
    }
    return this.db
      .select()
      .from(schema.users)
      .where(and(...conditions));
  }

  async findById(id: string) {
    const results = await this.db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.id, id),
          isNull(schema.users.deletedAt),
        ),
      );
    return results[0] || null;
  }

  async findByPin(businessId: string, pin: string) {
    const results = await this.db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.businessId, businessId),
          eq(schema.users.pin, pin),
          isNull(schema.users.deletedAt),
        ),
      );
    return results[0] || null;
  }

  async findByEmail(email: string) {
    const results = await this.db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.email, email),
          isNull(schema.users.deletedAt),
        ),
      );
    return results[0] || null;
  }

  async create(user: typeof schema.users.$inferInsert) {
    const results = await this.db
      .insert(schema.users)
      .values(user)
      .returning();
    return results[0];
  }

  async update(id: string, updates: Partial<typeof schema.users.$inferInsert>) {
    const results = await this.db
      .update(schema.users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: string) {
    const results = await this.db
      .update(schema.users)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, id))
      .returning();
    return results[0];
  }
}
