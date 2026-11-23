/**
 * Spec 019 — Supervisor de sucursal: idempotent DDL.
 *
 * Shared by migrations/0022_supervisor_cash_approvals.sql and
 * scripts/idempotent-deploy-migrations.ts. Every statement must be safe to run
 * repeatedly (IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS).
 *
 * The cash ledger (cash_transactions) is append-only: financial columns cannot
 * be updated and rows cannot be deleted, except by data-reset scripts that opt in
 * with `SELECT set_config('app.allow_cash_ledger_purge', 'on', true)`.
 */
export const SUPERVISOR_CASH_APPROVALS_SQL = `
-- 1) Review chain on cash_shifts
ALTER TABLE "cash_shifts"
  ADD COLUMN IF NOT EXISTS "review_status" varchar(30) NOT NULL DEFAULT 'no_aplica',
  ADD COLUMN IF NOT EXISTS "client_uuid" varchar(120),
  ADD COLUMN IF NOT EXISTS "closed_by" uuid REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "closed_offline" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "local_expected_cash" numeric(10,2),
  ADD COLUMN IF NOT EXISTS "n1_resolver_role" varchar(30),
  ADD COLUMN IF NOT EXISTS "operator_reviewed_by" uuid REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "operator_reviewed_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "operator_notes" text,
  ADD COLUMN IF NOT EXISTS "reviewed_by" uuid REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "reviewed_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "review_notes" text,
  ADD COLUMN IF NOT EXISTS "approved_amount" numeric(10,2),
  ADD COLUMN IF NOT EXISTS "approved_difference" numeric(10,2),
  ADD COLUMN IF NOT EXISTS "approval_snapshot" jsonb,
  ADD COLUMN IF NOT EXISTS "recount_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "open_block_overridden_by" uuid REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "open_block_overridden_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "open_block_override_reason" text;
CREATE UNIQUE INDEX IF NOT EXISTS "unq_cash_shift_client_uuid"
  ON "cash_shifts" ("client_uuid") WHERE "client_uuid" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_cash_shift_review"
  ON "cash_shifts" ("branch_id", "review_status")
  WHERE "review_status" IN ('pendiente_n1', 'rechazado_n1', 'pendiente_n2', 'rechazado_n2');

-- 2) cash_transactions becomes an append-only ledger
ALTER TABLE "cash_transactions"
  ADD COLUMN IF NOT EXISTS "client_uuid" varchar(120),
  ADD COLUMN IF NOT EXISTS "created_by" uuid REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "category" varchar(40),
  ADD COLUMN IF NOT EXISTS "entry_kind" varchar(20) NOT NULL DEFAULT 'movimiento',
  ADD COLUMN IF NOT EXISTS "reverses_transaction_id" uuid REFERENCES "cash_transactions"("id"),
  ADD COLUMN IF NOT EXISTS "replaces_transaction_id" uuid REFERENCES "cash_transactions"("id"),
  ADD COLUMN IF NOT EXISTS "approval_status" varchar(30) NOT NULL DEFAULT 'aprobado_historico',
  ADD COLUMN IF NOT EXISTS "reviewed_by" uuid REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "reviewed_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "review_reason" text,
  ADD COLUMN IF NOT EXISTS "review_level" varchar(10),
  ADD COLUMN IF NOT EXISTS "device_id" varchar(255),
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
ALTER TABLE "cash_transactions"
  ADD COLUMN IF NOT EXISTS "cash_effect" numeric(10,2) GENERATED ALWAYS AS (
    (CASE WHEN "type" = 'cash-in' THEN "amount" ELSE -"amount" END)
    * (CASE WHEN "entry_kind" = 'reverso' THEN -1 ELSE 1 END)
  ) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS "unq_cash_tx_client_uuid"
  ON "cash_transactions" ("client_uuid") WHERE "client_uuid" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "unq_cash_tx_reverses"
  ON "cash_transactions" ("reverses_transaction_id") WHERE "reverses_transaction_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_cash_tx_shift_created" ON "cash_transactions" ("shift_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_cash_tx_shift_status" ON "cash_transactions" ("shift_id", "approval_status");

CREATE OR REPLACE FUNCTION cash_ledger_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF coalesce(current_setting('app.allow_cash_ledger_purge', true), '') = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'cash_transactions is an append-only ledger: rows cannot be deleted';
  END IF;
  IF NEW.shift_id IS DISTINCT FROM OLD.shift_id
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.entry_kind IS DISTINCT FROM OLD.entry_kind
     OR NEW.reverses_transaction_id IS DISTINCT FROM OLD.reverses_transaction_id
     OR NEW.replaces_transaction_id IS DISTINCT FROM OLD.replaces_transaction_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'cash_transactions financial columns are immutable; insert a reversal entry instead';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "trg_cash_ledger_immutable" ON "cash_transactions";
CREATE TRIGGER "trg_cash_ledger_immutable"
  BEFORE UPDATE OR DELETE ON "cash_transactions"
  FOR EACH ROW EXECUTE FUNCTION cash_ledger_immutable();

-- 3) Supervisor assignments (several branches per supervisor)
CREATE TABLE IF NOT EXISTS "supervisor_branch_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "businesses"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "branch_id" uuid NOT NULL REFERENCES "branches"("id"),
  "assigned_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "revoked_at" timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS "unq_sba_user_branch_active"
  ON "supervisor_branch_assignments" ("user_id", "branch_id") WHERE "revoked_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_sba_branch" ON "supervisor_branch_assignments" ("branch_id");

-- 4) Cashier debts (audit-only record of approved shortages)
CREATE TABLE IF NOT EXISTS "cashier_debts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "businesses"("id"),
  "branch_id" uuid NOT NULL REFERENCES "branches"("id"),
  "shift_id" uuid NOT NULL REFERENCES "cash_shifts"("id") ON DELETE CASCADE,
  "cashier_id" uuid NOT NULL REFERENCES "users"("id"),
  "amount" numeric(10,2) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'vigente',
  "generated_by" uuid REFERENCES "users"("id"),
  "generated_at" timestamptz NOT NULL DEFAULT now(),
  "voided_by" uuid REFERENCES "users"("id"),
  "voided_at" timestamptz,
  "version" integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS "unq_cashier_debt_shift_active"
  ON "cashier_debts" ("shift_id") WHERE "status" <> 'anulado';
CREATE INDEX IF NOT EXISTS "idx_cashier_debts_cashier" ON "cashier_debts" ("cashier_id", "status");

-- 5) Persistent notifications (queried over REST)
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "businesses"("id"),
  "branch_id" uuid REFERENCES "branches"("id"),
  "recipient_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "type" varchar(40) NOT NULL,
  "requires_action" boolean NOT NULL DEFAULT false,
  "entity_type" varchar(40) NOT NULL,
  "entity_id" uuid NOT NULL,
  "title" varchar(150) NOT NULL,
  "body" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "read_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "idx_notifications_recipient"
  ON "notifications" ("recipient_user_id", "read_at", "created_at");
CREATE INDEX IF NOT EXISTS "idx_notifications_branch" ON "notifications" ("branch_id", "created_at");

-- 6) Append-only audit log
CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "business_id" uuid NOT NULL REFERENCES "businesses"("id"),
  "branch_id" uuid REFERENCES "branches"("id"),
  "entity_type" varchar(40) NOT NULL,
  "entity_id" uuid NOT NULL,
  "action" varchar(40) NOT NULL,
  "approval_level" varchar(10),
  "actor_id" uuid REFERENCES "users"("id"),
  "actor_role" varchar(50),
  "reason" text,
  "before" jsonb,
  "after" jsonb,
  "source" varchar(20) NOT NULL,
  "device_id" varchar(255),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_audit_log_entity" ON "audit_log" ("entity_type", "entity_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_log_branch" ON "audit_log" ("branch_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_log_actor" ON "audit_log" ("actor_id", "created_at");

CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "trg_audit_log_immutable" ON "audit_log";
CREATE TRIGGER "trg_audit_log_immutable"
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
`;
