import { Client } from 'pg';

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db';
  const client = new Client({ connectionString });
  await client.connect();

  const EMPANADAS_BIZ_ID = 'd3b07384-d113-4a0e-a555-e5b12824bf03';

  try {
    // 1. Double check business exists and is indeed Empanadas
    const bizCheck = await client.query(
      `SELECT id, name FROM businesses WHERE id = $1`,
      [EMPANADAS_BIZ_ID]
    );

    if (bizCheck.rows.length === 0 || bizCheck.rows[0].name !== 'Empanadas') {
      throw new Error(
        `Safety check failed! Expected business 'Empanadas' (${EMPANADAS_BIZ_ID}), but found: ${JSON.stringify(
          bizCheck.rows
        )}`
      );
    }

    console.log(`Verified target business: ${bizCheck.rows[0].name} (${bizCheck.rows[0].id})`);

    await client.query('BEGIN');

    // 2. Get branches for Empanadas
    const branchRes = await client.query(
      `SELECT id, name FROM branches WHERE business_id = $1`,
      [EMPANADAS_BIZ_ID]
    );
    const branchIds = branchRes.rows.map((r) => r.id);
    console.log(`Found ${branchIds.length} branches:`, branchRes.rows.map((r) => `${r.name} (${r.id})`));

    // 3. Get products for Empanadas
    const prodRes = await client.query(
      `SELECT id, name FROM products WHERE business_id = $1`,
      [EMPANADAS_BIZ_ID]
    );
    const productIds = prodRes.rows.map((r) => r.id);
    console.log(`Found ${productIds.length} products to remove.`);

    // 4. POS / Orders deletion
    if (branchIds.length > 0) {
      // Find orders
      const ordersRes = await client.query(
        `SELECT id FROM orders WHERE branch_id = ANY($1::uuid[])`,
        [branchIds]
      );
      const orderIds = ordersRes.rows.map((r) => r.id);
      console.log(`Found ${orderIds.length} orders to wipe.`);

      if (orderIds.length > 0) {
        const ktDel = await client.query(
          `DELETE FROM kitchen_tickets WHERE order_id = ANY($1::uuid[])`,
          [orderIds]
        );
        console.log(`Deleted ${ktDel.rowCount} kitchen_tickets`);

        const payDel = await client.query(
          `DELETE FROM payments WHERE order_id = ANY($1::uuid[])`,
          [orderIds]
        );
        console.log(`Deleted ${payDel.rowCount} payments`);

        const oiDel = await client.query(
          `DELETE FROM order_items WHERE order_id = ANY($1::uuid[])`,
          [orderIds]
        );
        console.log(`Deleted ${oiDel.rowCount} order_items`);

        const ordDel = await client.query(
          `DELETE FROM orders WHERE id = ANY($1::uuid[])`,
          [orderIds]
        );
        console.log(`Deleted ${ordDel.rowCount} orders`);
      }

      // Cash shifts & transactions
      const ctDel = await client.query(
        `DELETE FROM cash_transactions WHERE shift_id IN (SELECT id FROM cash_shifts WHERE branch_id = ANY($1::uuid[]))`,
        [branchIds]
      );
      console.log(`Deleted ${ctDel.rowCount} cash_transactions`);

      const csDel = await client.query(
        `DELETE FROM cash_shifts WHERE branch_id = ANY($1::uuid[])`,
        [branchIds]
      );
      console.log(`Deleted ${csDel.rowCount} cash_shifts`);

      // Print jobs
      const pjDel = await client.query(
        `DELETE FROM print_jobs WHERE branch_id = ANY($1::uuid[])`,
        [branchIds]
      );
      console.log(`Deleted ${pjDel.rowCount} print_jobs`);

      // Change log
      const clDel = await client.query(
        `DELETE FROM change_log WHERE branch_id = ANY($1::uuid[])`,
        [branchIds]
      );
      console.log(`Deleted ${clDel.rowCount} change_log records`);

      // Reset tables state
      const btReset = await client.query(
        `UPDATE branch_tables SET state = 'free' WHERE branch_id = ANY($1::uuid[])`,
        [branchIds]
      );
      console.log(`Reset ${btReset.rowCount} branch_tables to 'free'`);
    }

    // 5. Purchase Orders
    const poiDel = await client.query(
      `DELETE FROM purchase_order_items WHERE po_id IN (SELECT id FROM purchase_orders WHERE business_id = $1)`,
      [EMPANADAS_BIZ_ID]
    );
    console.log(`Deleted ${poiDel.rowCount} purchase_order_items`);

    const poDel = await client.query(
      `DELETE FROM purchase_orders WHERE business_id = $1`,
      [EMPANADAS_BIZ_ID]
    );
    console.log(`Deleted ${poDel.rowCount} purchase_orders`);

    // 6. Branch Requisitions
    const briDel = await client.query(
      `DELETE FROM branch_requisition_items WHERE requisition_id IN (SELECT id FROM branch_requisitions WHERE business_id = $1)`,
      [EMPANADAS_BIZ_ID]
    );
    console.log(`Deleted ${briDel.rowCount} branch_requisition_items`);

    const brDel = await client.query(
      `DELETE FROM branch_requisitions WHERE business_id = $1`,
      [EMPANADAS_BIZ_ID]
    );
    console.log(`Deleted ${brDel.rowCount} branch_requisitions`);

    // 7. Stock Transfers
    const stiDel = await client.query(
      `DELETE FROM stock_transfer_items WHERE transfer_id IN (SELECT id FROM stock_transfers WHERE business_id = $1)`,
      [EMPANADAS_BIZ_ID]
    );
    console.log(`Deleted ${stiDel.rowCount} stock_transfer_items`);

    const stDel = await client.query(
      `DELETE FROM stock_transfers WHERE business_id = $1`,
      [EMPANADAS_BIZ_ID]
    );
    console.log(`Deleted ${stDel.rowCount} stock_transfers`);

    // 8. Inventory Receipts & Movements & Ledger
    const iriDel = await client.query(
      `DELETE FROM inventory_receipt_items WHERE receipt_id IN (SELECT id FROM inventory_receipts WHERE business_id = $1)`,
      [EMPANADAS_BIZ_ID]
    );
    console.log(`Deleted ${iriDel.rowCount} inventory_receipt_items`);

    const irDel = await client.query(
      `DELETE FROM inventory_receipts WHERE business_id = $1`,
      [EMPANADAS_BIZ_ID]
    );
    console.log(`Deleted ${irDel.rowCount} inventory_receipts`);

    const imDel = await client.query(
      `DELETE FROM inventory_movements WHERE business_id = $1`,
      [EMPANADAS_BIZ_ID]
    );
    console.log(`Deleted ${imDel.rowCount} inventory_movements`);

    const slgDel = await client.query(
      `DELETE FROM stock_ledger WHERE business_id = $1`,
      [EMPANADAS_BIZ_ID]
    );
    console.log(`Deleted ${slgDel.rowCount} stock_ledger rows`);

    // 9. Alerts, thresholds & catalog links
    const iaDel = await client.query(
      `DELETE FROM inventory_alerts WHERE business_id = $1`,
      [EMPANADAS_BIZ_ID]
    );
    console.log(`Deleted ${iaDel.rowCount} inventory_alerts`);

    const wstDel = await client.query(
      `DELETE FROM warehouse_stock_thresholds WHERE business_id = $1`,
      [EMPANADAS_BIZ_ID]
    );
    console.log(`Deleted ${wstDel.rowCount} warehouse_stock_thresholds`);

    const bstDel = await client.query(
      `DELETE FROM branch_stock_thresholds WHERE business_id = $1`,
      [EMPANADAS_BIZ_ID]
    );
    console.log(`Deleted ${bstDel.rowCount} branch_stock_thresholds`);

    const spDel = await client.query(
      `DELETE FROM supplier_products WHERE business_id = $1`,
      [EMPANADAS_BIZ_ID]
    );
    console.log(`Deleted ${spDel.rowCount} supplier_products`);

    const bpDel = await client.query(
      `DELETE FROM branch_products WHERE business_id = $1`,
      [EMPANADAS_BIZ_ID]
    );
    console.log(`Deleted ${bpDel.rowCount} branch_products`);

    const biDel = await client.query(
      `DELETE FROM bulk_imports WHERE business_id = $1`,
      [EMPANADAS_BIZ_ID]
    );
    console.log(`Deleted ${biDel.rowCount} bulk_imports`);

    // 10. Product dependents (Stock levels, recipes, production runs)
    if (productIds.length > 0) {
      const slDel = await client.query(
        `DELETE FROM stock_levels WHERE product_id = ANY($1::uuid[])`,
        [productIds]
      );
      console.log(`Deleted ${slDel.rowCount} stock_levels`);

      const rcDel = await client.query(
        `DELETE FROM recipes WHERE parent_product_id = ANY($1::uuid[]) OR ingredient_product_id = ANY($1::uuid[])`,
        [productIds]
      );
      console.log(`Deleted ${rcDel.rowCount} recipes`);

      const prDel = await client.query(
        `DELETE FROM production_runs WHERE product_id = ANY($1::uuid[])`,
        [productIds]
      );
      console.log(`Deleted ${prDel.rowCount} production_runs`);

      // 11. Products
      const pDel = await client.query(
        `DELETE FROM products WHERE business_id = $1`,
        [EMPANADAS_BIZ_ID]
      );
      console.log(`Deleted ${pDel.rowCount} products`);
    }

    // 12. Categories
    const cDel = await client.query(
      `DELETE FROM categories WHERE business_id = $1`,
      [EMPANADAS_BIZ_ID]
    );
    console.log(`Deleted ${cDel.rowCount} categories`);

    await client.query('COMMIT');
    console.log('✅ Successfully wiped Empanadas test data in atomic transaction.');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Wipe failed, transaction rolled back:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
