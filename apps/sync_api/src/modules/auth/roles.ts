export const ADMIN_ROLES = ['owner', 'inventory_admin', 'support_tech'] as const;
export const POS_ROLES = ['waiter', 'cashier', 'kitchen', 'branch_operator', 'warehouse_purchasing_operator', 'encargado', 'responsable'] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];
export type PosRole = (typeof POS_ROLES)[number];
export type UserRole = AdminRole | PosRole;

export const OWNER_ROLE: AdminRole = 'owner';
export const INVENTORY_ADMIN_ROLE: AdminRole = 'inventory_admin';
export const SUPPORT_TECH_ROLE: AdminRole = 'support_tech';

export const BRANCH_OPERATOR_ROLE: PosRole = 'branch_operator';
export const CASHIER_ROLE: PosRole = 'cashier';
export const WAREHOUSE_PURCHASING_OPERATOR_ROLE: PosRole = 'warehouse_purchasing_operator';
// Compatibility aliases accepted while existing terminal users are migrated.
export const ENCARGADO_ROLE: PosRole = 'encargado';
export const RESPONSABLE_ROLE: PosRole = 'responsable';

export const normalizeOperationalRole = (role?: string): string | undefined => {
  if (role === ENCARGADO_ROLE || role === RESPONSABLE_ROLE) return BRANCH_OPERATOR_ROLE;
  return role;
};

export const isAdminRole = (role?: string): role is AdminRole =>
  ADMIN_ROLES.includes(role as AdminRole);
