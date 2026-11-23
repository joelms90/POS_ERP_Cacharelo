import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import {
  assertBusinessAccess,
  getUserBusinessIds,
} from '../auth/business-access';
import { BRANCH_SUPERVISOR_ROLE, OWNER_ROLE } from '../auth/roles';
import {
  ApprovalActor,
  normalizeRoles,
} from '../supervision/cash-approval.rules';
import type { AppDatabase } from './db-executor';

export type JwtUser = {
  sub?: string;
  id?: string;
  role?: string;
  roles?: string[];
  branchId?: string | null;
  businessId?: string | null;
  businessAccess?: Array<{
    businessId?: string | null;
    role?: string | null;
  }> | null;
};

/** Resolves who may act on which branch (spec 019: supervisors via assignments, owner business-wide). */
@Injectable()
export class SupervisorScopeService {
  constructor(@Inject(DRIZZLE_CONNECTION) private readonly db: AppDatabase) {}

  async buildActor(user: JwtUser | undefined): Promise<ApprovalActor> {
    const id = user?.sub ?? user?.id;
    if (!id)
      throw new ForbiddenException('Se requiere un usuario autenticado.');
    const roles = normalizeRoles(user?.roles, user?.role);
    const assignedBranchIds = roles.includes(BRANCH_SUPERVISOR_ROLE)
      ? await this.assignedBranchIds(id)
      : [];
    return {
      id,
      roles,
      branchId: user?.branchId ?? null,
      assignedBranchIds,
      isOwner: roles.includes(OWNER_ROLE),
    };
  }

  /** Owner must also have access to the business the item belongs to. */
  actorForBusiness(
    actor: ApprovalActor,
    user: JwtUser | undefined,
    businessId: string,
  ): ApprovalActor {
    if (!actor.isOwner) return actor;
    try {
      assertBusinessAccess(user, businessId);
      return actor;
    } catch {
      return { ...actor, isOwner: false };
    }
  }

  async assignedBranchIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ branchId: schema.supervisorBranchAssignments.branchId })
      .from(schema.supervisorBranchAssignments)
      .where(
        and(
          eq(schema.supervisorBranchAssignments.userId, userId),
          isNull(schema.supervisorBranchAssignments.revokedAt),
        ),
      );
    return rows.map((row) => row.branchId);
  }

  /**
   * Branches the actor may see in supervision views: assigned branches for a
   * supervisor, every branch of the accessible businesses for the owner, and the
   * bound branch for an OIS.
   */
  async visibleBranchIds(
    actor: ApprovalActor,
    user: JwtUser | undefined,
  ): Promise<string[]> {
    const ids = new Set<string>(actor.assignedBranchIds);
    if (actor.branchId) ids.add(actor.branchId);
    if (actor.isOwner) {
      const businessIds = getUserBusinessIds(user as any);
      const rows = businessIds.length
        ? await this.db
            .select({ id: schema.branches.id })
            .from(schema.branches)
            .where(
              and(
                inArray(schema.branches.businessId, businessIds),
                isNull(schema.branches.deletedAt),
              ),
            )
        : await this.db
            .select({ id: schema.branches.id })
            .from(schema.branches)
            .where(isNull(schema.branches.deletedAt));
      rows.forEach((row) => ids.add(row.id));
    }
    return Array.from(ids);
  }

  async getBranch(branchId: string) {
    const [branch] = await this.db
      .select({
        id: schema.branches.id,
        businessId: schema.branches.businessId,
        name: schema.branches.name,
      })
      .from(schema.branches)
      .where(eq(schema.branches.id, branchId))
      .limit(1);
    if (!branch) throw new NotFoundException('Sucursal no encontrada.');
    return branch;
  }

  async supervisorsOf(branchId: string): Promise<string[]> {
    const rows = await this.db
      .select({ userId: schema.supervisorBranchAssignments.userId })
      .from(schema.supervisorBranchAssignments)
      .innerJoin(
        schema.users,
        eq(schema.supervisorBranchAssignments.userId, schema.users.id),
      )
      .where(
        and(
          eq(schema.supervisorBranchAssignments.branchId, branchId),
          isNull(schema.supervisorBranchAssignments.revokedAt),
          isNull(schema.users.deletedAt),
        ),
      );
    return rows.map((row) => row.userId);
  }

  async ownersOf(businessId: string): Promise<string[]> {
    const direct = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.businessId, businessId),
          isNull(schema.users.deletedAt),
          or(
            eq(schema.users.role, OWNER_ROLE),
            sql`${schema.users.roles} ? 'owner'`,
          ),
        ),
      );
    const access = await this.db
      .select({ id: schema.adminBusinessAccess.userId })
      .from(schema.adminBusinessAccess)
      .where(
        and(
          eq(schema.adminBusinessAccess.businessId, businessId),
          eq(schema.adminBusinessAccess.role, OWNER_ROLE),
          isNull(schema.adminBusinessAccess.deletedAt),
        ),
      );
    return Array.from(new Set([...direct, ...access].map((row) => row.id)));
  }

  /** Branch operators (OIS) of a branch, including shared operators of the business. */
  async operatorsOf(branchId: string, businessId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(
        and(
          isNull(schema.users.deletedAt),
          or(
            eq(schema.users.branchId, branchId),
            and(
              isNull(schema.users.branchId),
              eq(schema.users.businessId, businessId),
            ),
          ),
          or(
            sql`${schema.users.roles} ?| array['branch_operator','encargado','responsable']`,
            inArray(schema.users.role, [
              'branch_operator',
              'encargado',
              'responsable',
            ]),
          ),
        ),
      );
    return rows.map((row) => row.id);
  }

  async userRoles(userId: string): Promise<string[]> {
    const [row] = await this.db
      .select({ role: schema.users.role, roles: schema.users.roles })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    return row ? normalizeRoles(row.roles, row.role) : [];
  }
}
