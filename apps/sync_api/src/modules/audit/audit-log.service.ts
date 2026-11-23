import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, lte, SQL } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import type { AppDatabase, DbExecutor } from './db-executor';

export interface AuditEntry {
  businessId: string;
  branchId?: string | null;
  entityType:
    | 'cash_shift'
    | 'cash_transaction'
    | 'cashier_debt'
    | 'supervisor_assignment'
    | 'branch_requisition'
    | 'stock_transfer'
    | 'purchase_order';
  entityId: string;
  action: string;
  approvalLevel?: 'n1' | 'n2' | 'owner' | null;
  actorId?: string | null;
  actorRole?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  source: 'admin_web' | 'pos' | 'system';
  deviceId?: string | null;
}

/** Append-only audit trail (spec 019 §6). Always write inside the caller's transaction. */
@Injectable()
export class AuditLogService {
  constructor(@Inject(DRIZZLE_CONNECTION) private readonly db: AppDatabase) {}

  async record(exec: DbExecutor, entry: AuditEntry) {
    await exec.insert(schema.auditLog).values({
      businessId: entry.businessId,
      branchId: entry.branchId ?? null,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      approvalLevel: entry.approvalLevel ?? null,
      actorId: entry.actorId ?? null,
      actorRole: entry.actorRole ?? null,
      reason: entry.reason ?? null,
      before: (entry.before ?? null) as any,
      after: (entry.after ?? null) as any,
      source: entry.source,
      deviceId: entry.deviceId ?? null,
    });
  }

  async query(filters: {
    branchIds?: string[];
    businessIds?: string[];
    entityType?: string;
    entityId?: string;
    actorId?: string;
    action?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }) {
    const conditions: SQL[] = [];
    if (filters.branchIds)
      conditions.push(
        inArray(
          schema.auditLog.branchId,
          filters.branchIds.length
            ? filters.branchIds
            : ['00000000-0000-0000-0000-000000000000'],
        ),
      );
    if (filters.businessIds)
      conditions.push(
        inArray(
          schema.auditLog.businessId,
          filters.businessIds.length
            ? filters.businessIds
            : ['00000000-0000-0000-0000-000000000000'],
        ),
      );
    if (filters.entityType)
      conditions.push(eq(schema.auditLog.entityType, filters.entityType));
    if (filters.entityId)
      conditions.push(eq(schema.auditLog.entityId, filters.entityId));
    if (filters.actorId)
      conditions.push(eq(schema.auditLog.actorId, filters.actorId));
    if (filters.action)
      conditions.push(eq(schema.auditLog.action, filters.action));
    if (filters.from)
      conditions.push(gte(schema.auditLog.createdAt, filters.from));
    if (filters.to) conditions.push(lte(schema.auditLog.createdAt, filters.to));
    return this.db
      .select({
        id: schema.auditLog.id,
        businessId: schema.auditLog.businessId,
        branchId: schema.auditLog.branchId,
        entityType: schema.auditLog.entityType,
        entityId: schema.auditLog.entityId,
        action: schema.auditLog.action,
        approvalLevel: schema.auditLog.approvalLevel,
        actorId: schema.auditLog.actorId,
        actorName: schema.users.name,
        actorRole: schema.auditLog.actorRole,
        reason: schema.auditLog.reason,
        before: schema.auditLog.before,
        after: schema.auditLog.after,
        source: schema.auditLog.source,
        deviceId: schema.auditLog.deviceId,
        createdAt: schema.auditLog.createdAt,
      })
      .from(schema.auditLog)
      .leftJoin(schema.users, eq(schema.auditLog.actorId, schema.users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(Math.min(Math.max(filters.limit ?? 200, 1), 1000));
  }
}
