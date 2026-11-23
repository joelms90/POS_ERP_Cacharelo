import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, gte, isNull, lte, SQL } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import type { AppDatabase, DbExecutor } from './db-executor';

export type NotificationType =
  | 'aprobacion_pendiente'
  | 'aprobacion_resuelta'
  | 'movimiento_cancelado'
  | 'movimiento_ajustado'
  | 'apertura_bloqueada'
  | 'apertura_desbloqueada'
  | 'adeudo_generado'
  | 'adeudo_anulado';

export interface NotificationInput {
  businessId: string;
  branchId?: string | null;
  recipients: Array<string | null | undefined>;
  type: NotificationType;
  requiresAction?: boolean;
  entityType: 'cash_shift' | 'cash_transaction' | 'cashier_debt';
  entityId: string;
  title: string;
  body?: string | null;
}

/** Persistent notifications queried over REST (spec 019 §8, D-6: no push). */
@Injectable()
export class NotificationsService {
  constructor(@Inject(DRIZZLE_CONNECTION) private readonly db: AppDatabase) {}

  async notify(exec: DbExecutor, input: NotificationInput) {
    const recipients = Array.from(new Set(input.recipients.filter((id): id is string => Boolean(id))));
    if (recipients.length === 0) return;
    await exec.insert(schema.notifications).values(
      recipients.map((recipientUserId) => ({
        businessId: input.businessId,
        branchId: input.branchId ?? null,
        recipientUserId,
        type: input.type,
        requiresAction: input.requiresAction ?? false,
        entityType: input.entityType,
        entityId: input.entityId,
        title: input.title.slice(0, 150),
        body: input.body ?? null,
      })),
    );
  }

  /** Action notifications are marked read automatically once the entity leaves the pending state. */
  async resolveActionFor(exec: DbExecutor, entityType: string, entityId: string) {
    await exec
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(schema.notifications.entityType, entityType),
          eq(schema.notifications.entityId, entityId),
          eq(schema.notifications.requiresAction, true),
          isNull(schema.notifications.readAt),
        ),
      );
  }

  async list(
    userId: string,
    filters: { unread?: boolean; branchId?: string; type?: string; from?: Date; to?: Date; limit?: number; offset?: number },
  ) {
    const conditions: SQL[] = [eq(schema.notifications.recipientUserId, userId)];
    if (filters.unread) conditions.push(isNull(schema.notifications.readAt));
    if (filters.branchId) conditions.push(eq(schema.notifications.branchId, filters.branchId));
    if (filters.type) conditions.push(eq(schema.notifications.type, filters.type));
    if (filters.from) conditions.push(gte(schema.notifications.createdAt, filters.from));
    if (filters.to) conditions.push(lte(schema.notifications.createdAt, filters.to));
    return this.db
      .select({
        id: schema.notifications.id,
        businessId: schema.notifications.businessId,
        branchId: schema.notifications.branchId,
        branchName: schema.branches.name,
        type: schema.notifications.type,
        requiresAction: schema.notifications.requiresAction,
        entityType: schema.notifications.entityType,
        entityId: schema.notifications.entityId,
        title: schema.notifications.title,
        body: schema.notifications.body,
        createdAt: schema.notifications.createdAt,
        readAt: schema.notifications.readAt,
      })
      .from(schema.notifications)
      .leftJoin(schema.branches, eq(schema.notifications.branchId, schema.branches.id))
      .where(and(...conditions))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(Math.min(Math.max(filters.limit ?? 50, 1), 200))
      .offset(Math.max(filters.offset ?? 0, 0));
  }

  async unreadCount(userId: string) {
    const [row] = await this.db
      .select({ total: count() })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.recipientUserId, userId), isNull(schema.notifications.readAt)));
    const [action] = await this.db
      .select({ total: count() })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.recipientUserId, userId),
          isNull(schema.notifications.readAt),
          eq(schema.notifications.requiresAction, true),
        ),
      );
    return { unread: Number(row?.total ?? 0), requiresAction: Number(action?.total ?? 0) };
  }

  async markRead(userId: string, id: string) {
    const rows = await this.db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(and(eq(schema.notifications.id, id), eq(schema.notifications.recipientUserId, userId)))
      .returning({ id: schema.notifications.id });
    if (rows.length === 0) throw new NotFoundException('Notificación no encontrada.');
    return { id, read: true };
  }

  async markAllRead(userId: string) {
    const rows = await this.db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(and(eq(schema.notifications.recipientUserId, userId), isNull(schema.notifications.readAt)))
      .returning({ id: schema.notifications.id });
    return { updated: rows.length };
  }
}
