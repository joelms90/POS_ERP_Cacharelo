import { Client } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL || "postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db";
  console.log('Connecting to database...');
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('=== PRODUCTS WITH MISSING/INACTIVE CATEGORIES ===');
    const res = await client.query(`
      SELECT p.id, p.name, p.is_sellable, p.is_ingredient, p.is_active, p.category_id,
             c.name as category_name, c.deleted_at as category_deleted
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE c.id IS NULL OR c.deleted_at IS NOT NULL
      LIMIT 100;
    `);
    console.table(res.rows);
  } catch (error) {
    console.error('Failed to query products:', error);
  } finally {
    await client.end();
  }
}

main();
