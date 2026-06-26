import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from './database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './database/schema';
import { sql } from 'drizzle-orm';

@Injectable()
export class AppService {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async checkDatabaseHealth() {
    try {
      await this.db.execute(sql`SELECT 1`);
      return { status: 'OK', database: 'connected' };
    } catch (error) {
      return { status: 'ERROR', database: 'disconnected', details: error.message };
    }
  }
}
