import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';
import { sql, gt, eq } from 'drizzle-orm';
import { PushSyncDto } from './dto/push-sync.dto';
import { PullSyncDto } from './dto/pull-sync.dto';
import { AckSyncDto } from './dto/ack-sync.dto';

@Injectable()
export class SyncService {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async push(pushSyncDto: PushSyncDto) {
    // Run push changes in a single atomic transaction
    await this.db.transaction(async (tx) => {
      // 1. Upsert Orders
      if (pushSyncDto.orders && pushSyncDto.orders.length > 0) {
        await tx.insert(schema.orders)
          .values(pushSyncDto.orders)
          .onConflictDoUpdate({
            target: schema.orders.id,
            set: {
              branchId: sql`excluded.branch_id`,
              tableId: sql`excluded.table_id`,
              waiterId: sql`excluded.waiter_id`,
              state: sql`excluded.state`,
              subtotal: sql`excluded.subtotal`,
              discount: sql`excluded.discount`,
              tax: sql`excluded.tax`,
              total: sql`excluded.total`,
              updatedAt: sql`excluded.updated_at`,
              deletedAt: sql`excluded.deleted_at`,
              version: sql`excluded.version`,
            },
          });
      }

      // 2. Upsert Order Items
      if (pushSyncDto.orderItems && pushSyncDto.orderItems.length > 0) {
        await tx.insert(schema.orderItems)
          .values(pushSyncDto.orderItems)
          .onConflictDoUpdate({
            target: schema.orderItems.id,
            set: {
              orderId: sql`excluded.order_id`,
              productId: sql`excluded.product_id`,
              quantity: sql`excluded.quantity`,
              price: sql`excluded.price`,
              assignedGuest: sql`excluded.assigned_guest`,
              isSent: sql`excluded.is_sent`,
              notes: sql`excluded.notes`,
              updatedAt: sql`excluded.updated_at`,
              deletedAt: sql`excluded.deleted_at`,
              version: sql`excluded.version`,
            },
          });
      }

      // 3. Upsert Payments (Immutable logs - do nothing on conflict)
      if (pushSyncDto.payments && pushSyncDto.payments.length > 0) {
        await tx.insert(schema.payments)
          .values(pushSyncDto.payments)
          .onConflictDoNothing();
      }

      // 4. Upsert Cash Shifts
      if (pushSyncDto.cashShifts && pushSyncDto.cashShifts.length > 0) {
        await tx.insert(schema.cashShifts)
          .values(pushSyncDto.cashShifts)
          .onConflictDoUpdate({
            target: schema.cashShifts.id,
            set: {
              cashierId: sql`excluded.cashier_id`,
              branchId: sql`excluded.branch_id`,
              initialFloat: sql`excluded.initial_float`,
              cashDrawerAmount: sql`excluded.cash_drawer_amount`,
              status: sql`excluded.status`,
              openedAt: sql`excluded.opened_at`,
              closedAt: sql`excluded.closed_at`,
              version: sql`excluded.version`,
            },
          });
      }

      // 5. Upsert Cash Transactions (Immutable logs - do nothing on conflict)
      if (pushSyncDto.cashTransactions && pushSyncDto.cashTransactions.length > 0) {
        await tx.insert(schema.cashTransactions)
          .values(pushSyncDto.cashTransactions)
          .onConflictDoNothing();
      }
    });

    return { success: true };
  }

  async pull(pullSyncDto: PullSyncDto) {
    const lastSyncedAt = pullSyncDto.lastSyncedAt ? new Date(pullSyncDto.lastSyncedAt) : new Date(0);
    const serverTimestamp = new Date();

    // Query updates across all tables since lastSyncedAt
    const businesses = await this.db.select().from(schema.businesses).where(gt(schema.businesses.updatedAt, lastSyncedAt));
    const branches = await this.db.select().from(schema.branches).where(gt(schema.branches.updatedAt, lastSyncedAt));
    const branchTables = await this.db.select().from(schema.branchTables).where(gt(schema.branchTables.updatedAt, lastSyncedAt));
    const users = await this.db.select().from(schema.users).where(gt(schema.users.updatedAt, lastSyncedAt));
    const categories = await this.db.select().from(schema.categories).where(gt(schema.categories.updatedAt, lastSyncedAt));
    const products = await this.db.select().from(schema.products).where(gt(schema.products.updatedAt, lastSyncedAt));
    const orders = await this.db.select().from(schema.orders).where(gt(schema.orders.updatedAt, lastSyncedAt));
    const orderItems = await this.db.select().from(schema.orderItems).where(gt(schema.orderItems.updatedAt, lastSyncedAt));
    
    // Immutable logs (queried via createdAt)
    const payments = await this.db.select().from(schema.payments).where(gt(schema.payments.createdAt, lastSyncedAt));
    const cashShifts = await this.db.select().from(schema.cashShifts).where(gt(schema.cashShifts.openedAt, lastSyncedAt));
    const cashTransactions = await this.db.select().from(schema.cashTransactions).where(gt(schema.cashTransactions.createdAt, lastSyncedAt));

    // Strip sensitive passwords and PINs before sending users to client tablets
    const sanitizedUsers = users.map((u) => {
      const { passwordHash, pin, ...rest } = u;
      return rest;
    });

    return {
      timestamp: serverTimestamp.toISOString(),
      changes: {
        businesses,
        branches,
        branchTables,
        users: sanitizedUsers,
        categories,
        products,
        orders,
        orderItems,
        payments,
        cashShifts,
        cashTransactions,
      },
    };
  }

  async ack(ackSyncDto: AckSyncDto) {
    const { deviceId, lastSyncedAt } = ackSyncDto;
    const syncTime = new Date(lastSyncedAt);

    const existing = await this.db
      .select()
      .from(schema.deviceSyncCheckpoints)
      .where(eq(schema.deviceSyncCheckpoints.deviceId, deviceId));

    if (existing.length > 0) {
      await this.db
        .update(schema.deviceSyncCheckpoints)
        .set({
          lastSyncedAt: syncTime,
          updatedAt: new Date(),
        })
        .where(eq(schema.deviceSyncCheckpoints.deviceId, deviceId));
    } else {
      await this.db
        .insert(schema.deviceSyncCheckpoints)
        .values({
          deviceId,
          lastSyncedAt: syncTime,
        });
    }

    return { success: true };
  }
}
