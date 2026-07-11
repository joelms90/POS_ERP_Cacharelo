import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { sql } from 'drizzle-orm';

/**
 * Clean Today's Sales Script
 *
 * This script deletes ONLY TODAY'S sales data while preserving:
 * - Users
 * - Businesses & Branches
 * - Products & Categories
 * - All historical (previous days) sales data
 * - All inventory data (receipts, transfers, stock levels)
 *
 * Deletes TODAY ONLY:
 * - Orders created today
 * - Order items from today's orders
 * - Payments from today's orders
 * - Kitchen tickets from today's orders
 * - Cash shifts opened today
 * - Cash transactions from today's shifts
 * - Inventory movements (type='sale') from today
 * - Resets branch tables to 'free' state
 */

async function cleanTodaySales() {
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

  console.log('🗑️  Starting cleanup of TODAY\'S sales data...\n');

  try {
    await db.transaction(async (tx) => {
      // Get today's date range (00:00:00 to 23:59:59 in the server's timezone)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      console.log(`📅 Cleaning data from: ${todayStart.toISOString()} to ${todayEnd.toISOString()}\n`);

      // 1. Get all order IDs from today
      console.log('Finding today\'s orders...');
      const todayOrdersResult = await tx.execute(sql`
        SELECT id FROM ${schema.orders}
        WHERE created_at >= ${todayStart.toISOString()}
          AND created_at <= ${todayEnd.toISOString()}
      `);
      const todayOrderIds = (todayOrdersResult.rows as any[]).map(row => row.id);
      console.log(`Found ${todayOrderIds.length} orders from today`);

      if (todayOrderIds.length > 0) {
        // 2. Delete kitchen tickets from today's orders
        console.log('Deleting today\'s kitchen tickets...');
        await tx.execute(sql`
          DELETE FROM ${schema.kitchenTickets}
          WHERE order_id IN (${sql.join(todayOrderIds.map(id => sql`${id}`), sql`, `)})
        `);

        // 3. Delete payments from today's orders
        console.log('Deleting today\'s payments...');
        await tx.execute(sql`
          DELETE FROM ${schema.payments}
          WHERE order_id IN (${sql.join(todayOrderIds.map(id => sql`${id}`), sql`, `)})
        `);

        // 4. Delete order items from today's orders
        console.log('Deleting today\'s order items...');
        await tx.execute(sql`
          DELETE FROM ${schema.orderItems}
          WHERE order_id IN (${sql.join(todayOrderIds.map(id => sql`${id}`), sql`, `)})
        `);

        // 5. Delete today's orders
        console.log('Deleting today\'s orders...');
        await tx.execute(sql`
          DELETE FROM ${schema.orders}
          WHERE id IN (${sql.join(todayOrderIds.map(id => sql`${id}`), sql`, `)})
        `);
      } else {
        console.log('No orders found from today, skipping order-related cleanup');
      }

      // 6. Get all cash shift IDs opened today
      console.log('\nFinding today\'s cash shifts...');
      const todayShiftsResult = await tx.execute(sql`
        SELECT id FROM ${schema.cashShifts}
        WHERE opened_at >= ${todayStart.toISOString()}
          AND opened_at <= ${todayEnd.toISOString()}
      `);
      const todayShiftIds = (todayShiftsResult.rows as any[]).map(row => row.id);
      console.log(`Found ${todayShiftIds.length} cash shifts from today`);

      if (todayShiftIds.length > 0) {
        // 7. Delete cash transactions from today's shifts
        console.log('Deleting cash transactions from today\'s shifts...');
        await tx.execute(sql`
          DELETE FROM ${schema.cashTransactions}
          WHERE shift_id IN (${sql.join(todayShiftIds.map(id => sql`${id}`), sql`, `)})
        `);

        // 8. Delete today's cash shifts
        console.log('Deleting today\'s cash shifts...');
        await tx.execute(sql`
          DELETE FROM ${schema.cashShifts}
          WHERE id IN (${sql.join(todayShiftIds.map(id => sql`${id}`), sql`, `)})
        `);
      } else {
        console.log('No cash shifts found from today, skipping cash-related cleanup');
      }

      // 9. Delete today's sale-related inventory movements
      console.log('\nDeleting today\'s sale inventory movements...');
      await tx.execute(sql`
        DELETE FROM ${schema.inventoryMovements}
        WHERE created_at >= ${todayStart.toISOString()}
          AND created_at <= ${todayEnd.toISOString()}
          AND type = 'sale'
      `);

      // 10. Delete "Para Llevar" (takeout) tables that have no remaining orders
      console.log('Deleting empty "Para Llevar" (takeout) tables...');
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
      console.log(`Deleted ${deletedTakeoutResult.rows.length} empty takeout tables`);

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

      console.log('\n✅ Today\'s sales data cleanup completed successfully!');
      console.log('\n📊 Summary:');
      console.log(`  ✓ Deleted ${todayOrderIds.length} orders from today`);
      console.log(`  ✓ Deleted ${todayShiftIds.length} cash shifts from today`);
      console.log(`  ✓ Deleted ${deletedTakeoutResult.rows.length} "Para Llevar" (takeout) tables`);
      console.log('  ✓ Reset all remaining branch tables to free state');
      console.log('  ✓ Cleared device sync checkpoints');
      console.log('\n🔒 Preserved data:');
      console.log('  ✓ Users');
      console.log('  ✓ Businesses & Branches');
      console.log('  ✓ Products & Categories');
      console.log('  ✓ Providers & Warehouses');
      console.log('  ✓ Stock levels & inventory receipts');
      console.log('  ✓ Historical sales data (previous days)');
    });
  } catch (error) {
    console.error('❌ Error cleaning today\'s sales:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the cleanup
cleanTodaySales()
  .then(() => {
    console.log('\n🎉 Cleanup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to clean today\'s sales:', error);
    process.exit(1);
  });
