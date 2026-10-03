import { OrdersRepository } from '../orders/repositories/orders.repository';
import { SyncAccessService, SyncActor } from './sync-access.service';
import { Injectable, Logger, Inject, forwardRef, OnModuleInit, BadRequestException, ConflictException } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';
import { sql, gt, eq, inArray, and } from 'drizzle-orm';
import { PushSyncDto } from './dto/push-sync.dto';
import { PullSyncDto } from './dto/pull-sync.dto';
import { AckSyncDto } from './dto/ack-sync.dto';
import { SyncGateway } from './sync.gateway';

@Injectable()
export class SyncService implements OnModuleInit {
  private readonly logger = new Logger(SyncService.name);
  private lastTakeawaySelfHealAt = 0;
  private readonly takeawaySelfHealIntervalMs = Number(
    process.env.TAKEAWAY_SELF_HEAL_INTERVAL_MS ?? 60_000,
  );

  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    @Inject(forwardRef(() => SyncGateway))
    private readonly syncGateway: SyncGateway,
    private readonly access: SyncAccessService,
    private readonly ordersRepository: OrdersRepository,
  ) {}

  onModuleInit() {
    // Schedule change log cleanups to run every 12 hours
    setInterval(() => {
      this.logger.log('Running scheduled cleanOldChangeLogs...');
      this.cleanOldChangeLogs().catch((err) =>
        this.logger.error('Failed to run scheduled cleanOldChangeLogs', err)
      );
    }, 12 * 60 * 60 * 1000); // 12 hours

    // Run initial cleanup after startup settles
    setTimeout(() => {
      this.cleanOldChangeLogs().catch((err) =>
        this.logger.error('Failed to run initial cleanOldChangeLogs', err)
      );
    }, 10000);
  }

  async getChangeLogSince(branchId: string, desde: string) {
    const lastSyncedAt = new Date(desde);
    return await this.db
      .select()
      .from(schema.changeLog)
      .where(
        and(
          eq(schema.changeLog.branchId, branchId),
          gt(schema.changeLog.versionAt, lastSyncedAt)
        )
      )
      .orderBy(schema.changeLog.id);
  }

  async cleanOldChangeLogs(retentionDays = 3) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    try {
      await this.db
        .delete(schema.changeLog)
        .where(sql`version_at < ${cutoffDate.toISOString()}`);
    } catch (err) {
      this.logger.error('Failed to clean old change logs', err);
    }
  }

  async push(pushSyncDto: PushSyncDto, actor: SyncActor) {
    await this.validatePushReferences(pushSyncDto);
    let pushData = this.normalizePushPayload(pushSyncDto);

    const logsToInsert: any[] = [];
    const now = new Date();

    try {
      // Run push changes in a single atomic transaction
      await this.db.transaction(async (tx) => {
        // Stable order locks cover both new offline IDs and existing REST orders.
        const orderIds = [...new Set([
          ...(pushData.orders ?? []).map(row => row.id),
          ...(pushData.orderItems ?? []).map(row => row.orderId),
          ...(pushData.payments ?? []).map(row => row.orderId),
        ])].sort();
        const settledIds = new Set<string>();
        for (const id of orderIds) {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${id}))`);
          const [existing] = await tx.select().from(schema.orders).where(eq(schema.orders.id, id)).for('update');
          if (existing?.state === 'closed' || existing?.state === 'cancelled') settledIds.add(id);
        }
        await this.access.push(actor, pushData, tx);
        // Lost ACK retries are no-ops. Reject changed settled records rather than
        // reopening them and applying the inventory movement a second time.
        const same = (row: any, existing: any, fields: string[]) => existing && fields.every(key =>
          row[key] === undefined || String(row[key] ?? '') === String(existing[key] ?? ''));
        for (const row of pushData.orders ?? []) if (settledIds.has(row.id)) {
          const [existing] = await tx.select().from(schema.orders).where(eq(schema.orders.id, row.id));
          if (!same(row, existing, ['branchId','tableId','waiterId','state','subtotal','discount','tax','total','deletedAt'])) throw new ConflictException('Settled order cannot change');
        }
        for (const row of pushData.orderItems ?? []) if (settledIds.has(row.orderId)) {
          const [existing] = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.id, row.id));
          if (!same(row, existing, ['orderId','productId','quantity','price','deletedAt'])) throw new ConflictException('Settled items cannot change');
        }
        for (const row of pushData.payments ?? []) if (settledIds.has(row.orderId)) {
          const [existing] = await tx.select().from(schema.payments).where(eq(schema.payments.id, row.id));
          if (!same(row, existing, ['orderId','amount','paymentMethod','referenceCode'])) throw new ConflictException('Settled payments cannot change');
        }
        pushData = {
          ...pushData,
          orders: pushData.orders?.filter(row => !settledIds.has(row.id)),
          orderItems: pushData.orderItems?.filter(row => !settledIds.has(row.orderId)),
          payments: pushData.payments?.filter(row => !settledIds.has(row.orderId)),
        };
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
            logsToInsert.push({
              entity: 'orders',
              entityId: order.id,
              branchId: order.branchId,
              payload: order,
              versionAt: now,
            });

            if (order.tableId) {
              const [table] = await tx
                .select()
                .from(schema.branchTables)
                .where(eq(schema.branchTables.id, order.tableId));

              let tableState = 'occupied';
              if (order.state === 'closed') {
                tableState = (table && table.room === 'Para Llevar') ? 'free' : 'cleaning';
              } else if (order.state === 'cancelled') {
                tableState = 'free';
              }

              await tx
                .update(schema.branchTables)
                .set({ state: tableState, updatedAt: now })
                .where(eq(schema.branchTables.id, order.tableId));

              // Log the table state change
              logsToInsert.push({
                entity: 'branchTables',
                entityId: order.tableId,
                branchId: order.branchId,
                payload: { id: order.tableId, state: tableState, updatedAt: now },
                versionAt: now,
              });
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

          // Map orderId to branchId using the payload or querying the database
          const orderIdToBranchId = new Map<string, string>();
          if (pushData.orders) {
            for (const o of pushData.orders) {
              orderIdToBranchId.set(o.id, o.branchId);
            }
          }

          // For any missing mapping, query from DB
          const missingOrderIds = pushData.orderItems
            .map((item) => item.orderId)
            .filter((id) => !orderIdToBranchId.has(id));

          if (missingOrderIds.length > 0) {
            const dbOrders = await tx
              .select({ id: schema.orders.id, branchId: schema.orders.branchId })
              .from(schema.orders)
              .where(inArray(schema.orders.id, missingOrderIds));
            for (const o of dbOrders) {
              orderIdToBranchId.set(o.id, o.branchId);
            }
          }

          for (const item of pushData.orderItems) {
            const bId = orderIdToBranchId.get(item.orderId);
            if (bId) {
              logsToInsert.push({
                entity: 'orderItems',
                entityId: item.id,
                branchId: bId,
                payload: item,
                versionAt: now,
              });
            }
          }
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

        // Apply the same recipe/stock rules as online settlement exactly once.
        for (const order of pushData.orders ?? []) if (order.state === 'closed') {
          const payments = await tx.select().from(schema.payments).where(eq(schema.payments.orderId, order.id));
          const totalPaid = payments.reduce((sum, row) => sum + Number(row.amount), 0);
          if (!Number.isFinite(Number(order.total)) || totalPaid < Number(order.total) || payments.some(row => !(Number(row.amount) > 0))) {
            throw new BadRequestException('Closed sale requires a complete positive payment');
          }
          const items = await tx.select().from(schema.orderItems).where(and(eq(schema.orderItems.orderId, order.id), sql`${schema.orderItems.deletedAt} IS NULL`));
          if (!items.length || items.some(row => !(row.quantity > 0))) throw new BadRequestException('Closed sale requires positive items');
          await this.ordersRepository.deductInventoryForItems(tx, items, order.branchId);
        }

        // Write changes to changeLog table inside same transaction
        if (logsToInsert.length > 0) {
          await tx.insert(schema.changeLog).values(logsToInsert);
        }
      });

      // After transaction completes successfully, broadcast updates via WebSocket:
      if (logsToInsert.length > 0) {
        const branchGroupedLogs = new Map<string, any[]>();
        for (const log of logsToInsert) {
          if (!branchGroupedLogs.has(log.branchId)) {
            branchGroupedLogs.set(log.branchId, []);
          }
          branchGroupedLogs.get(log.branchId)!.push({
            id: '0', // placeholder
            entity: log.entity,
            entityId: log.entityId,
            payload: log.payload,
            versionAt: log.versionAt.toISOString(),
          });
        }

        for (const [branchId, branchChanges] of branchGroupedLogs.entries()) {
          this.syncGateway.broadcastChange(branchId, {
            tipo: 'cambio',
            changes: branchChanges,
          });
        }
      }
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

  async pull(pullSyncDto: PullSyncDto, actor: SyncActor) {
    const branchId = await this.access.branch(actor, pullSyncDto.branchId);
    await this.maybeHealTakeawayTables(branchId);

    const lastSyncedAt = pullSyncDto.lastSyncedAt
      ? new Date(pullSyncDto.lastSyncedAt)
      : new Date(0);
    const serverTimestamp = new Date();

    const branchOrders = (await this.db.select({ id: schema.orders.id }).from(schema.orders).where(eq(schema.orders.branchId, branchId))).map(row => row.id);
    const branchShifts = (await this.db.select({ id: schema.cashShifts.id }).from(schema.cashShifts).where(eq(schema.cashShifts.branchId, branchId))).map(row => row.id);

    // Query updates across all tables since lastSyncedAt
    const businesses = await this.db
      .select()
      .from(schema.businesses)
      .where(and(eq(schema.businesses.id, actor.businessId), gt(schema.businesses.updatedAt, lastSyncedAt)));
    const branches = await this.db
      .select()
      .from(schema.branches)
      .where(and(eq(schema.branches.id, branchId), gt(schema.branches.updatedAt, lastSyncedAt)));
    const branchTables = await this.db
      .select()
      .from(schema.branchTables)
      .where(and(eq(schema.branchTables.branchId, branchId), gt(schema.branchTables.updatedAt, lastSyncedAt)));
    const users = await this.db
      .select()
      .from(schema.users)
      .where(and(and(eq(schema.users.businessId, actor.businessId), eq(schema.users.branchId, branchId)), gt(schema.users.updatedAt, lastSyncedAt)));
    const categories = await this.db
      .select()
      .from(schema.categories)
      .where(and(eq(schema.categories.businessId, actor.businessId), gt(schema.categories.updatedAt, lastSyncedAt)));
    const products = await this.db
      .select()
      .from(schema.products)
      .where(and(eq(schema.products.businessId, actor.businessId), gt(schema.products.updatedAt, lastSyncedAt)));
    const orders = await this.db
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.branchId, branchId), gt(schema.orders.updatedAt, lastSyncedAt)));
    const orderItems = await this.db
      .select()
      .from(schema.orderItems)
      .where(and(inArray(schema.orderItems.orderId, branchOrders), gt(schema.orderItems.updatedAt, lastSyncedAt)));

    // Immutable logs (queried via createdAt)
    const payments = await this.db
      .select()
      .from(schema.payments)
      .where(and(inArray(schema.payments.orderId, branchOrders), gt(schema.payments.createdAt, lastSyncedAt)));
    const cashShifts = await this.db
      .select()
      .from(schema.cashShifts)
      .where(and(eq(schema.cashShifts.branchId, branchId), gt(schema.cashShifts.openedAt, lastSyncedAt)));
    const cashTransactions = await this.db
      .select()
      .from(schema.cashTransactions)
      .where(and(inArray(schema.cashTransactions.shiftId, branchShifts), gt(schema.cashTransactions.createdAt, lastSyncedAt)));

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

  private async maybeHealTakeawayTables(branchId?: string) {
    const now = Date.now();
    if (now - this.lastTakeawaySelfHealAt < this.takeawaySelfHealIntervalMs) {
      return;
    }

    this.lastTakeawaySelfHealAt = now;

    try {
      if (branchId) {
        await this.db.execute(sql`
          UPDATE branch_tables
          SET state = 'free', updated_at = NOW()
          WHERE branch_id = ${branchId}
            AND room = 'Para Llevar'
            AND state != 'free'
            AND id NOT IN (
              SELECT table_id FROM orders
              WHERE branch_id = ${branchId}
                AND state IN ('open', 'billing')
                AND deleted_at IS NULL
            )
        `);
      } else {
        await this.db.execute(sql`
          UPDATE branch_tables
          SET state = 'free', updated_at = NOW()
          WHERE room = 'Para Llevar'
            AND state != 'free'
            AND id NOT IN (
              SELECT table_id FROM orders
              WHERE state IN ('open', 'billing')
                AND deleted_at IS NULL
            )
        `);
      }
    } catch (err) {
      this.logger.error('Failed to run self-healing query for takeaway tables:', err);
    }
  }

  async ack(ackSyncDto: AckSyncDto, actor: SyncActor) {
    await this.access.device(actor, ackSyncDto.deviceId);
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
