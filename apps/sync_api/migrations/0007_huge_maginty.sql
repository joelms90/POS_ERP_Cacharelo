ALTER TABLE "branch_tables" ADD COLUMN "x" double precision;--> statement-breakpoint
ALTER TABLE "branch_tables" ADD COLUMN "y" double precision;--> statement-breakpoint
ALTER TABLE "branch_tables" ADD COLUMN "shape" varchar(20) DEFAULT 'square' NOT NULL;