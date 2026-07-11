CREATE TABLE "change_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"entity" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"version_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_change_log_branch_version" ON "change_log" USING btree ("branch_id","version_at");