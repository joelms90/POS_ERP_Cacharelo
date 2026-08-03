ALTER TABLE "cash_shifts"
  ADD COLUMN IF NOT EXISTS "denomination_counts" jsonb,
  ADD COLUMN IF NOT EXISTS "close_notes" text,
  ADD COLUMN IF NOT EXISTS "close_snapshot" jsonb;
