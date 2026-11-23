import { eq, sql } from 'drizzle-orm';
import * as schema from '../../database/schema';
import { actorRoles, actorSource, primaryRole, qty } from '../requisitions/requisition-flow';

/**
 * Purchase order (OC) lifecycle (see knowledge/workflows/procurement-to-stock.md):
 *
 *   draft ──authorize──► authorized ──mark purchased──► purchased ──entrada──► partially_received ──entrada──► received
 *     │   (owner / admin   "por comprar"   (Almacén y Compras)  "en camino a bodega"     │
 *     │    inventario)                                                                   └──close short──► closed_short
 *     └──────────────── cancel (reason) while nothing has been received ──► cancelled
 *
 * Owner / Admin. Inventario create, edit (drafts only), authorize, cancel and close.
 * Almacén y Compras only sees authorized OCs; it buys, marks them purchased and
 * registers the entrada (single count + price paid). Stock moves only at the entrada.
 */
export const PO_STATUS = {
  draft: 'draft',
  authorized: 'authorized',
  purchased: 'purchased',
  partiallyReceived: 'partially_received',
  received: 'received',
  cancelled: 'cancelled',
  closedShort: 'closed_short',
} as const;

/** What Almacén y Compras works on: to buy, on the way, partly received. */
export const PURCHASING_STATUSES = [PO_STATUS.authorized, PO_STATUS.purchased, PO_STATUS.partiallyReceived];
/** Never shown to Almacén y Compras. */
export const HIDDEN_FROM_WAREHOUSE_PO_STATUSES = [PO_STATUS.draft, PO_STATUS.cancelled];
/** An entrada needs the purchase to be marked first. */
export const RECEIVABLE_STATUSES = [PO_STATUS.purchased, PO_STATUS.partiallyReceived];
export const CAN_MARK_PURCHASED_STATUSES = [PO_STATUS.authorized, PO_STATUS.partiallyReceived];
/** Cancelling is only possible before anything entered the warehouse. */
export const CANCELLABLE_STATUSES = [PO_STATUS.draft, PO_STATUS.authorized, PO_STATUS.purchased];
/** OCs still expecting goods (used to avoid ordering the same product twice). */
export const OPEN_PO_STATUSES = [PO_STATUS.draft, PO_STATUS.authorized, PO_STATUS.purchased, PO_STATUS.partiallyReceived];

export const isPoManager = (actor: any) => actorRoles(actor).some((r) => r === 'owner' || r === 'inventory_admin');
export const isPurchasingOperator = (actor: any) => actorRoles(actor).includes('warehouse_purchasing_operator');

export const money = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100;

/** Estimated subtotal/total from the lines (tax kept as stored). */
export async function recalculatePurchaseOrderTotals(exec: any, poId: string) {
  await exec
    .update(schema.purchaseOrders)
    .set({
      subtotal: sql`(SELECT COALESCE(round(sum(${schema.purchaseOrderItems.quantityOrdered} * ${schema.purchaseOrderItems.unitCostEstimated}), 2), 0) FROM ${schema.purchaseOrderItems} WHERE ${schema.purchaseOrderItems.poId} = ${poId})`,
      total: sql`(SELECT COALESCE(round(sum(${schema.purchaseOrderItems.quantityOrdered} * ${schema.purchaseOrderItems.unitCostEstimated}), 2), 0) FROM ${schema.purchaseOrderItems} WHERE ${schema.purchaseOrderItems.poId} = ${poId}) + COALESCE(${schema.purchaseOrders.tax}, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(schema.purchaseOrders.id, poId));
}

export interface ReceiptLedgerRow {
  itemId: string;
  productId: string;
  quantityOrdered: number;
  previouslyReceived: number;
  quantityReceived: number;
  unitCostEstimated: number;
  unitCostActual: number;
}

/** Append one row per line of an entrada. Must run inside the entrada's transaction. */
export async function recordReceiptLedger(
  exec: any,
  ctx: {
    businessId: string;
    purchaseOrderId: string;
    receiptId: string;
    warehouseId: string | null;
    branchId: string | null;
    note: string | null;
    documentNumber: string | null;
    actor: any;
  },
  rows: ReceiptLedgerRow[],
) {
  if (rows.length === 0) return;
  await exec.insert(schema.purchaseOrderReceiptLedger).values(
    rows.map((row) => {
      const pendingBefore = Math.max(0, qty(row.quantityOrdered - row.previouslyReceived));
      return {
        businessId: ctx.businessId,
        purchaseOrderId: ctx.purchaseOrderId,
        itemId: row.itemId,
        productId: row.productId,
        receiptId: ctx.receiptId,
        warehouseId: ctx.warehouseId,
        branchId: ctx.branchId,
        quantityOrdered: qty(row.quantityOrdered).toFixed(3),
        previouslyReceived: qty(row.previouslyReceived).toFixed(3),
        quantityReceived: qty(row.quantityReceived).toFixed(3),
        pendingAfter: Math.max(0, qty(pendingBefore - row.quantityReceived)).toFixed(3),
        quantityDifference: qty(row.quantityReceived - pendingBefore).toFixed(3),
        unitCostEstimated: money(row.unitCostEstimated).toFixed(2),
        unitCostActual: money(row.unitCostActual).toFixed(2),
        costDifference: money(row.unitCostActual - row.unitCostEstimated).toFixed(2),
        note: ctx.note,
        documentNumber: ctx.documentNumber,
        actorId: ctx.actor?.sub ?? null,
        actorRole: primaryRole(ctx.actor),
        source: actorSource(ctx.actor),
      };
    }),
  );
}
