import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class TransactionsRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByShiftId(shiftId: string) {
    return this.db
      .select()
      .from(schema.cashTransactions)
      .where(eq(schema.cashTransactions.shiftId, shiftId));
  }

  async create(data: typeof schema.cashTransactions.$inferInsert) {
    const results = await this.db
      .insert(schema.cashTransactions)
      .values(data)
      .returning();
    return results[0];
  }
}
