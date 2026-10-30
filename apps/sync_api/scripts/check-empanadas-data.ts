import { Client } from 'pg';

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db';
  const client = new Client({ connectionString });
  await client.connect();

  const empanadasBizId = 'd3b07384-d113-4a0e-a555-e5b12824bf03';

  try {
    console.log('=== EMPANADAS BUSINESS DATA CHECK ===');

    const branchesRes = await client.query(
      `SELECT id, name FROM branches WHERE business_id = $1`,
      [empanadasBizId]
    );
    console.log('Branches:', branchesRes.rows);

    const warehousesRes = await client.query(
      `SELECT id, name, location_type FROM warehouses WHERE business_id = $1`,
      [empanadasBizId]
    );
    console.log('Warehouses:', warehousesRes.rows);

    const categoriesRes = await client.query(
      `SELECT count(*) FROM categories WHERE business_id = $1`,
      [empanadasBizId]
    );
    console.log('Categories count:', categoriesRes.rows[0].count);

    const productsRes = await client.query(
      `SELECT count(*) FROM products WHERE business_id = $1`,
      [empanadasBizId]
    );
    console.log('Products count:', productsRes.rows[0].count);

    const ordersRes = await client.query(
      `SELECT count(*) FROM orders o JOIN branches b ON o.branch_id = b.id WHERE b.business_id = $1`,
      [empanadasBizId]
    );
    console.log('Orders count:', ordersRes.rows[0].count);

    const posRes = await client.query(
      `SELECT count(*) FROM purchase_orders WHERE business_id = $1`,
      [empanadasBizId]
    );
    console.log('Purchase Orders count:', posRes.rows[0].count);

    const reqsRes = await client.query(
      `SELECT count(*) FROM branch_requisitions WHERE business_id = $1`,
      [empanadasBizId]
    );
    console.log('Branch Requisitions count:', reqsRes.rows[0].count);

    const stockLevelsRes = await client.query(
      `SELECT count(*) FROM stock_levels sl JOIN products p ON sl.product_id = p.id WHERE p.business_id = $1`,
      [empanadasBizId]
    );
    console.log('Stock levels count:', stockLevelsRes.rows[0].count);

    const stockLedgerRes = await client.query(
      `SELECT count(*) FROM stock_ledger WHERE business_id = $1`,
      [empanadasBizId]
    );
    console.log('Stock ledger count:', stockLedgerRes.rows[0].count);

    const transfersRes = await client.query(
      `SELECT count(*) FROM stock_transfers WHERE business_id = $1`,
      [empanadasBizId]
    );
    console.log('Stock transfers count:', transfersRes.rows[0].count);

    const prodRunsRes = await client.query(
      `SELECT count(*) FROM production_runs pr JOIN products p ON pr.product_id = p.id WHERE p.business_id = $1`,
      [empanadasBizId]
    );
    console.log('Production runs count:', prodRunsRes.rows[0].count);

    const recipesRes = await client.query(
      `SELECT count(*) FROM recipes r JOIN products p ON r.parent_product_id = p.id WHERE p.business_id = $1`,
      [empanadasBizId]
    );
    console.log('Recipes count:', recipesRes.rows[0].count);

    const suppliersRes = await client.query(
      `SELECT count(*) FROM providers WHERE business_id = $1`,
      [empanadasBizId]
    );
    console.log('Providers count:', suppliersRes.rows[0].count);

    const usersRes = await client.query(
      `SELECT id, name, role, roles, email, pin FROM users WHERE business_id = $1`,
      [empanadasBizId]
    );
    console.log('Users associated directly with business:', usersRes.rows);

  } catch (error) {
    console.error('Failed:', error);
  } finally {
    await client.end();
  }
}

main();
