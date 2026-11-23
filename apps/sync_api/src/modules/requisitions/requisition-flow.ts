import * as schema from '../../database/schema';
import { getUserRoles } from '../auth/business-access';
import { normalizeOperationalRole } from '../auth/roles';

/**
 * Requisition lifecycle (see knowledge/workflows/replenishment-and-transfers.md):
 *
 *   pending_approval ──approve──► approved ⇄ standby ──dispatch──► in_transit
 *        │                          │                                 │ deliver
 *        └──────────reject──────────┴──► rejected                     ▼
 *                                                     delivered ──receive──► completed
 *
 * OIS creates `pending_approval`; Owner / Admin. Inventario create `approved` directly.
 * Only approved requisitions are visible to Almacén y Bodega.
 */
export const REQUISITION_STATUS = {
  pendingApproval: 'pending_approval',
  approved: 'approved',
  standby: 'standby',
  inTransit: 'in_transit',
  delivered: 'delivered',
  completed: 'completed',
  rejected: 'rejected',
} as const;

/** Legacy rows created before this flow used 'pending'. */
export const AWAITING_APPROVAL_STATUSES = ['pending', 'pending_approval'];
/** Open requisitions whose stock has not left the warehouse yet. */
export const OPEN_BEFORE_DISPATCH_STATUSES = ['pending', 'pending_approval', 'approved', 'standby'];
/** What Almacén y Bodega sees in "Salidas". */
export const OUTBOUND_STATUSES = ['approved', 'standby', 'in_transit', 'delivered'];
/** Never shown to Almacén y Bodega. */
export const HIDDEN_FROM_WAREHOUSE_STATUSES = ['pending', 'pending_approval', 'rejected'];

export const APPROVER_ROLES = ['owner', 'inventory_admin'];
export const WAREHOUSE_ROLE = 'warehouse_purchasing_operator';
export const BRANCH_OPERATOR = 'branch_operator';

export type RequisitionStage = 'requested' | 'approved' | 'dispatched' | 'received';

export const actorRoles = (actor: any): string[] =>
  getUserRoles(actor).map((role) => normalizeOperationalRole(role) as string);

export const isApprover = (actor: any) => actorRoles(actor).some((r) => APPROVER_ROLES.includes(r));
export const isWarehouse = (actor: any) => actorRoles(actor).includes(WAREHOUSE_ROLE);
export const isBranchOperator = (actor: any) => actorRoles(actor).includes(BRANCH_OPERATOR);

const ROLE_PRIORITY = ['owner', 'inventory_admin', WAREHOUSE_ROLE, BRANCH_OPERATOR, 'support_tech'];
export const primaryRole = (actor: any): string | null => {
  const roles = actorRoles(actor);
  return ROLE_PRIORITY.find((r) => roles.includes(r)) ?? roles[0] ?? null;
};

/** Owner / Admin. Inventario work from the admin web; operational roles from the POS. */
export const actorSource = (actor: any): 'admin_web' | 'pos' => (isApprover(actor) ? 'admin_web' : 'pos');

/** Quantities are stored with 3 decimals; compare at that precision. */
export const qty = (value: unknown): number => Math.round((Number(value) || 0) * 1000) / 1000;
export const sameQty = (a: number, b: number) => Math.abs(qty(a) - qty(b)) < 0.0005;
export const qtyStr = (value: number) => qty(value).toFixed(3);

export interface RequisitionLedgerRow {
  productId: string;
  quantity: number;
  /** Quantity of the previous stage; null for 'requested'. */
  expectedQuantity: number | null;
  note?: string | null;
}

/**
 * Append one row per product to the requisition_item_ledger. Must run inside the
 * caller's transaction so the trail commits atomically with the state change.
 */
