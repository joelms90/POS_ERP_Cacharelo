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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_stations_branch_idx" ON "print_stations" USING btree ("branch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_stations_last_seen_idx" ON "print_stations" USING btree ("last_seen_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_jobs_branch_idx" ON "print_jobs" USING btree ("branch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_jobs_station_status_idx" ON "print_jobs" USING btree ("target_station_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_jobs_created_at_idx" ON "print_jobs" USING btree ("created_at");
