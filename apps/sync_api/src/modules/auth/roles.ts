export const ADMIN_ROLES = ['owner', 'inventory_admin'] as const;
export const POS_ROLES = ['waiter', 'cashier', 'kitchen', 'admin', 'vendedor', 'encargado', 'empleado'] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];
export type PosRole = (typeof POS_ROLES)[number];
export type UserRole = AdminRole | PosRole;

export const OWNER_ROLE: AdminRole = 'owner';
export const INVENTORY_ADMIN_ROLE: AdminRole = 'inventory_admin';

export const ENCARGADO_ROLE: PosRole = 'encargado';

export const isAdminRole = (role?: string): role is AdminRole =>
  ADMIN_ROLES.includes(role as AdminRole);
