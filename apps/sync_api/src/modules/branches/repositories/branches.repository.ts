import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, isNull, or } from 'drizzle-orm';

@Injectable()
export class BranchesRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findAll(businessId?: string) {
    const conditions = [isNull(schema.branches.deletedAt)];
    if (businessId) {
      conditions.push(eq(schema.branches.businessId, businessId));
    }
    
    return this.db
      .select()
      .from(schema.branches)
      .where(and(...conditions));
  }

  async findById(id: string) {
    const results = await this.db
      .select()
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.id, id),
          isNull(schema.branches.deletedAt),
        ),
      );
    return results[0] || null;
  }

  async create(data: typeof schema.branches.$inferInsert) {
    const results = await this.db
      .insert(schema.branches)
      .values(data)
      .returning();
    return results[0];
  }

  async update(id: string, updates: Partial<typeof schema.branches.$inferInsert>) {
    const results = await this.db
      .update(schema.branches)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.branches.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: string) {
    const results = await this.db
      .update(schema.branches)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.branches.id, id))
      .returning();
    return results[0];
  }

  // Check for associated records
  async hasAssociatedRecords(id: string): Promise<boolean> {
    // 1. Check branchTables
    const tables = await this.db
      .select({ id: schema.branchTables.id })
      .from(schema.branchTables)
      .where(
        and(
          eq(schema.branchTables.branchId, id),
          isNull(schema.branchTables.deletedAt),
        ),
      )
      .limit(1);
    if (tables.length > 0) return true;

    // 2. Check orders
    const orders = await this.db
      .select({ id: schema.orders.id })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.branchId, id),
          isNull(schema.orders.deletedAt),
        ),
      )
      .limit(1);
    if (orders.length > 0) return true;

    // 3. Check stockLevels
    const stock = await this.db
      .select({ id: schema.stockLevels.id })
      .from(schema.stockLevels)
      .where(eq(schema.stockLevels.branchId, id))
      .limit(1);
    if (stock.length > 0) return true;

    // 4. Check inventoryReceipts
    const receipts = await this.db
      .select({ id: schema.inventoryReceipts.id })
      .from(schema.inventoryReceipts)
      .where(eq(schema.inventoryReceipts.branchId, id))
      .limit(1);
    if (receipts.length > 0) return true;

    // 5. Check stockTransfers
    const transfers = await this.db
      .select({ id: schema.stockTransfers.id })
      .from(schema.stockTransfers)
      .where(
        or(
          eq(schema.stockTransfers.fromBranchId, id),
          eq(schema.stockTransfers.toBranchId, id),
        ),
      )
      .limit(1);
    if (transfers.length > 0) return true;

    return false;
  }
}
