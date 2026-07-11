import { Pool } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgres://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db';
  console.log('Connecting to database...');
  const pool = new Pool({ connectionString });
  
  try {
    const client = await pool.connect();
    console.log('Connected. Running ALTER TABLE statement...');
    
    // Check if column exists
    const checkRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='roles';
    `);
    
    if (checkRes.rows.length === 0) {
      await client.query(`
        ALTER TABLE "users" ADD COLUMN "roles" jsonb DEFAULT '[]'::jsonb NOT NULL;
      `);
      console.log('✅ Column "roles" successfully added to "users" table!');
    } else {
      console.log('ℹ️ Column "roles" already exists in "users" table.');
    }
    
    client.release();
  } catch (err) {
    console.error('❌ Error executing ALTER TABLE:', err);
  } finally {
    await pool.end();
  }
}

main();
