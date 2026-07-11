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
    console.log('Creating table change_log...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "change_log" (
        "id" bigserial PRIMARY KEY NOT NULL,
        "entity" varchar(50) NOT NULL,
        "entity_id" uuid NOT NULL,
        "branch_id" uuid NOT NULL,
        "version_at" timestamp with time zone DEFAULT now() NOT NULL,
        "payload" jsonb NOT NULL
      );
    `);
    console.log('Table change_log ensured.');

    try {
      console.log('Adding branch_id foreign key constraint...');
      await client.query(`
        ALTER TABLE "change_log" 
        ADD CONSTRAINT "change_log_branch_id_branches_id_fk" 
        FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") 
        ON DELETE no action ON UPDATE no action;
      `);
      console.log('Constraint added.');
    } catch (e: any) {
      if (e.code === '42710') { // duplicate_object
        console.log('Constraint already exists, skipping.');
      } else {
        throw e;
      }
    }

    try {
      console.log('Creating index idx_change_log_branch_version...');
      await client.query(`
        CREATE INDEX "idx_change_log_branch_version" 
        ON "change_log" USING btree ("branch_id", "version_at");
      `);
      console.log('Index created.');
    } catch (e: any) {
      if (e.code === '42P07') { // duplicate_table/relation
        console.log('Index already exists, skipping.');
      } else {
        throw e;
      }
    }

    console.log('✅ change_log DDL executed successfully!');
  } catch (error) {
    console.error('❌ Failed to run manual DDL:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
