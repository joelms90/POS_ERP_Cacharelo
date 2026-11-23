import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { asc, eq } from 'drizzle-orm';
import type { DbExecutor } from '../../audit/db-executor';

/**
 * cash_transactions is an append-only ledger (spec 019, S-4): this repository
 * only inserts rows and updates workflow columns, never amounts.
 */
@Injectable()
export class TransactionsRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByShiftId(shiftId: string, exec: DbExecutor = this.db) {
    return exec
      .select()
      .from(schema.cashTransactions)
      .where(eq(schema.cashTransactions.shiftId, shiftId))
      .orderBy(asc(schema.cashTransactions.createdAt));
  }

  async findById(id: string, exec: DbExecutor = this.db) {
    const rows = await exec.select().from(schema.cashTransactions).where(eq(schema.cashTransactions.id, id)).limit(1);
    return rows[0] || null;
  }

  async findByClientUuid(clientUuid: string, exec: DbExecutor = this.db) {
    const rows = await exec
      .select()
      .from(schema.cashTransactions)
      .where(eq(schema.cashTransactions.clientUuid, clientUuid))
      .limit(1);
    return rows[0] || null;
  }

  async create(data: typeof schema.cashTransactions.$inferInsert, exec: DbExecutor = this.db) {
    const results = await exec.insert(schema.cashTransactions).values(data).returning();
    return results[0];
  }

  /** Workflow columns only (status/reviewers/version); the immutability trigger guards the rest. */
  async updateWorkflow(
    id: string,
    updates: Pick<
      Partial<typeof schema.cashTransactions.$inferInsert>,
      'approvalStatus' | 'reviewedBy' | 'reviewedAt' | 'reviewReason' | 'reviewLevel' | 'version'
    >,
    exec: DbExecutor = this.db,
  ) {
    const results = await exec
      .update(schema.cashTransactions)
      .set(updates)
      .where(eq(schema.cashTransactions.id, id))
      .returning();
    return results[0];
  }
}
