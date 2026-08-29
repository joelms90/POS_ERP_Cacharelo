import { ForbiddenException } from '@nestjs/common';
import { OWNER_ROLE } from './roles';

export type AuthenticatedBusinessUser = {
  role?: string | null;
  roles?: unknown;
  businessId?: string | null;
  businessAccess?: Array<{
    businessId?: string | null;
    role?: string | null;
  }> | null;
};

export function getUserRoles(user: AuthenticatedBusinessUser | null | undefined): string[] {
  const roles = Array.isArray(user?.roles)
    ? user.roles
    : user?.role
      ? [user.role]
      : [];

  return Array.from(
    new Set(
      roles
        .map((role) => role?.toString().trim())
        .filter((role): role is string => Boolean(role)),
    ),
  );
}

export function isGlobalOwner(user: AuthenticatedBusinessUser | null | undefined): boolean {
  return getUserRoles(user).includes(OWNER_ROLE);
}

export function getUserBusinessIds(user: AuthenticatedBusinessUser | null | undefined): string[] {
  if (!user) throw new ForbiddenException('No user context');

  const ids: string[] = [];
  if (user.businessId) ids.push(user.businessId);
  if (user.businessAccess) {
    for (const access of user.businessAccess) {
      if (access.businessId && !ids.includes(access.businessId)) {
        ids.push(access.businessId);
      }
    }
  }
  return ids;
}

export function assertBusinessAccess(
  user: AuthenticatedBusinessUser | null | undefined,
  targetBusinessId: string | null | undefined,
) {
  if (!targetBusinessId) return;
  if (isGlobalOwner(user)) return;

  const ids = getUserBusinessIds(user);
  if (ids.length === 0) return;
  if (!ids.includes(targetBusinessId)) {
    throw new ForbiddenException('No tienes acceso a este negocio');
  }
}
