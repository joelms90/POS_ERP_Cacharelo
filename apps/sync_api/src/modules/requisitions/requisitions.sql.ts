/**
 * Requisition dispatch flow: idempotent DDL + one-time reconciliation of legacy rows.
 *
 * Shared by migrations/0023_requisition_dispatch_flow.sql and
 * scripts/idempotent-deploy-migrations.ts. Every statement must be safe to run
 * repeatedly.
 *
 * Flow: pending_approval → approved ⇄ standby → in_transit → delivered → completed
 * (or rejected). Approval no longer creates a transfer; Almacén y Bodega creates
 * and ships it in one step when dispatching.
 */
export const REQUISITION_DISPATCH_FLOW_SQL = `
-- 1) Columns
ALTER TABLE "branch_requisitions"
  ADD COLUMN IF NOT EXISTS "approved_by" uuid REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "approved_at" timestamptz;

ALTER TABLE "branch_requisition_items"
  ADD COLUMN IF NOT EXISTS "quantity_dispatched" numeric(12,3),
  ADD COLUMN IF NOT EXISTS "quantity_received" numeric(12,3);

ALTER TABLE "stock_transfers"
  ADD COLUMN IF NOT EXISTS "requisition_id" uuid REFERENCES "branch_requisitions"("id"),
  ADD COLUMN IF NOT EXISTS "shipped_by" uuid REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "delivered_by" uuid REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "delivered_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "delivery_note" text;

CREATE INDEX IF NOT EXISTS "idx_stock_transfers_requisition" ON "stock_transfers" ("requisition_id");

-- 2) Append-only per-product requisition ledger
CREATE TABLE IF NOT EXISTS "requisition_item_ledger" (
  "id" bigserial PRIMARY KEY,
  "business_id" uuid NOT NULL REFERENCES "businesses"("id"),
  "branch_id" uuid NOT NULL REFERENCES "branches"("id"),
  "requisition_id" uuid NOT NULL REFERENCES "branch_requisitions"("id"),
  "transfer_id" uuid REFERENCES "stock_transfers"("id"),
  "product_id" uuid NOT NULL REFERENCES "products"("id"),
  "stage" varchar(20) NOT NULL,
  "quantity" numeric(12,3) NOT NULL,
  "expected_quantity" numeric(12,3),
  "difference" numeric(12,3) NOT NULL DEFAULT 0,
  "note" text,
  "actor_id" uuid REFERENCES "users"("id"),
  "actor_role" varchar(50),
  "source" varchar(20) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_req_item_ledger_requisition" ON "requisition_item_ledger" ("requisition_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_req_item_ledger_product" ON "requisition_item_ledger" ("business_id", "product_id", "created_at");

CREATE OR REPLACE FUNCTION requisition_item_ledger_immutable() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.allow_requisition_ledger_purge', true) = 'on' THEN
    RETURN COALESCE(OLD, NEW);
  END IF;
  RAISE EXCEPTION 'requisition_item_ledger is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "trg_requisition_item_ledger_immutable" ON "requisition_item_ledger";
CREATE TRIGGER "trg_requisition_item_ledger_immutable"
  BEFORE UPDATE OR DELETE ON "requisition_item_ledger"
  FOR EACH ROW EXECUTE FUNCTION requisition_item_ledger_immutable();

-- 3) Legacy reconciliation (only touches rows from before this flow existed)
UPDATE "branch_requisitions" SET "status" = 'pending_approval' WHERE "status" = 'pending';
-- Legacy 'standby' was Bodega holding an unapproved request; it still needs authorization.
-- (In the new flow standby always follows an approval, so approved_at is set.)
UPDATE "branch_requisitions" SET "status" = 'pending_approval' WHERE "status" = 'standby' AND "approved_at" IS NULL;

-- Before this flow, approving created an unlinked transfer whose notes start with
-- "Aprobación de Requisición: <requisition notes>." Link it back by business, branch,
-- notes prefix and product set. Requisitions that are exact duplicates (same items and
-- quantities, same candidate transfers) are interchangeable, so they are paired in
-- order (oldest requisition ↔ most advanced transfer). Anything else ambiguous is
-- left unlinked and reported by REQUISITION_UNLINKED_LEGACY_REPORT_SQL.
WITH legacy AS (
  SELECT r.* FROM "branch_requisitions" r
  WHERE r."status" = 'approved' AND r."approved_at" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "stock_transfers" x WHERE x."requisition_id" = r."id")
),
candidates AS (
  SELECT r."id" AS rid, t."id" AS tid
  FROM legacy r
  JOIN "stock_transfers" t
    ON t."business_id" = r."business_id"
   AND t."to_branch_id" = r."from_branch_id"
   AND t."requisition_id" IS NULL
   AND left(t."notes", length('Aprobación de Requisición: ' || coalesce(r."notes", '') || '.'))
       = 'Aprobación de Requisición: ' || coalesce(r."notes", '') || '.'
  WHERE (SELECT array_agg(i."product_id" ORDER BY i."product_id") FROM "branch_requisition_items" i WHERE i."requisition_id" = r."id")
      = (SELECT array_agg(ti."product_id" ORDER BY ti."product_id") FROM "stock_transfer_items" ti
         WHERE ti."transfer_id" = t."id" AND ti."quantity" > 0)
),
req_groups AS (
  SELECT r."id" AS rid, r."updated_at",
    (SELECT string_agg(i."product_id"::text || ':' || i."quantity_requested"::text, ',' ORDER BY i."product_id")
       FROM "branch_requisition_items" i WHERE i."requisition_id" = r."id") AS items_sig,
    (SELECT array_agg(c.tid ORDER BY c.tid) FROM candidates c WHERE c.rid = r."id") AS tids
  FROM legacy r
),
sized AS (
  SELECT g.*, count(*) OVER (PARTITION BY g.items_sig, g.tids) AS group_size,
    row_number() OVER (PARTITION BY g.items_sig, g.tids ORDER BY g."updated_at", g.rid) AS rn
  FROM req_groups g
  WHERE g.tids IS NOT NULL
),
-- A group is pairable when its transfers are matched by exactly its own requisitions.
pairable AS (
  SELECT s.* FROM sized s
  WHERE s.group_size = array_length(s.tids, 1)
    AND NOT EXISTS (
      SELECT 1 FROM candidates c
      WHERE c.tid = ANY (s.tids)
        AND c.rid NOT IN (SELECT s2.rid FROM sized s2 WHERE s2.items_sig = s.items_sig AND s2.tids = s.tids)
    )
),
ranked_transfers AS (
  SELECT p.rid, p.rn, t."id" AS tid,
    row_number() OVER (
      PARTITION BY p.rid
      ORDER BY CASE t."status" WHEN 'received' THEN 1 WHEN 'completed' THEN 1 WHEN 'in_transit' THEN 2 ELSE 3 END, t."id"
    ) AS trn
  FROM pairable p
  JOIN "stock_transfers" t ON t."id" = ANY (p.tids)
)
UPDATE "stock_transfers" t SET "requisition_id" = rt.rid
FROM ranked_transfers rt
WHERE rt.trn = rt.rn AND t."id" = rt.tid;

-- Legacy approved requisitions: Bodega dispatches the approved quantities.
UPDATE "branch_requisition_items" i SET "quantity_approved" = i."quantity_requested"
FROM "branch_requisitions" r
WHERE i."requisition_id" = r."id" AND r."approved_at" IS NULL
  AND r."status" = 'approved' AND i."quantity_approved" = 0;

-- A linked transfer still 'pending' never moved stock: cancel it so Bodega dispatches
-- the requisition through the new flow.
UPDATE "stock_transfers" t SET "status" = 'cancelled'
FROM "branch_requisitions" r
WHERE t."requisition_id" = r."id" AND t."status" = 'pending' AND r."status" = 'approved' AND r."approved_at" IS NULL;

-- Linked transfers already shipped or received carry their state to the requisition.
UPDATE "branch_requisitions" r
SET "status" = CASE t."status" WHEN 'in_transit' THEN 'in_transit' ELSE 'completed' END
FROM "stock_transfers" t
WHERE t."requisition_id" = r."id" AND r."status" = 'approved' AND r."approved_at" IS NULL
  AND t."status" IN ('in_transit', 'received', 'completed');

UPDATE "branch_requisition_items" i SET
  "quantity_dispatched" = ti."quantity",
  "quantity_received" = CASE WHEN t."status" IN ('received', 'completed') THEN ti."quantity_received" ELSE NULL END
FROM "stock_transfers" t
JOIN "stock_transfer_items" ti ON ti."transfer_id" = t."id"
WHERE t."requisition_id" = i."requisition_id" AND ti."product_id" = i."product_id"
  AND i."quantity_dispatched" IS NULL AND t."status" IN ('in_transit', 'received', 'completed');
`;

/** Legacy approved requisitions that could not be linked to their transfer. Review them by hand. */
export const REQUISITION_UNLINKED_LEGACY_REPORT_SQL = `
SELECT r."id", r."business_id", r."from_branch_id", r."updated_at"
FROM "branch_requisitions" r
WHERE r."status" = 'approved' AND r."approved_at" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "stock_transfers" t WHERE t."requisition_id" = r."id")
ORDER BY r."updated_at";
`;
