import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { sql } from 'drizzle-orm';

/**
 * Reset Database Script
 *
 * This script deletes ALL transactional data while preserving:
 * - Users (from seed)
 * - Businesses
 * - Branches
 * - Admin business access
 *
 * Deletes:
 * - All products & categories
 * - All orders, payments, order items
 * - All inventory movements, receipts, transfers
 * - All stock levels
 * - All production runs
 * - All bulk imports
 * - All kitchen tickets
 * - All cash shifts and transactions
 * - All providers
 * - All warehouses
 * - All recipes
 * - Branch tables states (resets to 'free')
 */

async function resetTransactionalData() {
  // Support both DATABASE_URL (production) and individual env vars (local)
  const connectionConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'pos_user',
        password: process.env.DB_PASSWORD || 'pos_password',
        database: process.env.DB_NAME || 'pos_dev',
      };

  const pool = new Pool(connectionConfig);
  const db = drizzle(pool, { schema });

  console.log('🗑️  Starting database reset...\n');

  try {
    await db.transaction(async (tx) => {
      // 1. Delete all bulk imports
      console.log('Deleting bulk imports...');
      await tx.execute(sql`DELETE FROM ${schema.bulkImports}`);

      // 2. Delete all kitchen tickets
      console.log('Deleting kitchen tickets...');
      await tx.execute(sql`DELETE FROM ${schema.kitchenTickets}`);

      // 3. Delete all cash transactions
      console.log('Deleting cash transactions...');
      await tx.execute(sql`DELETE FROM ${schema.cashTransactions}`);

      // 4. Delete all cash shifts
      console.log('Deleting cash shifts...');
      await tx.execute(sql`DELETE FROM ${schema.cashShifts}`);

      // 5. Delete all payments
      console.log('Deleting payments...');
      await tx.execute(sql`DELETE FROM ${schema.payments}`);

      // 6. Delete all order items
      console.log('Deleting order items...');
      await tx.execute(sql`DELETE FROM ${schema.orderItems}`);

      // 7. Delete all orders
      console.log('Deleting orders...');
      await tx.execute(sql`DELETE FROM ${schema.orders}`);

      // 8. Delete all inventory movements
      console.log('Deleting inventory movements...');
      await tx.execute(sql`DELETE FROM ${schema.inventoryMovements}`);

      // 8b. Delete all stock ledger entries
      console.log('Deleting stock ledger entries...');
      await tx.execute(sql`DELETE FROM ${schema.stockLedger}`);

      // 9. Delete all stock transfer items
      console.log('Deleting stock transfer items...');
      await tx.execute(sql`DELETE FROM ${schema.stockTransferItems}`);

      // 10. Delete all stock transfers
      console.log('Deleting stock transfers...');
      await tx.execute(sql`DELETE FROM ${schema.stockTransfers}`);

      // 11. Delete all production runs
      console.log('Deleting production runs...');
      await tx.execute(sql`DELETE FROM ${schema.productionRuns}`);

      // 12. Delete all inventory receipt items
      console.log('Deleting inventory receipt items...');
      await tx.execute(sql`DELETE FROM ${schema.inventoryReceiptItems}`);

      // 13. Delete all inventory receipts
      console.log('Deleting inventory receipts...');
      await tx.execute(sql`DELETE FROM ${schema.inventoryReceipts}`);

      // 14. Delete all stock levels
      console.log('Deleting stock levels...');
      await tx.execute(sql`DELETE FROM ${schema.stockLevels}`);

      // 15. Delete all recipes
      console.log('Deleting recipes...');
      await tx.execute(sql`DELETE FROM ${schema.recipes}`);

      // 16. Delete all supplier products
      console.log('Deleting supplier products...');
      await tx.execute(sql`DELETE FROM ${schema.supplierProducts}`);

      // 17. Delete all products
      console.log('Deleting products...');
      await tx.execute(sql`DELETE FROM ${schema.products}`);

      // 18. Delete all warehouses
      console.log('Deleting warehouses...');
      await tx.execute(sql`DELETE FROM ${schema.warehouses}`);

      // 19. Delete all providers
      console.log('Deleting providers...');
      await tx.execute(sql`DELETE FROM ${schema.providers}`);

      // 20. Delete all categories
      console.log('Deleting categories...');
      await tx.execute(sql`DELETE FROM ${schema.categories}`);

      // 21. Reset branch tables to 'free' state
      console.log('Resetting branch tables to free state...');
      await tx.execute(sql`
        UPDATE ${schema.branchTables}
        SET state = 'free'
      `);

      // 22. Delete device sync checkpoints
      console.log('Deleting device sync checkpoints...');
      await tx.execute(sql`DELETE FROM ${schema.deviceSyncCheckpoints}`);

      console.log('\n✅ Database reset completed successfully!');
      console.log('\nPreserved data:');
      console.log('  ✓ Users');
      console.log('  ✓ Businesses');
      console.log('  ✓ Branches');
      console.log('  ✓ Branch tables (reset to free)');
      console.log('  ✓ Devices');
      console.log('  ✓ Admin business access');
      console.log('\nDeleted data:');
      console.log('  ✗ All products & categories');
      console.log('  ✗ All orders & payments');
      console.log('  ✗ All inventory data (receipts, transfers, movements)');
      console.log('  ✗ All production runs');
      console.log('  ✗ All providers & warehouses');
      console.log('  ✗ All bulk imports');
    });
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the reset
resetTransactionalData()
  .then(() => {
    console.log('\n🎉 Reset complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to reset database:', error);
    process.exit(1);
  });