export async function recordRequisitionLedger(
  exec: any,
  ctx: {
    businessId: string;
    branchId: string;
    requisitionId: string;
    transferId?: string | null;
    stage: RequisitionStage;
    actor: any;
  },
  rows: RequisitionLedgerRow[],
) {
  if (rows.length === 0) return;
  await exec.insert(schema.requisitionItemLedger).values(
    rows.map((row) => ({
      businessId: ctx.businessId,
      branchId: ctx.branchId,
      requisitionId: ctx.requisitionId,
      transferId: ctx.transferId ?? null,
      productId: row.productId,
      stage: ctx.stage,
      quantity: qtyStr(row.quantity),
      expectedQuantity: row.expectedQuantity === null ? null : qtyStr(row.expectedQuantity),
      difference: row.expectedQuantity === null ? '0.000' : qtyStr(row.quantity - row.expectedQuantity),
      note: row.note?.trim() || null,
      actorId: ctx.actor?.sub ?? null,
      actorRole: primaryRole(ctx.actor),
      source: actorSource(ctx.actor),
    })),
  );
}

/** Merge repeated products so each requisition has one line per product. */
export function mergeRequestedItems(items: Array<{ productId: string; quantityRequested: number }>) {
  const merged = new Map<string, number>();
  for (const item of items) {
    merged.set(item.productId, qty((merged.get(item.productId) ?? 0) + qty(item.quantityRequested)));
  }
  return [...merged.entries()].map(([productId, quantityRequested]) => ({ productId, quantityRequested }));
}

/**
 * Insert a requisition with its items, ledger rows and audit entry inside `tx`.
 * Requisitions created by Owner / Admin. Inventario are approved immediately
 * (approved = requested); everyone else's wait for their authorization.
 */
export async function insertRequisition(
  tx: any,
  audit: { record: (exec: any, entry: any) => Promise<void> },
  args: {
    id?: string;
    businessId: string;
    branchId: string;
    toWarehouseId?: string | null;
    notes?: string | null;
    actor: any;
    items: Array<{ productId: string; quantityRequested: number }>;
  },
) {
  const autoApproved = isApprover(args.actor);
  const items = mergeRequestedItems(args.items);
  const now = new Date();

  const [requisition] = await tx
    .insert(schema.branchRequisitions)
    .values({
      ...(args.id ? { id: args.id } : {}),
      businessId: args.businessId,
      fromBranchId: args.branchId,
      toWarehouseId: args.toWarehouseId || null,
      createdBy: args.actor.sub,
      status: autoApproved ? REQUISITION_STATUS.approved : REQUISITION_STATUS.pendingApproval,
      notes: args.notes?.trim() || null,
      ...(autoApproved ? { approvedBy: args.actor.sub, approvedAt: now } : {}),
    })
    .returning();

  await tx.insert(schema.branchRequisitionItems).values(
    items.map((item) => ({
      requisitionId: requisition.id,
      productId: item.productId,
      quantityRequested: qtyStr(item.quantityRequested),
      quantityApproved: autoApproved ? qtyStr(item.quantityRequested) : '0.000',
    })),
  );

  const ctx = {
    businessId: args.businessId,
    branchId: args.branchId,
    requisitionId: requisition.id,
    actor: args.actor,
  };
  await recordRequisitionLedger(
    tx,
    { ...ctx, stage: 'requested' },
    items.map((item) => ({ productId: item.productId, quantity: item.quantityRequested, expectedQuantity: null, note: args.notes })),
  );
  if (autoApproved) {
    await recordRequisitionLedger(
      tx,
      { ...ctx, stage: 'approved' },
      items.map((item) => ({
        productId: item.productId,
        quantity: item.quantityRequested,
        expectedQuantity: item.quantityRequested,
        note: 'Autorizada al crearse (Propietario / Admin. Inventario)',
      })),
    );
  }

  await audit.record(tx, {
    businessId: args.businessId,
    branchId: args.branchId,
    entityType: 'branch_requisition',
    entityId: requisition.id,
    action: autoApproved ? 'created_approved' : 'created',
    actorId: args.actor.sub,
    actorRole: primaryRole(args.actor),
    reason: args.notes?.trim() || null,
    after: { status: requisition.status, items },
    source: actorSource(args.actor),
  });

  return requisition;
}
