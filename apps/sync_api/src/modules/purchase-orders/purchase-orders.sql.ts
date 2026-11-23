/**
 * Purchase order (OC) flow: idempotent DDL + reconciliation of legacy rows.
 *
 * Shared by migrations/0024_purchase_order_flow.sql and
 * scripts/idempotent-deploy-migrations.ts. Safe to run repeatedly.
 *
 * draft → authorized → purchased → partially_received → received | cancelled | closed_short
 */
export const PURCHASE_ORDER_FLOW_SQL = `
CREATE TABLE IF NOT EXISTS "purchase_order_receipt_ledger" (
  "id" bigserial PRIMARY KEY,
  "business_id" uuid NOT NULL REFERENCES "businesses"("id"),
  "purchase_order_id" uuid NOT NULL REFERENCES "purchase_orders"("id"),
  "item_id" uuid NOT NULL REFERENCES "purchase_order_items"("id"),
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "receipt_id" uuid NOT NULL,
  "warehouse_id" uuid REFERENCES "warehouses"("id"),
  "branch_id" uuid REFERENCES "branches"("id"),
  "quantity_ordered" numeric(12,3) NOT NULL,
  "previously_received" numeric(12,3) NOT NULL,
  "quantity_received" numeric(12,3) NOT NULL,
  "pending_after" numeric(12,3) NOT NULL,
  "quantity_difference" numeric(12,3) NOT NULL,
  "unit_cost_estimated" numeric(10,2) NOT NULL,
  "unit_cost_actual" numeric(10,2) NOT NULL,
  "cost_difference" numeric(10,2) NOT NULL,
  "note" text,
  "document_number" varchar(100),
  "actor_id" uuid REFERENCES "users"("id"),
  "actor_role" varchar(50),
  "source" varchar(20) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_po_receipt_ledger_po" ON "purchase_order_receipt_ledger" ("purchase_order_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_po_receipt_ledger_product" ON "purchase_order_receipt_ledger" ("business_id", "product_id", "created_at");

CREATE OR REPLACE FUNCTION purchase_order_receipt_ledger_immutable() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.allow_po_ledger_purge', true) = 'on' THEN
    RETURN COALESCE(OLD, NEW);
  END IF;
  RAISE EXCEPTION 'purchase_order_receipt_ledger is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "trg_purchase_order_receipt_ledger_immutable" ON "purchase_order_receipt_ledger";
CREATE TRIGGER "trg_purchase_order_receipt_ledger_immutable"
  BEFORE UPDATE OR DELETE ON "purchase_order_receipt_ledger"
  FOR EACH ROW EXECUTE FUNCTION purchase_order_receipt_ledger_immutable();

-- 'sent' never meant anything was sent to the supplier: it is "authorized, to be bought".
UPDATE "purchase_orders" SET "status" = 'authorized' WHERE "status" = 'sent';

-- Totals were never calculated: estimated subtotal from the lines.
UPDATE "purchase_orders" po SET
  "subtotal" = t.subtotal,
  "total" = t.subtotal + COALESCE(po."tax", 0)
FROM (
  SELECT "po_id", round(sum("quantity_ordered" * "unit_cost_estimated"), 2) AS subtotal
  FROM "purchase_order_items" GROUP BY "po_id"
) t
WHERE t."po_id" = po."id" AND COALESCE(po."subtotal", 0) = 0;
`;
