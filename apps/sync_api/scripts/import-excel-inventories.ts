import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/database/schema';
import { sql, eq } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

// Helper to parse currency/number strings
function parseNum(val: any): number {
  if (val === null || val === undefined) return 0;
  const s = String(val).replace('$', '').replace(/,/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Detect UOM from product name
function parseUom(name: string): string {
  const n = name.toLowerCase();
  if (/\b(paq|paquete|paquetes|pq|pqt|pqte)\b/.test(n)) {
    return 'pack';
  }
  if (/\b(kg|kilo|kilos|kilogramo|kilogramos)\b/.test(n)) {
    return 'kg';
  }
  if (/\b(gr|g|gramos|gramo)\b/.test(n)) {
    return 'g';
  }
  if (/\b(lt|l|litro|litros)\b/.test(n)) {
    return 'l';
  }
  if (/\b(ml|mililitros|mililitro)\b/.test(n)) {
    return 'ml';
  }
  return 'piece';
}

// Normalize name for matching across files
function normName(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Format department nicely
function formatDept(dept: string): string {
  const d = (dept || 'General').trim();
  // Standard capitalize words
  return d
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Determine itemType, isIngredient, isSellable
function determineItemClassification(deptName: string, prodName: string): {
  itemType: string;
  isIngredient: boolean;
  isSellable: boolean;
} {
  const d = deptName.toUpperCase();
  const n = prodName.toLowerCase();

  // Packaging and cleaning
  if (d.includes('EMPAQUE') || d.includes('DESECHABLE') || d.includes('LIMPIEZA') || d.includes('MATERIAL COCINA')) {
    return { itemType: 'raw_material', isIngredient: true, isSellable: false };
  }

  // Raw foods / inputs
  if (d.includes('INSUMOS') || d.includes('CARNES') || d.includes('REFRIGERADO') || d.includes('ABARROTES') || d.includes('SAMS') || d.includes('PORCIONADO') || d.includes('WAFFLE MIX')) {
    return { itemType: 'raw_material', isIngredient: true, isSellable: false };
  }

  // Cafe Borbone
  if (d.includes('BORBONE')) {
    if (n.includes('cafiza')) {
      return { itemType: 'raw_material', isIngredient: true, isSellable: false };
    }
    return { itemType: 'raw_material', isIngredient: true, isSellable: false };
  }

  // Central in cafeteria
  if (d === 'CENTRAL') {
    if (n.includes('vaso') || n.includes('tapa') || n.includes('servilleta') || n.includes('toalla') || n.includes('papel') || n.includes('tenedor')) {
      return { itemType: 'raw_material', isIngredient: true, isSellable: false };
    }
    return { itemType: 'raw_material', isIngredient: true, isSellable: false };
  }

  // Finished Goods sold directly
  if (d.includes('PANADERIA') || d.includes('PASTES') || d.includes('PAN ARTE') || d.includes('DRINKS') || d.includes('PEÑAFIEL') || d.includes('COCA COLA') || d.includes('BEBIDAS') || d.includes('AGUA PURIFICADA')) {
    return { itemType: 'finished_good', isIngredient: false, isSellable: true };
  }

  // Default fallback
  return { itemType: 'raw_material', isIngredient: true, isSellable: false };
}

async function main() {
  const homeDir = process.env.HOME || '/Users/joelmorales';
  const file1Path = path.join(homeDir, 'Downloads', 'Inventario del Almacen del 02de Septiembre 2026.xlsx');
  const file2Path = path.join(homeDir, 'Downloads', 'INVCAFE02SeptWaldo.xlsx');

  if (!fs.existsSync(file1Path)) {
    console.error(`❌ File 1 not found: ${file1Path}`);
    process.exit(1);
  }
  if (!fs.existsSync(file2Path)) {
    console.error(`❌ File 2 not found: ${file2Path}`);
    process.exit(1);
  }

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

  console.log('🚀 Starting Multi-Warehouse Inventory Import...');
  console.log(`📁 File 1 (Almacén General): ${file1Path}`);
  console.log(`📁 File 2 (Almacén Cafetería): ${file2Path}\n`);

  try {
    // 1. Get primary business: Cafetería Cacharelo
    const businesses = await db.select().from(schema.businesses);
    let targetBusiness = businesses.find((b) => b.name.includes('Cacharelo')) || businesses[0];

    if (!targetBusiness) {
      console.error('❌ No business found in database. Run seed first.');
      process.exit(1);
    }

    const businessId = targetBusiness.id;
    console.log(`🏢 Target Business: "${targetBusiness.name}" (${businessId})\n`);

    // 2. Clean existing transactional & inventory data for this clean start
    console.log('🧹 Cleaning local transactional and inventory tables...');
    await db.transaction(async (tx) => {
      await tx.execute(sql`UPDATE business_inventory_settings SET default_warehouse_id = NULL`);
      await tx.execute(sql`DELETE FROM inventory_alerts`);
      await tx.execute(sql`DELETE FROM branch_products`);
      await tx.execute(sql`DELETE FROM branch_stock_thresholds`);
      await tx.execute(sql`DELETE FROM warehouse_stock_thresholds`);
      await tx.execute(sql`DELETE FROM branch_requisition_items`);
      await tx.execute(sql`DELETE FROM branch_requisitions`);
      await tx.execute(sql`DELETE FROM purchase_order_items`);
      await tx.execute(sql`DELETE FROM purchase_orders`);
      await tx.execute(sql`DELETE FROM stock_transfer_items`);
      await tx.execute(sql`DELETE FROM stock_transfers`);
      await tx.execute(sql`DELETE FROM stock_ledger`);
      await tx.execute(sql`DELETE FROM inventory_movements`);
      await tx.execute(sql`DELETE FROM stock_levels`);
      await tx.execute(sql`DELETE FROM inventory_receipt_items`);
      await tx.execute(sql`DELETE FROM inventory_receipts`);
      await tx.execute(sql`DELETE FROM production_runs`);
      await tx.execute(sql`DELETE FROM bulk_imports`);
      await tx.execute(sql`DELETE FROM kitchen_tickets`);
      await tx.execute(sql`DELETE FROM order_items`);
      await tx.execute(sql`DELETE FROM payments`);
      await tx.execute(sql`DELETE FROM cash_transactions`);
      await tx.execute(sql`DELETE FROM cash_shifts`);
      await tx.execute(sql`DELETE FROM orders`);
      await tx.execute(sql`DELETE FROM recipes`);
      await tx.execute(sql`DELETE FROM supplier_products`);
      await tx.execute(sql`DELETE FROM products`);
      await tx.execute(sql`DELETE FROM categories`);
      await tx.execute(sql`DELETE FROM warehouses`);
      await tx.execute(sql`UPDATE branch_tables SET state = 'free'`);
    });
    console.log('✅ Local transactional database cleaned successfully.\n');

    // 3. Create the 2 primary warehouses + transit warehouse
    console.log('📦 Creating designated warehouses...');
    const [whGeneral] = await db
      .insert(schema.warehouses)
      .values({
        businessId,
        name: 'Almacén General (Puntos de Venta Común)',
        code: 'ALM-GEN',
        locationType: 'warehouse',
        isActive: true,
      })
      .returning();

    const [whCafeteria] = await db
      .insert(schema.warehouses)
      .values({
        businessId,
        name: 'Almacén Cafetería',
        code: 'ALM-CAFE',
        locationType: 'warehouse',
        isActive: true,
      })
      .returning();

    const [whTransit] = await db
      .insert(schema.warehouses)
      .values({
        businessId,
        name: 'En Tránsito',
        code: 'TRANSIT',
        locationType: 'transit',
        isActive: false,
      })
      .returning();

    console.log(`  ✓ Almacén General: ${whGeneral.id} (${whGeneral.name}) [${whGeneral.code}]`);
    console.log(`  ✓ Almacén Cafetería: ${whCafeteria.id} (${whCafeteria.name}) [${whCafeteria.code}]`);
    console.log(`  ✓ Almacén En Tránsito: ${whTransit.id} (${whTransit.name}) [${whTransit.code}]\n`);

    // 4. Load Excel files
    console.log('📖 Reading Excel files...');
    const wb1 = XLSX.readFile(file1Path);
    const rows1: any[] = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]]);
    console.log(`  ✓ File 1 loaded: ${rows1.length} rows`);

    const wb2 = XLSX.readFile(file2Path);
    const rows2: any[] = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]]);
    console.log(`  ✓ File 2 loaded: ${rows2.length} rows\n`);

    // Helper map for categories
    const categoryMap = new Map<string, string>(); // deptName -> categoryId

    async function getOrCreateCategory(deptName: string): Promise<string> {
      const formatted = formatDept(deptName);
      if (categoryMap.has(formatted)) {
        return categoryMap.get(formatted)!;
      }
      const [existing] = await db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.name, formatted))
        .limit(1);

      if (existing) {
        categoryMap.set(formatted, existing.id);
        return existing.id;
      }

      const [created] = await db
        .insert(schema.categories)
        .values({
          businessId,
          name: formatted,
          description: `Categoría ${formatted}`,
        })
        .returning();

      categoryMap.set(formatted, created.id);
      return created.id;
    }

    // Catalog mapping: normName -> product record
    interface CatalogItem {
      id: string;
      name: string;
      sku: string | null;
      internalCode: string | null;
      barcode: string | null;
      cost: string;
      price: string;
      uom: string;
    }
    const catalogMap = new Map<string, CatalogItem>();

    let f1StockCount = 0;
    let f1TotalUnits = 0;
    let f2StockCount = 0;
    let f2TotalUnits = 0;
    let sharedProductsCount = 0;

    // 5. Process File 1 (Almacén General)
    console.log('🔄 Processing Almacén General (File 1)...');
    for (const r of rows1) {
      const rawCode = String(r['Código'] || '').trim();
      const rawName = String(r['Producto'] || '').trim();
      if (!rawName) continue;

      const cost = parseNum(r['P. Costo']).toFixed(2);
      const price = parseNum(r['P. Venta']).toFixed(2);
      const priceWholesale = parseNum(r['P. Mayoreo']).toFixed(2);
      const existence = parseNum(r['Existencia']);
      const minStock = parseNum(r['Inv. Mínimo']).toFixed(3);
      const maxStock = parseNum(r['Inv. Máximo']).toFixed(3);
      const dept = String(r['Departamento'] || 'General').trim();

      const uom = parseUom(rawName);
      const saleType = uom === 'piece' || uom === 'pack' ? 'pieza' : 'granel';
      const classification = determineItemClassification(dept, rawName);
      const categoryId = await getOrCreateCategory(dept);

      const barcode = rawCode.length >= 10 && /^\d+$/.test(rawCode) ? rawCode : null;
      const sku = rawCode || null;

      const [createdProduct] = await db
        .insert(schema.products)
        .values({
          businessId,
          categoryId,
          name: rawName,
          sku,
          internalCode: sku,
          barcode,
          cost,
          price,
          priceWholesale,
          minStock,
          maxStock,
          saleType,
          itemType: classification.itemType,
          uom,
          isIngredient: classification.isIngredient,
          isSellable: classification.isSellable,
          isActive: true,
        })
        .returning();

      catalogMap.set(normName(rawName), {
        id: createdProduct.id,
        name: rawName,
        sku,
        internalCode: sku,
        barcode,
        cost,
        price,
        uom,
      });

      // Record opening stock in Almacén General
      if (existence > 0) {
        f1StockCount++;
        f1TotalUnits += existence;

        await db.insert(schema.stockLedger).values({
          businessId,
          productId: createdProduct.id,
          warehouseId: whGeneral.id,
          quantityDelta: existence.toFixed(3),
          eventType: 'initial',
          unitCost: cost,
          referenceType: 'initial_load',
          documentNumber: 'INV-GEN-020926',
          notes: 'Inventario inicial Almacén General al 02-Sept-2026',
        });

        await db.insert(schema.stockLevels).values({
          productId: createdProduct.id,
          warehouseId: whGeneral.id,
          quantity: existence.toFixed(3),
        });
      }

      // Warehouse thresholds
      if (parseFloat(minStock) > 0 || parseFloat(maxStock) > 0) {
        await db.insert(schema.warehouseStockThresholds).values({
          businessId,
          productId: createdProduct.id,
          warehouseId: whGeneral.id,
          minStock,
          maxStock,
        });
      }
    }
    console.log(`  ✓ File 1 processed: ${rows1.length} products loaded into catalog.`);
    console.log(`  ✓ Almacén General opening stock: ${f1StockCount} items with stock > 0, Total: ${f1TotalUnits.toFixed(2)} units.`);

    // 6. Process File 2 (Almacén Cafetería)
    console.log('\n🔄 Processing Almacén Cafetería (File 2)...');
    for (const r of rows2) {
      const rawCode = String(r['Código'] || '').trim();
      const rawName = String(r['Producto'] || '').trim();
      if (!rawName) continue;

      const cost = parseNum(r['P. Costo']).toFixed(2);
      const price = parseNum(r['P. Venta']).toFixed(2);
      const priceWholesale = parseNum(r['P. Mayoreo']).toFixed(2);
      const existence = parseNum(r['Existencia']);
      const minStock = parseNum(r['Inv. Mínimo']).toFixed(3);
      const maxStock = parseNum(r['Inv. Máximo']).toFixed(3);
      const dept = String(r['Departamento'] || 'Cafetería').trim();

      const normalized = normName(rawName);
      let targetProduct = catalogMap.get(normalized);

      if (targetProduct) {
        // Product already exists in catalog from File 1 (shared item)
        sharedProductsCount++;
        // If File 2 has an internal code and product doesn't, update it
        if (rawCode && (!targetProduct.internalCode || targetProduct.internalCode === targetProduct.sku)) {
          await db
            .update(schema.products)
            .set({ internalCode: rawCode })
            .where(eq(schema.products.id, targetProduct.id));
        }
      } else {
        // Unique product to Cafetería
        const uom = parseUom(rawName);
        const saleType = uom === 'piece' || uom === 'pack' ? 'pieza' : 'granel';
        const classification = determineItemClassification(dept, rawName);
        const categoryId = await getOrCreateCategory(dept);
        const barcode = rawCode.length >= 10 && /^\d+$/.test(rawCode) ? rawCode : null;

        const [createdProduct] = await db
          .insert(schema.products)
          .values({
            businessId,
            categoryId,
            name: rawName,
            sku: rawCode || null,
            internalCode: rawCode || null,
            barcode,
            cost,
            price,
            priceWholesale,
            minStock,
            maxStock,
            saleType,
            itemType: classification.itemType,
            uom,
            isIngredient: classification.isIngredient,
            isSellable: classification.isSellable,
            isActive: true,
          })
          .returning();

        targetProduct = {
          id: createdProduct.id,
          name: rawName,
          sku: rawCode || null,
          internalCode: rawCode || null,
          barcode,
          cost,
          price,
          uom,
        };

        catalogMap.set(normalized, targetProduct);
      }

      // Record opening stock in Almacén Cafetería
      if (existence > 0) {
        f2StockCount++;
        f2TotalUnits += existence;

        await db.insert(schema.stockLedger).values({
          businessId,
          productId: targetProduct.id,
          warehouseId: whCafeteria.id,
          quantityDelta: existence.toFixed(3),
          eventType: 'initial',
          unitCost: cost,
          referenceType: 'initial_load',
          documentNumber: 'INV-CAFE-020926',
          notes: 'Inventario inicial Almacén Cafetería al 02-Sept-2026',
        });

        await db.insert(schema.stockLevels).values({
          productId: targetProduct.id,
          warehouseId: whCafeteria.id,
          quantity: existence.toFixed(3),
        });
      }

      // Warehouse thresholds for Cafetería
      if (parseFloat(minStock) > 0 || parseFloat(maxStock) > 0) {
        await db.insert(schema.warehouseStockThresholds).values({
          businessId,
          productId: targetProduct.id,
          warehouseId: whCafeteria.id,
          minStock,
          maxStock,
        });
      }
    }

    console.log(`  ✓ File 2 processed: ${rows2.length} rows.`);
    console.log(`  ✓ Shared products in both warehouses: ${sharedProductsCount}`);
    console.log(`  ✓ Almacén Cafetería opening stock: ${f2StockCount} items with stock > 0, Total: ${f2TotalUnits.toFixed(2)} units.`);

    // 7. Summary
    const totalCategories = await db.select({ count: sql`count(*)` }).from(schema.categories);
    const totalProducts = await db.select({ count: sql`count(*)` }).from(schema.products);
    const totalLedger = await db.select({ count: sql`count(*)` }).from(schema.stockLedger);
    const totalLevels = await db.select({ count: sql`count(*)` }).from(schema.stockLevels);

    console.log('\n========================================================');
    console.log('🎉 INVENTORY IMPORT COMPLETED SUCCESSFULLY!');
    console.log('========================================================');
    console.log(`🏢 Business: ${targetBusiness.name}`);
    console.log(`📦 Warehouses:`);
    console.log(`   1. Almacén General (Puntos de Venta Común) [${whGeneral.code}]`);
    console.log(`   2. Almacén Cafetería [${whCafeteria.code}]`);
    console.log(`   3. En Tránsito [${whTransit.code}]`);
    console.log(`🏷️  Total Categories Created: ${totalCategories[0].count}`);
    console.log(`📋 Total Unique Products in Catalog: ${totalProducts[0].count}`);
    console.log(`📊 Stock Ledger Entries: ${totalLedger[0].count}`);
    console.log(`📈 Stock Level Records: ${totalLevels[0].count}`);
    console.log(`   - Almacén General: ${f1StockCount} items with stock (${f1TotalUnits.toFixed(2)} units)`);
    console.log(`   - Almacén Cafetería: ${f2StockCount} items with stock (${f2TotalUnits.toFixed(2)} units)`);
    console.log('========================================================\n');
  } catch (err) {
    console.error('❌ Error during import:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
