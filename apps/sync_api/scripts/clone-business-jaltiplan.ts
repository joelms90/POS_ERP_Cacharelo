import { Client } from 'pg';
import { randomUUID } from 'crypto';

async function main() {
  const connectionString = process.env.DATABASE_URL || "postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db";
  console.log('Connecting to database...');
  const client = new Client({ connectionString });
  await client.connect();

  const SOURCE_BUSINESS_ID = 'd3b07384-d113-4a0e-a555-e5b12824bf01'; // Cafetería Cacharelo

  try {
    await client.query('BEGIN');

    // 1. Verify Source Business
    const srcBiz = await client.query(`SELECT * FROM businesses WHERE id = $1`, [SOURCE_BUSINESS_ID]);
    if (srcBiz.rows.length === 0) {
      throw new Error(`Source business ${SOURCE_BUSINESS_ID} not found`);
    }
    console.log(`Source Business: ${srcBiz.rows[0].name} (${SOURCE_BUSINESS_ID})`);

    // Check if Cafeteria Jaltiplan already exists
    const existingJaltiplan = await client.query(`SELECT * FROM businesses WHERE name = 'Cafeteria Jaltiplan' AND deleted_at IS NULL`);
    let newBusinessId: string;

    if (existingJaltiplan.rows.length > 0) {
      newBusinessId = existingJaltiplan.rows[0].id;
      console.log(`Business 'Cafeteria Jaltiplan' already exists with ID: ${newBusinessId}`);
    } else {
      newBusinessId = randomUUID();
      await client.query(
        `INSERT INTO businesses (id, name, tax_id, is_active, created_at, updated_at, version)
         VALUES ($1, $2, $3, true, NOW(), NOW(), 1)`,
        [newBusinessId, 'Cafeteria Jaltiplan', 'MX123456789']
      );
      console.log(`✅ Created Business 'Cafeteria Jaltiplan' with ID: ${newBusinessId}`);
    }

    // 2. Create Branch for Jaltiplan
    const existingBranch = await client.query(`SELECT * FROM branches WHERE business_id = $1 AND deleted_at IS NULL`, [newBusinessId]);
    let newBranchId: string;

    if (existingBranch.rows.length > 0) {
      newBranchId = existingBranch.rows[0].id;
      console.log(`Branch already exists for Jaltiplan with ID: ${newBranchId}`);
    } else {
      newBranchId = randomUUID();
      await client.query(
        `INSERT INTO branches (id, business_id, name, address, created_at, updated_at, version)
         VALUES ($1, $2, $3, $4, NOW(), NOW(), 1)`,
        [newBranchId, newBusinessId, 'Jáltipan Matriz', 'Jáltipan, Veracruz']
      );
      console.log(`✅ Created Branch 'Jáltipan Matriz' with ID: ${newBranchId}`);
    }

    // 3. Create Default Warehouse if warehouses table exists
    try {
      const existingWh = await client.query(`SELECT * FROM warehouses WHERE business_id = $1 AND deleted_at IS NULL`, [newBusinessId]);
      if (existingWh.rows.length === 0) {
        const newWhId = randomUUID();
        await client.query(
          `INSERT INTO warehouses (id, business_id, name, code, is_active, created_at, updated_at, version)
           VALUES ($1, $2, $3, $4, true, NOW(), NOW(), 1)`,
          [newWhId, newBusinessId, 'Almacén Principal Jáltipan', 'WH-JAL-01']
        );
        console.log(`✅ Created Warehouse 'Almacén Principal Jáltipan' with ID: ${newWhId}`);
      }
    } catch (e: any) {
      console.log('Skipping warehouse creation:', e.message);
    }

    // 4. Clone Categories
    const srcCategories = await client.query(
      `SELECT * FROM categories WHERE business_id = $1 AND deleted_at IS NULL`,
      [SOURCE_BUSINESS_ID]
    );
    console.log(`Found ${srcCategories.rows.length} categories to clone...`);

    const categoryMap = new Map<string, string>(); // oldId -> newId

    for (const cat of srcCategories.rows) {
      const existingCat = await client.query(
        `SELECT id FROM categories WHERE business_id = $1 AND name = $2 AND deleted_at IS NULL`,
        [newBusinessId, cat.name]
      );

      if (existingCat.rows.length > 0) {
        categoryMap.set(cat.id, existingCat.rows[0].id);
      } else {
        const newCatId = randomUUID();
        categoryMap.set(cat.id, newCatId);
        await client.query(
          `INSERT INTO categories (id, business_id, name, description, target_station, created_at, updated_at, version)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 1)`,
          [newCatId, newBusinessId, cat.name, cat.description, cat.target_station || 'cocina']
        );
      }
    }
    console.log(`✅ Categories cloned successfully! Total mapped: ${categoryMap.size}`);

    // 5. Clone Products
    const srcProducts = await client.query(
      `SELECT * FROM products WHERE business_id = $1 AND deleted_at IS NULL`,
      [SOURCE_BUSINESS_ID]
    );
    console.log(`Found ${srcProducts.rows.length} products to clone...`);

    let clonedProdsCount = 0;
    for (const prod of srcProducts.rows) {
      const newCatId = categoryMap.get(prod.category_id);
      if (!newCatId) {
        console.warn(`Skipping product ${prod.name} (category ${prod.category_id} not mapped)`);
        continue;
      }

      const existingProd = await client.query(
        `SELECT id FROM products WHERE business_id = $1 AND name = $2 AND deleted_at IS NULL`,
        [newBusinessId, prod.name]
      );

      if (existingProd.rows.length === 0) {
        const newProdId = randomUUID();
        await client.query(
          `INSERT INTO products (
            id, business_id, category_id, name, sku, barcode, internal_code,
            cost, price, price_wholesale, min_stock, max_stock, sale_type,
            is_sellable, is_ingredient, is_active, image_url, created_at, updated_at, version
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13,
            $14, $15, $16, $17, NOW(), NOW(), 1
          )`,
          [
            newProdId, newBusinessId, newCatId, prod.name, prod.sku, prod.barcode, prod.internal_code,
            prod.cost, prod.price, prod.price_wholesale, prod.min_stock, prod.max_stock, prod.sale_type,
            prod.is_sellable, prod.is_ingredient, prod.is_active, prod.image_url
          ]
        );
        clonedProdsCount++;
      }
    }
    console.log(`✅ ${clonedProdsCount} products cloned successfully into Cafeteria Jaltiplan!`);

    // 6. Grant Access to Admin Owners in admin_business_access
    const adminUsers = await client.query(
      `SELECT id, email, role FROM users WHERE role IN ('owner', 'inventory_admin', 'admin') AND deleted_at IS NULL`
    );

    for (const admin of adminUsers.rows) {
      try {
        const existingAccess = await client.query(
          `SELECT id FROM admin_business_access WHERE user_id = $1 AND business_id = $2 AND deleted_at IS NULL`,
          [admin.id, newBusinessId]
        );
        if (existingAccess.rows.length === 0) {
          await client.query(
            `INSERT INTO admin_business_access (id, user_id, business_id, role, created_at, updated_at, version)
             VALUES ($1, $2, $3, $4, NOW(), NOW(), 1)`,
            [randomUUID(), admin.id, newBusinessId, admin.role]
          );
          console.log(`Granted business access for ${admin.email || admin.id} to Cafeteria Jaltiplan`);
        }
      } catch (e: any) {
        console.warn(`Could not add admin_business_access for user ${admin.id}:`, e.message);
      }
    }

    // 7. Create Default POS Operators for Jaltiplan
    const defaultOperators = [
      { name: 'Mesero Jaltiplan', role: 'waiter', roles: JSON.stringify(['waiter']), pin: '1111' },
      { name: 'Cajero Jaltiplan', role: 'cashier', roles: JSON.stringify(['cashier', 'waiter']), pin: '2222' },
      { name: 'Cocina Jaltiplan', role: 'kitchen', roles: JSON.stringify(['kitchen']), pin: '3333' },
    ];

    for (const op of defaultOperators) {
      const existingOp = await client.query(
        `SELECT id FROM users WHERE business_id = $1 AND name = $2 AND deleted_at IS NULL`,
        [newBusinessId, op.name]
      );
      if (existingOp.rows.length === 0) {
        await client.query(
          `INSERT INTO users (id, business_id, branch_id, name, role, roles, pin, created_at, updated_at, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), 1)`,
          [randomUUID(), newBusinessId, newBranchId, op.name, op.role, op.roles, op.pin]
        );
        console.log(`✅ Created POS Operator '${op.name}' (PIN: ${op.pin})`);
      }
    }

    await client.query('COMMIT');
    console.log('\n=========================================');
    console.log('🎉 SUCCESS: Business "Cafeteria Jaltiplan" created and catalog fully cloned!');
    console.log(`Business ID: ${newBusinessId}`);
    console.log(`Branch ID:   ${newBranchId}`);
    console.log('=========================================\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to clone business:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
