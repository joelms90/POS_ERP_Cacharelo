import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, desc } from 'drizzle-orm';

@Injectable()
export class ShiftsRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findActiveShift(branchId: string, cashierId?: string) {
    const results = await this.db
      .select()
      .from(schema.cashShifts)
      .where(
        and(
          eq(schema.cashShifts.branchId, branchId),
          cashierId ? eq(schema.cashShifts.cashierId, cashierId) : undefined,
          eq(schema.cashShifts.status, 'open'),
        ),
      );
    return results[0] || null;
  }

  async findLastClosedShift(branchId: string) {
    const results = await this.db
      .select()
      .from(schema.cashShifts)
      .where(
        and(
          eq(schema.cashShifts.branchId, branchId),
          eq(schema.cashShifts.status, 'closed'),
        ),
      )
      .orderBy(desc(schema.cashShifts.closedAt))
      .limit(1);
    return results[0] || null;
  }

  async findById(id: string) {
    const results = await this.db
      .select()
      .from(schema.cashShifts)
      .where(eq(schema.cashShifts.id, id));
    return results[0] || null;
  }

  async create(data: typeof schema.cashShifts.$inferInsert) {
    const results = await this.db
      .insert(schema.cashShifts)
      .values(data)
      .returning();
    return results[0];
  }

  async update(id: string, updates: Partial<typeof schema.cashShifts.$inferInsert>) {
    const results = await this.db
      .update(schema.cashShifts)
      .set({
        ...updates,
      })
      .where(eq(schema.cashShifts.id, id))
      .returning();
    return results[0];
  }

  async closeAllOpenForBranch(branchId: string) {
    await this.db
      .update(schema.cashShifts)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closeNotes: 'Auto-cierre: nuevo turno abierto',
      })
      .where(
        and(
          eq(schema.cashShifts.branchId, branchId),
          eq(schema.cashShifts.status, 'open'),
        ),
      );
  }
}
