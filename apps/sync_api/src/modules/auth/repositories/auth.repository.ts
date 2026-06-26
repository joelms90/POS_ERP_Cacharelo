import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class AuthRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async createRefreshToken(data: typeof schema.refreshTokens.$inferInsert) {
    const results = await this.db
      .insert(schema.refreshTokens)
      .values(data)
      .returning();
    return results[0];
  }

  async findRefreshToken(tokenHash: string, deviceId: string) {
    const results = await this.db
      .select()
      .from(schema.refreshTokens)
      .where(
        and(
          eq(schema.refreshTokens.tokenHash, tokenHash),
          eq(schema.refreshTokens.deviceId, deviceId),
        ),
      );
    return results[0] || null;
  }

  async deleteRefreshToken(tokenHash: string) {
    await this.db
      .delete(schema.refreshTokens)
      .where(eq(schema.refreshTokens.tokenHash, tokenHash));
  }

  async deleteUserRefreshTokens(userId: string) {
    await this.db
      .delete(schema.refreshTokens)
      .where(eq(schema.refreshTokens.userId, userId));
  }
}
