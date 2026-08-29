import { Pool } from 'pg';

async function main() {
  const connectionString =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/pos_dev';
  console.log('Connecting to database...');
  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();
    console.log('Connected. Running ALTER TABLE statements for production_runs...');

    // 1. destination_warehouse_id
    const destWhRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='production_runs' AND column_name='destination_warehouse_id';
    `);
    if (destWhRes.rows.length === 0) {
      await client.query(`
        ALTER TABLE "production_runs" 
        ADD COLUMN "destination_warehouse_id" uuid REFERENCES "warehouses"("id");
      `);
      console.log('✅ Added destination_warehouse_id to production_runs');
    } else {
      console.log('ℹ️ destination_warehouse_id already exists');
    }

    // 2. status
    const statusRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='production_runs' AND column_name='status';
    `);
    if (statusRes.rows.length === 0) {
      await client.query(`
        ALTER TABLE "production_runs" 
        ADD COLUMN "status" varchar(20) DEFAULT 'completed' NOT NULL;
      `);
      console.log('✅ Added status to production_runs');
    } else {
      console.log('ℹ️ status already exists');
    }

    // 3. actual_quantity_produced
    const actualQtyRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='production_runs' AND column_name='actual_quantity_produced';
    `);
    if (actualQtyRes.rows.length === 0) {
      await client.query(`
        ALTER TABLE "production_runs" 
        ADD COLUMN "actual_quantity_produced" numeric(12, 3);
      `);
      console.log('✅ Added actual_quantity_produced to production_runs');
    } else {
      console.log('ℹ️ actual_quantity_produced already exists');
    }

    // 4. started_at
    const startedAtRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='production_runs' AND column_name='started_at';
    `);
    if (startedAtRes.rows.length === 0) {
      await client.query(`
        ALTER TABLE "production_runs" 
        ADD COLUMN "started_at" timestamp with time zone;
      `);
      console.log('✅ Added started_at to production_runs');
    } else {
      console.log('ℹ️ started_at already exists');
    }

    // 5. Make assembled_at nullable for pending/in_progress OPs
    await client.query(`
      ALTER TABLE "production_runs" ALTER COLUMN "assembled_at" DROP NOT NULL;
    `);
    console.log('✅ Altered assembled_at to be nullable');

    // 6. Backfill existing rows
    const backfillRes = await client.query(`
      UPDATE "production_runs"
      SET "status" = 'completed',
          "actual_quantity_produced" = COALESCE("actual_quantity_produced", "quantity_produced"),
          "destination_warehouse_id" = COALESCE("destination_warehouse_id", "warehouse_id")
      WHERE "status" IS NULL OR "destination_warehouse_id" IS NULL;
    `);
    console.log(`✅ Backfilled OP status and destination warehouse for ${backfillRes.rowCount} existing production runs.`);

    client.release();
  } catch (err) {
    console.error('❌ Error executing migration:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
