import { Client } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL env var is required');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('Checking and creating tables...');

    // 1. purchase_orders
    await client.query(`
      CREATE TABLE IF NOT EXISTS "purchase_orders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "business_id" uuid NOT NULL,
        "provider_id" uuid NOT NULL,
        "warehouse_id" uuid,
        "branch_id" uuid,
        "po_number" varchar(50) NOT NULL,
        "status" varchar(20) DEFAULT 'draft' NOT NULL,
        "order_date" timestamp with time zone DEFAULT now() NOT NULL,
        "expected_delivery_date" timestamp with time zone,
        "actual_delivery_date" timestamp with time zone,
        "subtotal" numeric(10, 2) DEFAULT '0.00',
        "tax" numeric(10, 2) DEFAULT '0.00',
        "total" numeric(10, 2) DEFAULT '0.00',
        "notes" text,
        "created_by" uuid NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "deleted_at" timestamp with time zone,
        "version" integer DEFAULT 1 NOT NULL,
        CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
      );
    `);
    console.log('Table purchase_orders ensured.');

    // 2. purchase_order_items
    await client.query(`
      CREATE TABLE IF NOT EXISTS "purchase_order_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "po_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "quantity_ordered" numeric(12, 3) NOT NULL,
        "quantity_received" numeric(12, 3) DEFAULT '0.000' NOT NULL,
        "unit_cost_estimated" numeric(10, 2) NOT NULL,
        "unit_cost_actual" numeric(10, 2) DEFAULT '0.00' NOT NULL
      );
    `);
    console.log('Table purchase_order_items ensured.');

    // 3. branch_requisitions
    await client.query(`
      CREATE TABLE IF NOT EXISTS "branch_requisitions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "business_id" uuid NOT NULL,
        "from_branch_id" uuid NOT NULL,
        "to_warehouse_id" uuid NOT NULL,
        "status" varchar(20) DEFAULT 'pending_approval' NOT NULL,
        "notes" text,
        "created_by" uuid NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "version" integer DEFAULT 1 NOT NULL
      );
    `);
    console.log('Table branch_requisitions ensured.');

    // 4. branch_requisition_items
    await client.query(`
      CREATE TABLE IF NOT EXISTS "branch_requisition_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "requisition_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "quantity_requested" numeric(12, 3) NOT NULL,
        "quantity_approved" numeric(12, 3) DEFAULT '0.000' NOT NULL
      );
    `);
    console.log('Table branch_requisition_items ensured.');

    // 5. Constraints
    console.log('Adding constraints...');
    const addConstraintSafe = async (table: string, constraint: string, sqlQuery: string) => {
      try {
        await client.query(sqlQuery);
        console.log(`Constraint ${constraint} added.`);
      } catch (e: any) {
        if (e.code === '42710') {
          console.log(`Constraint ${constraint} already exists, skipping.`);
        } else {
          console.warn(`Warning: failed to add constraint ${constraint}: ${e.message}`);
        }
      }
    };

    await addConstraintSafe(
      'branch_requisition_items',
      'branch_requisition_items_requisition_id_branch_requisitions_id_fk',
      'ALTER TABLE "branch_requisition_items" ADD CONSTRAINT "branch_requisition_items_requisition_id_branch_requisitions_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "public"."branch_requisitions"("id") ON DELETE no action ON UPDATE no action;'
    );

    await addConstraintSafe(
      'branch_requisition_items',
      'branch_requisition_items_product_id_products_id_fk',
      'ALTER TABLE "branch_requisition_items" ADD CONSTRAINT "branch_requisition_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;'
    );

    await addConstraintSafe(
      'branch_requisitions',
      'branch_requisitions_business_id_businesses_id_fk',
      'ALTER TABLE "branch_requisitions" ADD CONSTRAINT "branch_requisitions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;'
    );

    await addConstraintSafe(
      'branch_requisitions',
      'branch_requisitions_from_branch_id_branches_id_fk',
      'ALTER TABLE "branch_requisitions" ADD CONSTRAINT "branch_requisitions_from_branch_id_branches_id_fk" FOREIGN KEY ("from_branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;'
    );

    await addConstraintSafe(
      'branch_requisitions',
      'branch_requisitions_to_warehouse_id_warehouses_id_fk',
      'ALTER TABLE "branch_requisitions" ADD CONSTRAINT "branch_requisitions_to_warehouse_id_warehouses_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;'
    );

    await addConstraintSafe(
      'branch_requisitions',
      'branch_requisitions_created_by_users_id_fk',
      'ALTER TABLE "branch_requisitions" ADD CONSTRAINT "branch_requisitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;'
    );

    await addConstraintSafe(
      'purchase_order_items',
      'purchase_order_items_po_id_purchase_orders_id_fk',
      'ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_purchase_orders_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;'
    );

    await addConstraintSafe(
      'purchase_order_items',
      'purchase_order_items_product_id_products_id_fk',
      'ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;'
    );

    await addConstraintSafe(
      'purchase_orders',
      'purchase_orders_business_id_businesses_id_fk',
      'ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;'
    );

    await addConstraintSafe(
      'purchase_orders',
      'purchase_orders_provider_id_providers_id_fk',
      'ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;'
    );

    await addConstraintSafe(
      'purchase_orders',
      'purchase_orders_warehouse_id_warehouses_id_fk',
      'ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;'
    );

    await addConstraintSafe(
      'purchase_orders',
      'purchase_orders_branch_id_branches_id_fk',
      'ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;'
    );

    await addConstraintSafe(
      'purchase_orders',
      'purchase_orders_created_by_users_id_fk',
      'ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;'
    );

    // 6. Ensure target_station column on categories & backfill drink categories
    await client.query(`
      ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "target_station" varchar(20) DEFAULT 'cocina';
      UPDATE "categories" 
      SET "target_station" = 'barra' 
      WHERE LOWER("name") SIMILAR TO '%(bebida|drink|café|cafe|té|te|refresco|jugo|smoothie|frappe|agua|licor|trago|barra)%';
    `);
    console.log('Column target_station on categories ensured and backfilled.');


    // 7. Remote print stations and jobs
    await client.query(`
      CREATE TABLE IF NOT EXISTS "print_stations" (
        "station_id" varchar(120) PRIMARY KEY NOT NULL,
        "branch_id" uuid NOT NULL REFERENCES "public"."branches"("id"),
        "device_name" varchar(120) NOT NULL,
        "role" varchar(30) NOT NULL,
        "operator_id" uuid REFERENCES "public"."users"("id"),
        "operator_name" varchar(120),
        "printer_name" varchar(180) NOT NULL,
        "can_print_comandas" boolean DEFAULT true NOT NULL,
        "last_seen_at" timestamp with time zone NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    console.log('Table print_stations ensured.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS "print_jobs" (
        "id" varchar(120) PRIMARY KEY NOT NULL,
        "branch_id" uuid NOT NULL REFERENCES "public"."branches"("id"),
        "target_station_id" varchar(120) NOT NULL,
        "source_user_id" uuid REFERENCES "public"."users"("id"),
        "source_user_name" varchar(120),
        "title" varchar(180) NOT NULL,
        "details" text NOT NULL,
        "target" varchar(50) NOT NULL,
        "status" varchar(20) DEFAULT 'queued' NOT NULL,
        "error" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "printed_at" timestamp with time zone,
        "failed_at" timestamp with time zone
      );
    `);
    console.log('Table print_jobs ensured.');

    await client.query('CREATE INDEX IF NOT EXISTS "print_stations_branch_idx" ON "print_stations" USING btree ("branch_id");');
    await client.query('CREATE INDEX IF NOT EXISTS "print_stations_last_seen_idx" ON "print_stations" USING btree ("last_seen_at");');
    await client.query('CREATE INDEX IF NOT EXISTS "print_jobs_branch_idx" ON "print_jobs" USING btree ("branch_id");');
    await client.query('CREATE INDEX IF NOT EXISTS "print_jobs_station_status_idx" ON "print_jobs" USING btree ("target_station_id","status");');
    await client.query('CREATE INDEX IF NOT EXISTS "print_jobs_created_at_idx" ON "print_jobs" USING btree ("created_at");');
    console.log('Remote print station indexes ensured.');

    // 8. Cash shift close snapshot fields
    await client.query(`
      ALTER TABLE "cash_shifts"
        ADD COLUMN IF NOT EXISTS "denomination_counts" jsonb,
        ADD COLUMN IF NOT EXISTS "close_notes" text,
        ADD COLUMN IF NOT EXISTS "close_snapshot" jsonb;
    `);
    console.log('Cash shift close snapshot columns ensured.');

    // 9. Order idempotency fields for reliable waiter retries
    await client.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "client_uuid" varchar(120);
    `);
    await client.query(`
      ALTER TABLE "order_items"
        ADD COLUMN IF NOT EXISTS "client_uuid" varchar(120);
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "orders_client_uuid_unique_idx"
      ON "orders" ("client_uuid")
      WHERE "client_uuid" IS NOT NULL;
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "order_items_client_uuid_unique_idx"
      ON "order_items" ("client_uuid")
      WHERE "client_uuid" IS NOT NULL;
    `);
    console.log('Order client idempotency columns ensured.');

    // 10. Product inventory model columns
    await client.query(`
      ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "item_type" varchar(20) NOT NULL DEFAULT 'finished_good',
        ADD COLUMN IF NOT EXISTS "production_strategy" varchar(20) NOT NULL DEFAULT 'none',
        ADD COLUMN IF NOT EXISTS "uom" varchar(10) NOT NULL DEFAULT 'piece';
    `);
    await client.query(`
      UPDATE "products" SET "item_type" = 'raw_material'
      WHERE "is_ingredient" = true AND "item_type" = 'finished_good';
    `);
    await client.query(`
      UPDATE "products" SET "uom" = "sale_type"
      WHERE "sale_type" IS NOT NULL AND "sale_type" <> 'pieza' AND "uom" = 'piece';
    `);
    console.log('Product inventory model columns ensured.');

    // 11. Immutable stock ledger
    await client.query(`
      CREATE TABLE IF NOT EXISTS "stock_ledger" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id"),
        "product_id" uuid NOT NULL REFERENCES "public"."products"("id"),
        "branch_id" uuid REFERENCES "public"."branches"("id"),
        "warehouse_id" uuid REFERENCES "public"."warehouses"("id"),
        "quantity_delta" numeric(12, 3) NOT NULL,
        "event_type" varchar(30) NOT NULL,
        "unit_cost" numeric(10, 2),
        "reference_type" varchar(30),
        "reference_id" uuid,
        "document_number" varchar(50),
        "notes" text,
        "lot_number" varchar(100),
        "expiration_date" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "created_by_id" uuid REFERENCES "public"."users"("id")
      );
    `);
    await client.query('CREATE INDEX IF NOT EXISTS "idx_stock_ledger_bus_prod" ON "stock_ledger" USING btree ("business_id","product_id");');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_stock_ledger_branch" ON "stock_ledger" USING btree ("branch_id");');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_stock_ledger_warehouse" ON "stock_ledger" USING btree ("warehouse_id");');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_stock_ledger_created_at" ON "stock_ledger" USING btree ("created_at");');
    console.log('Stock ledger table ensured.');

    // 12. Intelligent inventory control tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS "branch_stock_thresholds" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id"),
        "product_id" uuid NOT NULL REFERENCES "public"."products"("id"),
        "branch_id" uuid NOT NULL REFERENCES "public"."branches"("id"),
        "min_stock" numeric(12, 3) DEFAULT '0.000',
        "max_stock" numeric(12, 3) DEFAULT '0.000',
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_by" uuid REFERENCES "public"."users"("id")
      );
    `);
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "unq_bst_product_branch" ON "branch_stock_thresholds" USING btree ("product_id","branch_id");');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_bst_branch" ON "branch_stock_thresholds" USING btree ("branch_id");');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_bst_business" ON "branch_stock_thresholds" USING btree ("business_id");');

    await client.query(`
      CREATE TABLE IF NOT EXISTS "warehouse_stock_thresholds" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id"),
        "product_id" uuid NOT NULL REFERENCES "public"."products"("id"),
        "warehouse_id" uuid NOT NULL REFERENCES "public"."warehouses"("id"),
        "min_stock" numeric(12, 3) DEFAULT '0.000',
        "max_stock" numeric(12, 3) DEFAULT '0.000',
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_by" uuid REFERENCES "public"."users"("id")
      );
    `);
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "unq_wst_product_warehouse" ON "warehouse_stock_thresholds" USING btree ("product_id","warehouse_id");');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_wst_warehouse" ON "warehouse_stock_thresholds" USING btree ("warehouse_id");');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_wst_business" ON "warehouse_stock_thresholds" USING btree ("business_id");');

    await client.query(`
      CREATE TABLE IF NOT EXISTS "inventory_alerts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id"),
        "product_id" uuid NOT NULL REFERENCES "public"."products"("id"),
        "branch_id" uuid NOT NULL REFERENCES "public"."branches"("id"),
        "alert_type" varchar(20) NOT NULL,
        "threshold" numeric(12, 3) NOT NULL,
        "current_qty" numeric(12, 3) NOT NULL,
        "status" varchar(20) DEFAULT 'active' NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "acknowledged_at" timestamp with time zone,
        "acknowledged_by" uuid REFERENCES "public"."users"("id"),
        "resolved_at" timestamp with time zone
      );
    `);
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "unq_ia_product_branch_active" ON "inventory_alerts" ("product_id","branch_id") WHERE "status" IN (\'active\', \'acknowledged\');');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_ia_business_status" ON "inventory_alerts" USING btree ("business_id","status");');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_ia_branch_status" ON "inventory_alerts" USING btree ("branch_id","status");');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_ia_product" ON "inventory_alerts" USING btree ("product_id");');

    await client.query(`
      CREATE TABLE IF NOT EXISTS "business_inventory_settings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "business_id" uuid NOT NULL UNIQUE REFERENCES "public"."businesses"("id"),
        "auto_requisition_enabled" boolean DEFAULT false NOT NULL,
        "default_warehouse_id" uuid REFERENCES "public"."warehouses"("id"),
        "alert_engine_interval_minutes" integer DEFAULT 15 NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_by" uuid REFERENCES "public"."users"("id")
      );
    `);
    console.log('Intelligent inventory control tables ensured.');

    // 13. Recipe waste percentage column
    await client.query(`
      ALTER TABLE "recipes"
        ADD COLUMN IF NOT EXISTS "waste_percent" numeric(5, 2) NOT NULL DEFAULT '0.00';
    `);
    console.log('Recipe waste percent column ensured.');

    // 14. Warehouse location type (transit support)
    await client.query(`
      ALTER TABLE "warehouses"
        ADD COLUMN IF NOT EXISTS "location_type" varchar(30) NOT NULL DEFAULT 'warehouse';
    `);
    console.log('Warehouse location type column ensured.');

    // 15. Inventory alerts: branch_id nullable for global alerts + global unique index
    await client.query(`
      ALTER TABLE "inventory_alerts" ALTER COLUMN "branch_id" DROP NOT NULL;
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "unq_ia_product_global_active"
      ON "inventory_alerts" ("product_id")
      WHERE "branch_id" IS NULL AND "status" IN ('active', 'acknowledged');
    `);
    console.log('Global inventory alert support ensured.');

    // 16. Per-branch catalog (branch_products)
    await client.query(`
      CREATE TABLE IF NOT EXISTS "branch_products" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "business_id" uuid NOT NULL REFERENCES "public"."businesses"("id"),
        "branch_id" uuid NOT NULL REFERENCES "public"."branches"("id"),
        "product_id" uuid NOT NULL REFERENCES "public"."products"("id"),
        "is_sellable" boolean DEFAULT true NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS "unq_branch_products" ON "branch_products" USING btree ("branch_id","product_id");');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_branch_products_branch" ON "branch_products" USING btree ("branch_id");');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_branch_products_product" ON "branch_products" USING btree ("product_id");');
    console.log('Branch products table ensured.');

    // 17. Production Orders (OP) lifecycle and destination warehouse support
    await client.query(`
      ALTER TABLE "production_runs" 
      ADD COLUMN IF NOT EXISTS "destination_warehouse_id" uuid REFERENCES "warehouses"("id"),
      ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'completed' NOT NULL,
      ADD COLUMN IF NOT EXISTS "actual_quantity_produced" numeric(12, 3),
      ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone;
    `);
    await client.query(`
      ALTER TABLE "production_runs" ALTER COLUMN "assembled_at" DROP NOT NULL;
    `);
    await client.query(`
      UPDATE "production_runs"
      SET "status" = 'completed',
          "actual_quantity_produced" = COALESCE("actual_quantity_produced", "quantity_produced"),
          "destination_warehouse_id" = COALESCE("destination_warehouse_id", "warehouse_id")
      WHERE "status" IS NULL OR "destination_warehouse_id" IS NULL;
    `);
    console.log('Production runs OP lifecycle and routing columns ensured.');

    console.log('✅ Idempotent migrations executed successfully!');
  } catch (error) {
    console.error('❌ Failed to run idempotent migrations:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
