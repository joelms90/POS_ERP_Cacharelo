import { Client } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL || "postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db";
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const resBiz = await client.query(`SELECT id, name, tax_id, created_at FROM businesses WHERE deleted_at IS NULL`);
    console.log('=== BUSINESSES ===');
    console.table(resBiz.rows);

    const resBranch = await client.query(`SELECT id, business_id, name, code, is_main FROM branches WHERE deleted_at IS NULL`);
    console.log('=== BRANCHES ===');
    console.table(resBranch.rows);

  } catch (error) {
    console.error('Failed:', error);
  } finally {
    await client.end();
  }
}

main();
