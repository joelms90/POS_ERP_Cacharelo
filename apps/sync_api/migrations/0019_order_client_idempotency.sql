ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "client_uuid" varchar(120);

ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "client_uuid" varchar(120);

CREATE UNIQUE INDEX IF NOT EXISTS "orders_client_uuid_unique_idx"
  ON "orders" ("client_uuid")
  WHERE "client_uuid" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "order_items_client_uuid_unique_idx"
  ON "order_items" ("client_uuid")
  WHERE "client_uuid" IS NOT NULL;
