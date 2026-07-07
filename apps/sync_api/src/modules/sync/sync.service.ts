import {
  BadRequestException,
  Injectable,
  Inject,
  Logger,
} from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';
import { sql, gt, eq, inArray } from 'drizzle-orm';
import { PushSyncDto } from './dto/push-sync.dto';
import { PullSyncDto } from './dto/pull-sync.dto';
import { AckSyncDto } from './dto/ack-sync.dto';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async push(pushSyncDto: PushSyncDto) {
    await this.validatePushReferences(pushSyncDto);
    const pushData = this.normalizePushPayload(pushSyncDto);

    try {
      // Run push changes in a single atomic transaction
      await this.db.transaction(async (tx) => {
        // 1. Upsert Orders
        if (pushData.orders && pushData.orders.length > 0) {
          await tx
            .insert(schema.orders)
            .values(pushData.orders)
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

          // Update associated branchTables state
          for (const order of pushData.orders) {
            if (order.tableId) {
              const tableState = order.state === 'closed' ? 'cleaning' : 'occupied';
              await tx
                .update(schema.branchTables)
                .set({ state: tableState, updatedAt: new Date() })
                .where(eq(schema.branchTables.id, order.tableId));
            }
          }
        }

        // 2. Upsert Order Items
        if (pushData.orderItems && pushData.orderItems.length > 0) {
          await tx
            .insert(schema.orderItems)
            .values(pushData.orderItems)
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
        if (pushData.payments && pushData.payments.length > 0) {
          await tx
            .insert(schema.payments)
            .values(pushData.payments)
            .onConflictDoNothing();
        }

        // 4. Upsert Cash Shifts
        if (pushData.cashShifts && pushData.cashShifts.length > 0) {
          await tx
            .insert(schema.cashShifts)
            .values(pushData.cashShifts)
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
        if (pushData.cashTransactions && pushData.cashTransactions.length > 0) {
          await tx
            .insert(schema.cashTransactions)
            .values(pushData.cashTransactions)
            .onConflictDoNothing();
        }
      });
    } catch (error) {
      this.logger.error(
        'Sync push transaction failed',
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }

    return { success: true };
  }

  private normalizePushPayload(pushSyncDto: PushSyncDto): PushSyncDto {
    return {
      orders: this.normalizeRows(pushSyncDto.orders, [
        'createdAt',
        'updatedAt',
        'deletedAt',
      ]),
      orderItems: this.normalizeRows(pushSyncDto.orderItems, [
        'createdAt',
        'updatedAt',
        'deletedAt',
      ]),
      payments: this.normalizeRows(pushSyncDto.payments, ['createdAt']),
      cashShifts: this.normalizeRows(pushSyncDto.cashShifts, [
        'openedAt',
        'closedAt',
      ]),
      cashTransactions: this.normalizeRows(pushSyncDto.cashTransactions, [
        'createdAt',
      ]),
    };
  }

  private normalizeRows(rows: any[] | undefined, timestampFields: string[]) {
    if (!rows) return undefined;

    return rows.map((row) => {
      const normalized = { ...row };
      for (const field of timestampFields) {
        normalized[field] = this.normalizeTimestamp(row[field], field);
      }
      return normalized;
    });
  }

  private normalizeTimestamp(value: unknown, field: string) {
    if (value === undefined || value === null || value instanceof Date) {
      return value;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(`${field} must be an ISO timestamp string`);
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} must be a valid ISO timestamp`);
    }

    return date;
  }

  private async validatePushReferences(pushSyncDto: PushSyncDto) {
    const orders = pushSyncDto.orders ?? [];
    const orderItems = pushSyncDto.orderItems ?? [];

    const branchIds = this.uniqueStrings(orders.map((order) => order.branchId));
    const tableIds = this.uniqueStrings(orders.map((order) => order.tableId));
    const waiterIds = this.uniqueStrings(orders.map((order) => order.waiterId));
    const productIds = this.uniqueStrings(
      orderItems.map((item) => item.productId),
    );

    const [
      missingBranchIds,
      missingTableIds,
      missingWaiterIds,
      missingProductIds,
    ] = await Promise.all([
      this.findMissingIds(branchIds, schema.branches, schema.branches.id),
      this.findMissingIds(
        tableIds,
        schema.branchTables,
        schema.branchTables.id,
      ),
      this.findMissingIds(waiterIds, schema.users, schema.users.id),
      this.findMissingIds(productIds, schema.products, schema.products.id),
    ]);

    const problems = [
      ...missingBranchIds.map((id) => `branchId=${id}`),
      ...missingTableIds.map((id) => `tableId=${id}`),
      ...missingWaiterIds.map((id) => `waiterId=${id}`),
      ...missingProductIds.map((id) => `productId=${id}`),
    ];

    if (problems.length > 0) {
      throw new BadRequestException(
        `Sync push references do not exist: ${problems.join(', ')}`,
      );
    }
  }

  private uniqueStrings(values: unknown[]) {
    return Array.from(
      new Set(
        values.filter(
          (value): value is string =>
            typeof value === 'string' && value.length > 0,
        ),
      ),
    );
  }

  private async findMissingIds(ids: string[], table: any, idColumn: any) {
    if (ids.length === 0) return [];

    const rows = await this.db
      .select({ id: idColumn })
      .from(table)
      .where(inArray(idColumn, ids));

    const found = new Set(rows.map((row) => row.id));
    return ids.filter((id) => !found.has(id));
  }

  async pull(pullSyncDto: PullSyncDto) {
    const lastSyncedAt = pullSyncDto.lastSyncedAt
      ? new Date(pullSyncDto.lastSyncedAt)
      : new Date(0);
    const serverTimestamp = new Date();

    // Query updates across all tables since lastSyncedAt
    const businesses = await this.db
      .select()
      .from(schema.businesses)
      .where(gt(schema.businesses.updatedAt, lastSyncedAt));
    const branches = await this.db
      .select()
      .from(schema.branches)
      .where(gt(schema.branches.updatedAt, lastSyncedAt));
    const branchTables = await this.db
      .select()
      .from(schema.branchTables)
      .where(gt(schema.branchTables.updatedAt, lastSyncedAt));
    const users = await this.db
      .select()
      .from(schema.users)
      .where(gt(schema.users.updatedAt, lastSyncedAt));
    const categories = await this.db
      .select()
      .from(schema.categories)
      .where(gt(schema.categories.updatedAt, lastSyncedAt));
    const products = await this.db
      .select()
      .from(schema.products)
      .where(gt(schema.products.updatedAt, lastSyncedAt));
    const orders = await this.db
      .select()
      .from(schema.orders)
      .where(gt(schema.orders.updatedAt, lastSyncedAt));
    const orderItems = await this.db
      .select()
      .from(schema.orderItems)
      .where(gt(schema.orderItems.updatedAt, lastSyncedAt));

    // Immutable logs (queried via createdAt)
    const payments = await this.db
      .select()
      .from(schema.payments)
      .where(gt(schema.payments.createdAt, lastSyncedAt));
    const cashShifts = await this.db
      .select()
      .from(schema.cashShifts)
      .where(gt(schema.cashShifts.openedAt, lastSyncedAt));
    const cashTransactions = await this.db
      .select()
      .from(schema.cashTransactions)
      .where(gt(schema.cashTransactions.createdAt, lastSyncedAt));

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
      await this.db.insert(schema.deviceSyncCheckpoints).values({
        deviceId,
        lastSyncedAt: syncTime,
      });
    }

    return { success: true };
  }
}
