import { Client } from 'pg';
import { randomUUID } from 'crypto';

async function main() {
  const connectionString = process.env.DATABASE_URL || "postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db";
  console.log('Connecting to database...');
  const client = new Client({ connectionString });
  await client.connect();

  const SOURCE_BRANCH_ID = '71d48fab-0174-488e-942a-5de0c1f88ae7';

  try {
    // 1. Find Jaltiplan branch
    const jaltiplanBranch = await client.query(
      `SELECT b.id, b.name, b.business_id 
       FROM branches b 
       JOIN businesses biz ON b.business_id = biz.id 
       WHERE biz.name = 'Cafeteria Jaltiplan' AND b.deleted_at IS NULL`
    );

    if (jaltiplanBranch.rows.length === 0) {
      throw new Error("Target branch for 'Cafeteria Jaltiplan' not found!");
    }

    const TARGET_BRANCH_ID = jaltiplanBranch.rows[0].id;
    console.log(`Target Branch: ${jaltiplanBranch.rows[0].name} (${TARGET_BRANCH_ID})`);

    // 2. Fetch room_configs from source branch
    const srcBranch = await client.query(`SELECT room_configs FROM branches WHERE id = $1`, [SOURCE_BRANCH_ID]);
    if (srcBranch.rows.length > 0 && srcBranch.rows[0].room_configs) {
      await client.query(`UPDATE branches SET room_configs = $1 WHERE id = $2`, [srcBranch.rows[0].room_configs, TARGET_BRANCH_ID]);
      console.log('✅ Updated room_configs on Jaltiplan branch!');
    }

    // 3. Fetch source branch tables
    const srcTables = await client.query(
      `SELECT * FROM branch_tables WHERE branch_id = $1 AND deleted_at IS NULL`,
      [SOURCE_BRANCH_ID]
    );

    console.log(`Found ${srcTables.rows.length} tables to copy from branch ${SOURCE_BRANCH_ID}...`);

    let copiedCount = 0;
    for (const tbl of srcTables.rows) {
      // Check if table label already exists in target branch
      const existingTbl = await client.query(
        `SELECT id FROM branch_tables WHERE branch_id = $1 AND label = $2 AND deleted_at IS NULL`,
        [TARGET_BRANCH_ID, tbl.label]
      );

      if (existingTbl.rows.length === 0) {
        const newTableId = randomUUID();
        await client.query(
          `INSERT INTO branch_tables (
            id, branch_id, label, capacity, room, state, x, y, shape, created_at, updated_at, version
          ) VALUES (
            $1, $2, $3, $4, $5, 'free', $6, $7, $8, NOW(), NOW(), 1
          )`,
          [newTableId, TARGET_BRANCH_ID, tbl.label, tbl.capacity, tbl.room, tbl.x, tbl.y, tbl.shape]
        );
        copiedCount++;
      }
    }

    console.log('\n=========================================');
    console.log(`🎉 SUCCESS: Copied ${copiedCount} tables & room layout to Cafeteria Jaltiplan!`);
    console.log(`Target Branch ID: ${TARGET_BRANCH_ID}`);
    console.log('=========================================\n');

  } catch (error) {
    console.error('❌ Failed to copy branch tables:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
