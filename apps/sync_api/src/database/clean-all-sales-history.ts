import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { sql } from 'drizzle-orm';

/**
 * Clean ALL Sales History Script
 *
 * This script deletes ALL SALES DATA FROM ALL TIME while preserving:
 * - Users
 * - Businesses & Branches
 * - Products & Categories
 * - Providers & Warehouses
 * - Stock levels & inventory receipts
 * - All inventory data (receipts, transfers, stock levels)
 *
 * Deletes EVERYTHING:
 * - ALL orders (from all time)
 * - ALL order items
 * - ALL payments
 * - ALL kitchen tickets
 * - ALL cash shifts
 * - ALL cash transactions
 * - ALL sale-related inventory movements
 * - ALL "Para Llevar" tables
 * - Resets branch tables to 'free' state
 */

async function cleanAllSalesHistory() {
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

  console.log('🗑️  Starting cleanup of ALL SALES HISTORY...\n');
  console.log('⚠️  WARNING: This will delete ALL orders from ALL TIME!\n');

  try {
    await db.transaction(async (tx) => {
      // 1. Count orders before deletion
      const orderCountResult = await tx.execute(sql`
        SELECT COUNT(*) as count FROM ${schema.orders}
      `);
      const totalOrders = (orderCountResult.rows[0] as any).count;
      console.log(`Found ${totalOrders} orders in database (all time)\n`);

      // 2. Delete all kitchen tickets
      console.log('Deleting all kitchen tickets...');
      await tx.execute(sql`DELETE FROM ${schema.kitchenTickets}`);

      // 3. Delete all payments
      console.log('Deleting all payments...');
      await tx.execute(sql`DELETE FROM ${schema.payments}`);

      // 4. Delete all order items
      console.log('Deleting all order items...');
      await tx.execute(sql`DELETE FROM ${schema.orderItems}`);

      // 5. Delete all orders
      console.log('Deleting all orders...');
      await tx.execute(sql`DELETE FROM ${schema.orders}`);

      // 6. Count cash shifts before deletion
      const shiftCountResult = await tx.execute(sql`
        SELECT COUNT(*) as count FROM ${schema.cashShifts}
      `);
      const totalShifts = (shiftCountResult.rows[0] as any).count;
      console.log(`\nFound ${totalShifts} cash shifts in database (all time)`);

      // 7. Delete all cash transactions
      console.log('Deleting all cash transactions...');
      await tx.execute(sql`DELETE FROM ${schema.cashTransactions}`);

      // 8. Delete all cash shifts
      console.log('Deleting all cash shifts...');
      await tx.execute(sql`DELETE FROM ${schema.cashShifts}`);

      // 9. Delete all sale-related inventory movements
      console.log('\nDeleting all sale inventory movements...');
      await tx.execute(sql`
        DELETE FROM ${schema.inventoryMovements}
        WHERE type = 'sale'
      `);
      await tx.execute(sql`
        DELETE FROM ${schema.stockLedger}
        WHERE event_type = 'sale'
      `);

      // 10. Delete ALL "Para Llevar" (takeout) tables (no orders left to reference them)
      console.log('Deleting all "Para Llevar" (takeout) tables...');
      const deletedTakeoutResult = await tx.execute(sql`
        DELETE FROM ${schema.branchTables}
        WHERE room = 'Para Llevar' OR label LIKE 'PL-%'
        RETURNING id
      `);
      console.log(`Deleted ${deletedTakeoutResult.rows.length} takeout tables`);

      // 11. Reset all remaining branch tables to 'free' state
      console.log('Resetting all remaining branch tables to free state...');
      await tx.execute(sql`
        UPDATE ${schema.branchTables}
        SET state = 'free',
            updated_at = NOW()
      `);

      // 12. Delete device sync checkpoints to force full re-sync
      console.log('Clearing device sync checkpoints...');
      await tx.execute(sql`DELETE FROM ${schema.deviceSyncCheckpoints}`);

      console.log('\n✅ ALL SALES HISTORY cleanup completed successfully!');
      console.log('\n📊 Summary:');
      console.log(`  ✓ Deleted ${totalOrders} orders (all time)`);
      console.log(`  ✓ Deleted ${totalShifts} cash shifts (all time)`);
      console.log(`  ✓ Deleted ${deletedTakeoutResult.rows.length} "Para Llevar" (takeout) tables`);
      console.log('  ✓ Deleted all payments, order items, kitchen tickets');
      console.log('  ✓ Deleted all sale inventory movements');
      console.log('  ✓ Reset all remaining branch tables to free state');
      console.log('  ✓ Cleared device sync checkpoints');
      console.log('\n🔒 Preserved data:');
      console.log('  ✓ Users');
      console.log('  ✓ Businesses & Branches');
      console.log('  ✓ Products & Categories');
      console.log('  ✓ Providers & Warehouses');
      console.log('  ✓ Stock levels & inventory receipts');
      console.log('  ✓ Inventory transfers & production runs');
    });
  } catch (error) {
    console.error('❌ Error cleaning all sales history:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the cleanup
cleanAllSalesHistory()
  .then(() => {
    console.log('\n🎉 Cleanup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to clean all sales history:', error);
    process.exit(1);
  });
