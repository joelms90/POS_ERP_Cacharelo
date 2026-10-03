import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { PushSyncDto } from './dto/push-sync.dto';

export interface SyncActor { sub: string; businessId: string; branchId: string; role?: string; exp?: number; }

@Injectable()
export class SyncAccessService {
  constructor(@Inject(DRIZZLE_CONNECTION) private readonly db: NodePgDatabase<typeof schema>) {}

  async branch(actor: SyncActor, requested?: string, db: any = this.db): Promise<string> {
    if (!actor?.sub || !actor.businessId || !actor.branchId ||
        (actor.exp !== undefined && actor.exp <= Date.now() / 1000) ||
        (requested !== undefined && requested !== actor.branchId)) throw new ForbiddenException();
    const [branch] = await db.select().from(schema.branches).where(eq(schema.branches.id, actor.branchId));
    if (!branch || branch.businessId !== actor.businessId) throw new ForbiddenException();
    return branch.id;
  }

  async device(actor: SyncActor, deviceId: string) {
    await this.branch(actor);
    const [device] = await this.db.select().from(schema.devices).where(eq(schema.devices.deviceUuid, deviceId));
    if (!device || !device.isActive || device.deletedAt || device.branchId !== actor.branchId || device.businessId !== actor.businessId) throw new ForbiddenException();
  }

  // Validate both the submitted reference and the persisted ID: an upsert must
  // never move a foreign entity into the caller's branch to bypass isolation.
  async push(actor: SyncActor, dto: PushSyncDto, db: any = this.db) {
    const branchId = await this.branch(actor, undefined, db);
    const find = async (table: any, id: string) => {
      if (!id || typeof id !== 'string') throw new ForbiddenException();
      const [row] = await db.select().from(table).where(eq(table.id, id));
      return row;
    };
    const scoped = (row: any) => {
      if (!row || row.branchId !== branchId) throw new ForbiddenException();
      return row;
    };
    const user = async (id: string) => {
      const row = scoped(await find(schema.users, id));
      if (row.businessId !== actor.businessId) throw new ForbiddenException();
    };
    const order = async (id: string) => {
      const existing = await find(schema.orders, id);
      if (existing) scoped(existing);
      return scoped(dto.orders?.find(row => row.id === id) ?? existing);
    };
    const shift = async (id: string) => {
      const existing = await find(schema.cashShifts, id);
      if (existing) scoped(existing);
      return scoped(dto.cashShifts?.find(row => row.id === id) ?? existing);
    };
    for (const row of dto.orders ?? []) {
      scoped(row);
      const existing = await find(schema.orders, row.id);
      if (existing) scoped(existing);
      if (row.tableId) scoped(await find(schema.branchTables, row.tableId));
      if (row.waiterId) await user(row.waiterId);
    }
    for (const row of dto.orderItems ?? []) {
      await order(row.orderId);
      const existing = await find(schema.orderItems, row.id);
      if (existing) {
        await order(existing.orderId);
        if (existing.orderId !== row.orderId) throw new ForbiddenException();
      }
      const product = await find(schema.products, row.productId);
      if (!product || product.businessId !== actor.businessId) throw new ForbiddenException();
    }
    for (const row of dto.payments ?? []) {
      await order(row.orderId);
      const existing = await find(schema.payments, row.id);
      if (existing) {
        await order(existing.orderId);
        if (existing.orderId !== row.orderId) throw new ForbiddenException();
      }
    }
    for (const row of dto.cashShifts ?? []) {
      scoped(row);
      const existing = await find(schema.cashShifts, row.id);
      if (existing) scoped(existing);
      await user(row.cashierId);
      if (row.cashierId !== actor.sub) throw new ForbiddenException();
    }
    for (const row of dto.cashTransactions ?? []) {
      const parent = await shift(row.shiftId);
      if (parent.cashierId !== actor.sub) throw new ForbiddenException();
      const existing = await find(schema.cashTransactions, row.id);
      if (existing) {
        await shift(existing.shiftId);
        if (existing.shiftId !== row.shiftId) throw new ForbiddenException();
      }
    }
  }
}
