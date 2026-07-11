CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"branch_id" uuid,
	"warehouse_id" uuid,
	"quantity" numeric(12, 3) NOT NULL,
	"type" varchar(30) NOT NULL,
	"reference_id" uuid,
	"document_number" varchar(50),
	"notes" text,
	"lot_number" varchar(100),
	"expiration_date" timestamp with time zone,
	"drawer_location" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid
);
--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_inv_mov_bus_prod" ON "inventory_movements" USING btree ("business_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_inv_mov_branch" ON "inventory_movements" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_inv_mov_warehouse" ON "inventory_movements" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_inv_mov_created_at" ON "inventory_movements" USING btree ("created_at");