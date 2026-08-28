import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { sql } from 'drizzle-orm';

/**
 * Clean Old Sales History Script
 *
 * This script deletes ALL SALES DATA from the beginning of time up to YESTERDAY.
 * TODAY'S data is preserved.
 *
 * Preserves:
 * - Users
 * - Businesses & Branches
 * - Products & Categories
 * - Providers & Warehouses
 * - Stock levels & inventory receipts/transfers
 * - TODAY'S sales data
 *
 * Deletes (from beginning of time until yesterday):
 * - All old orders
 * - All old order items
 * - All old payments
 * - All old kitchen tickets
 * - All old cash shifts
 * - All old cash transactions
 * - All old sale-related inventory movements
 * - Old "Para Llevar" tables with no remaining orders
 * - Resets remaining tables to 'free' state
 */

async function cleanOldSalesHistory() {
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

  console.log('🗑️  Starting cleanup of OLD sales history (keeping today)...\n');

  try {
    await db.transaction(async (tx) => {
      // Get today's start date (00:00:00 in server's timezone)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      console.log(`📅 Deleting all data BEFORE: ${todayStart.toISOString()}`);
      console.log(`📅 Keeping all data FROM: ${todayStart.toISOString()} onwards\n`);

      // 1. Get all old order IDs (before today)
      console.log('Finding old orders (before today)...');
      const oldOrdersResult = await tx.execute(sql`
        SELECT id FROM ${schema.orders}
        WHERE created_at < ${todayStart.toISOString()}
      `);
      const oldOrderIds = (oldOrdersResult.rows as any[]).map(row => row.id);
      console.log(`Found ${oldOrderIds.length} old orders to delete`);

      if (oldOrderIds.length > 0) {
        // 2. Delete kitchen tickets from old orders
        console.log('Deleting old kitchen tickets...');
        await tx.execute(sql`
          DELETE FROM ${schema.kitchenTickets}
          WHERE order_id IN (${sql.join(oldOrderIds.map(id => sql`${id}`), sql`, `)})
        `);

        // 3. Delete payments from old orders
        console.log('Deleting old payments...');
        await tx.execute(sql`
          DELETE FROM ${schema.payments}
          WHERE order_id IN (${sql.join(oldOrderIds.map(id => sql`${id}`), sql`, `)})
        `);

        // 4. Delete order items from old orders
        console.log('Deleting old order items...');
        await tx.execute(sql`
          DELETE FROM ${schema.orderItems}
          WHERE order_id IN (${sql.join(oldOrderIds.map(id => sql`${id}`), sql`, `)})
        `);

        // 5. Delete old orders
        console.log('Deleting old orders...');
        await tx.execute(sql`
          DELETE FROM ${schema.orders}
          WHERE id IN (${sql.join(oldOrderIds.map(id => sql`${id}`), sql`, `)})
        `);
      } else {
        console.log('No old orders found, skipping order-related cleanup');
      }

      // 6. Get all old cash shift IDs (opened before today)
      console.log('\nFinding old cash shifts (opened before today)...');
      const oldShiftsResult = await tx.execute(sql`
        SELECT id FROM ${schema.cashShifts}
        WHERE opened_at < ${todayStart.toISOString()}
      `);
      const oldShiftIds = (oldShiftsResult.rows as any[]).map(row => row.id);
      console.log(`Found ${oldShiftIds.length} old cash shifts to delete`);

      if (oldShiftIds.length > 0) {
        // 7. Delete cash transactions from old shifts
        console.log('Deleting old cash transactions...');
        await tx.execute(sql`
          DELETE FROM ${schema.cashTransactions}
          WHERE shift_id IN (${sql.join(oldShiftIds.map(id => sql`${id}`), sql`, `)})
        `);

        // 8. Delete old cash shifts
        console.log('Deleting old cash shifts...');
        await tx.execute(sql`
          DELETE FROM ${schema.cashShifts}
          WHERE id IN (${sql.join(oldShiftIds.map(id => sql`${id}`), sql`, `)})
        `);
      } else {
        console.log('No old cash shifts found, skipping cash-related cleanup');
      }

      // 9. Delete old sale-related inventory movements
      console.log('\nDeleting old sale inventory movements (before today)...');
      await tx.execute(sql`
        DELETE FROM ${schema.inventoryMovements}
        WHERE created_at < ${todayStart.toISOString()}
          AND type = 'sale'
      `);
      await tx.execute(sql`
        DELETE FROM ${schema.stockLedger}
        WHERE created_at < ${todayStart.toISOString()}
          AND event_type = 'sale'
      `);

      // 10. Delete old "Para Llevar" tables that have no remaining orders
      console.log('Deleting old empty "Para Llevar" (takeout) tables...');
      const deletedTakeoutResult = await tx.execute(sql`
        DELETE FROM ${schema.branchTables}
        WHERE (room = 'Para Llevar' OR label LIKE 'PL-%')
          AND id NOT IN (
            SELECT DISTINCT table_id
            FROM ${schema.orders}
            WHERE table_id IS NOT NULL
          )
        RETURNING id
      `);
      console.log(`Deleted ${deletedTakeoutResult.rows.length} old empty takeout tables`);

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

      console.log('\n✅ Old sales history cleanup completed successfully!');
      console.log('\n📊 Summary:');
      console.log(`  ✓ Deleted ${oldOrderIds.length} old orders (before today)`);
      console.log(`  ✓ Deleted ${oldShiftIds.length} old cash shifts (before today)`);
      console.log(`  ✓ Deleted ${deletedTakeoutResult.rows.length} old empty "Para Llevar" tables`);
      console.log('  ✓ Deleted all old payments, order items, kitchen tickets');
      console.log('  ✓ Deleted old sale inventory movements');
      console.log('  ✓ Reset all remaining branch tables to free state');
      console.log('  ✓ Cleared device sync checkpoints');
      console.log('\n🔒 Preserved data:');
      console.log('  ✓ Users');
      console.log('  ✓ Businesses & Branches');
      console.log('  ✓ Products & Categories');
      console.log('  ✓ Providers & Warehouses');
      console.log('  ✓ Stock levels & inventory receipts');
      console.log('  ✓ Inventory transfers & production runs');
      console.log(`  ✓ TODAY'S sales data (from ${todayStart.toISOString()} onwards)`);
    });
  } catch (error) {
    console.error('❌ Error cleaning old sales history:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the cleanup
cleanOldSalesHistory()
  .then(() => {
    console.log('\n🎉 Cleanup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to clean old sales history:', error);
    process.exit(1);
  });
