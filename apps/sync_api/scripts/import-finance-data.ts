import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/database/schema';
import { sql, eq, and, isNull } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

// Helper to parse numbers and currency
function parseNum(val: any): number {
  if (val === null || val === undefined) return 0;
  const s = String(val).replace('$', '').replace(/,/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Normalize strings for matching
function normName(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Map unit of measure strings
function mapUomAndSaleType(rawUnit: string, prodName: string): { uom: string; saleType: string } {
  const u = String(rawUnit || '').toUpperCase().trim();
  const n = prodName.toLowerCase();

  if (u.includes('KG') || /\b(kg|kilo|kilos|kilogramo)\b/.test(n)) {
    return { uom: 'kg', saleType: 'kg' };
  }
  if (u.includes('GRAMO') || /\b(gr|g|gramos|gramo)\b/.test(n)) {
    return { uom: 'g', saleType: 'gramo' };
  }
  if (u.includes('LITRO') || u.includes('LT') || /\b(lt|l|litro|litros)\b/.test(n)) {
    return { uom: 'l', saleType: 'litro' };
  }
  if (u.includes('ML') || /\b(ml|mililitros)\b/.test(n)) {
    return { uom: 'ml', saleType: 'mililitro' };
  }
  if (u.includes('PAQ') || u.includes('BOLSA') || /\b(paq|paquete|bolsa)\b/.test(n)) {
    return { uom: 'piece', saleType: 'paquete' };
  }
  if (u.includes('LATA')) {
    return { uom: 'piece', saleType: 'lata' };
  }
  if (u.includes('BOTELLA')) {
    return { uom: 'piece', saleType: 'botella' };
  }
  return { uom: 'piece', saleType: 'pieza' };
}

// Determine item classification
function determineItemClassification(deptName: string, prodName: string): {
  itemType: string;
  isIngredient: boolean;
  isSellable: boolean;
} {
  const d = (deptName || '').toUpperCase();
  const n = prodName.toLowerCase();

  // Packaging and supplies
  if (d.includes('SUMINISTROS') || d.includes('EMPAQUE') || d.includes('DESECHABLE') || d.includes('LIMPIEZA')) {
    return { itemType: 'raw_material', isIngredient: true, isSellable: false };
  }

  // Foods / raw ingredients
  if (
    d.includes('ABARROTES') ||
    d.includes('FRUTAS') ||
    d.includes('VERDURAS') ||
    d.includes('LACTEOS') ||
    d.includes('PROTEINA') ||
    d.includes('CONGELADOS') ||
    d.includes('WAFFLE MIX')
  ) {
    return { itemType: 'raw_material', isIngredient: true, isSellable: false };
  }

  // Coffee inputs
  if (d.includes('BORBONE')) {
    return { itemType: 'raw_material', isIngredient: true, isSellable: false };
  }

  // Finished Goods sold directly
  if (
    d.includes('PAN') ||
    d.includes('PASTE') ||
    d.includes('BEBIDAS') ||
    d.includes('COCA') ||
    d.includes('AGUA') ||
    d.includes('FANTA') ||
    d.includes('SPRITE') ||
    d.includes('MUNDET') ||
    d.includes('TOPOCHICO') ||
    d.includes('WHITE')
  ) {
    return { itemType: 'finished_good', isIngredient: false, isSellable: true };
  }

  return { itemType: 'raw_material', isIngredient: true, isSellable: false };
}

async function main() {
  const homeDir = process.env.HOME || '/Users/joelmorales';
  const financeDir = path.join(homeDir, 'Downloads', 'new cacharelo files');

  const fileCostPath = path.join(financeDir, 'INVENTARIO COSTEADO CAFETERIA 21-09-26.xlsx');
  const fileCafePath = path.join(financeDir, 'INVENTARIO DE CAFETERIA DEL 22-09-2026.xlsx');
  const fileSalidasPath = path.join(financeDir, 'SALIDAS  DE SALA1 DEL 22-09-2026.xlsx');

  if (!fs.existsSync(fileCostPath) || !fs.existsSync(fileCafePath) || !fs.existsSync(fileSalidasPath)) {
    console.error('❌ One or more finance files not found in:', financeDir);
    process.exit(1);
  }

  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL || 'postgresql://pos_user:pos_password@localhost:5432/pos_dev',
  });
  const db = drizzle(pool, { schema });

  console.log('=======================================================================');
  console.log('🚀 IMPORTING FINANCE FILES (COSTS, CAFETERÍA STOCK & SALA 1 KARDEX)    ');
  console.log('=======================================================================');

  try {
    // 1. Target Business & Locations
    const businesses = await db.select().from(schema.businesses);
    const targetBusiness = businesses.find((b) => b.name.includes('Cacharelo')) || businesses[0];
    if (!targetBusiness) throw new Error('No business found in database.');
    const businessId = targetBusiness.id;
    console.log(`🏢 Business: "${targetBusiness.name}" (${businessId})`);

    const warehouses = await db
      .select()
      .from(schema.warehouses)
      .where(eq(schema.warehouses.businessId, businessId));
    let whCafeteria = warehouses.find((w) => w.code === 'ALM-CAFE');
    if (!whCafeteria) {
      const [newWh] = await db
        .insert(schema.warehouses)
        .values({
          businessId,
          name: 'Almacén Cafetería',
          code: 'ALM-CAFE',
          locationType: 'warehouse',
          isActive: true,
        })
        .returning();
      whCafeteria = newWh;
    }
    console.log(`📦 Almacén Cafetería ID: ${whCafeteria.id}`);

    const branches = await db
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.businessId, businessId));
    const branchSala1 =
      branches.find((b) => b.name.includes('Centro') || b.name.includes('Sala 1')) || branches[0];
    console.log(`🏪 Branch Sala 1 / Centro ID: ${branchSala1.id} (${branchSala1.name})\n`);

    // 2. Read File 1: INVENTARIO COSTEADO
    console.log('📖 Step 1: Processing INVENTARIO COSTEADO CAFETERIA 21-09-26.xlsx...');
    const wbCost = XLSX.readFile(fileCostPath);
    const wsCost = wbCost.Sheets['21-09-26'] || wbCost.Sheets['INVENTARIO DIARIO'];
    const rowsCost = XLSX.utils.sheet_to_json(wsCost, { header: 1 });

    const costBySku = new Map<string, { cost: number; uom: string; saleType: string; name: string }>();
    const costByName = new Map<string, { cost: number; uom: string; saleType: string; name: string }>();

    for (let i = 2; i < rowsCost.length; i++) {
      const r = rowsCost[i] as any[];
      if (!r || !r[1] || typeof r[3] !== 'number') continue;
      const sku = r[0] ? String(r[0]).trim() : null;
      const name = String(r[1]).trim();
      const rawUnit = r[2] ? String(r[2]).trim() : '';
      const cost = Number(r[3]) || 0;
      const { uom, saleType } = mapUomAndSaleType(rawUnit, name);

      const item = { cost, uom, saleType, name };
      if (sku) costBySku.set(sku, item);
      costByName.set(normName(name), item);
    }
    console.log(`   ✓ Extracted unit costs for ${costByName.size} products from cost sheet.\n`);

    // 3. Read Categories
    const existingCategories = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.businessId, businessId));
    const categoryMap = new Map<string, string>();
    for (const c of existingCategories) {
      categoryMap.set(normName(c.name), c.id);
    }

    const ensureCategory = async (name: string): Promise<string> => {
      const clean = (name || 'General').trim();
      const k = normName(clean);
      if (categoryMap.has(k)) return categoryMap.get(k)!;

      const [newCat] = await db
        .insert(schema.categories)
        .values({
          businessId,
          name: clean,
          description: `Categoría ${clean}`,
        })
        .returning();
      categoryMap.set(k, newCat.id);
      return newCat.id;
    };

    // 4. Read File 2: INVENTARIO DE CAFETERIA DEL 22-09-2026
    console.log('📖 Step 2: Processing INVENTARIO DE CAFETERIA DEL 22-09-2026.xlsx...');
    const wbCafe = XLSX.readFile(fileCafePath);
    const rowsCafe = XLSX.utils.sheet_to_json(wbCafe.Sheets['Sheet1']) as any[];

    // Fetch existing DB products
    const dbProducts = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.businessId, businessId));
    const productBySku = new Map<string, typeof dbProducts[number]>();
    const productByName = new Map<string, typeof dbProducts[number]>();
    for (const p of dbProducts) {
      if (p.sku) productBySku.set(String(p.sku).trim(), p);
      productByName.set(normName(p.name), p);
    }

    let productsCreated = 0;
    let productsUpdated = 0;
    let cafeteriaStockUpdated = 0;
    let totalStockQty = 0;
    let totalStockValue = 0;

    for (const r of rowsCafe) {
      const sku = r['Código'] ? String(r['Código']).trim() : null;
      const name = String(r['Producto'] || '').trim();
      if (!name) continue;

      const norm = normName(name);
      const price = parseNum(r['P. Venta']);
      const stock = parseNum(r['Existencia']);
      const dept = r['Departamento'] || 'General';

      // Look up cost intelligence
      const costInfo = (sku ? costBySku.get(sku) : null) || costByName.get(norm);
      const cost = costInfo?.cost ?? 0;
      const { uom, saleType } = costInfo
        ? { uom: costInfo.uom, saleType: costInfo.saleType }
        : mapUomAndSaleType('', name);

      let productId: string;
      const existing = (sku ? productBySku.get(sku) : null) || productByName.get(norm);

      if (existing) {
        productId = existing.id;
        // Update product cost, price, and UOM
        const updateData: any = {};
        if (cost > 0 && parseFloat(existing.cost || '0') === 0) {
          updateData.cost = cost.toFixed(2);
        }
        if (price > 0 && parseFloat(existing.price || '0') === 0) {
          updateData.price = price.toFixed(2);
        }
        if (existing.uom === 'piece' && uom !== 'piece') {
          updateData.uom = uom;
          updateData.saleType = saleType;
        }

        if (Object.keys(updateData).length > 0) {
          await db
            .update(schema.products)
            .set(updateData)
            .where(eq(schema.products.id, existing.id));
          productsUpdated++;
        }
      } else {
        // Create missing product
        const categoryId = await ensureCategory(dept);
        const classification = determineItemClassification(dept, name);

        const [newProduct] = await db
          .insert(schema.products)
          .values({
            businessId,
            categoryId,
            name,
            sku,
            barcode: sku,
            internalCode: sku,
            cost: cost.toFixed(2),
            price: price.toFixed(2),
            priceWholesale: '0.00',
            saleType,
            uom,
            itemType: classification.itemType,
            isIngredient: classification.isIngredient,
            isSellable: classification.isSellable,
            isActive: true,
          })
          .returning();

        productId = newProduct.id;
        if (sku) productBySku.set(sku, newProduct);
        productByName.set(norm, newProduct);
        productsCreated++;
      }

      // Upsert stock into Almacén Cafetería
      const [existingStock] = await db
        .select()
        .from(schema.stockLevels)
        .where(
          and(
            eq(schema.stockLevels.productId, productId),
            eq(schema.stockLevels.warehouseId, whCafeteria.id),
          ),
        );

      if (existingStock) {
        await db
          .update(schema.stockLevels)
          .set({ quantity: stock.toFixed(3), updatedAt: new Date() })
          .where(eq(schema.stockLevels.id, existingStock.id));
      } else {
        await db.insert(schema.stockLevels).values({
          productId,
          warehouseId: whCafeteria.id,
          quantity: stock.toFixed(3),
        });
      }

      cafeteriaStockUpdated++;
      totalStockQty += stock;
      totalStockValue += stock * cost;
    }

    console.log(`   ✓ New products registered: ${productsCreated}`);
    console.log(`   ✓ Existing products updated with cost/prices: ${productsUpdated}`);
    console.log(`   ✓ Stock levels updated for Almacén Cafetería: ${cafeteriaStockUpdated}`);
    console.log(`   ✓ Total Cafetería inventory units: ${totalStockQty.toFixed(2)}`);
    console.log(`   ✓ Total Cafetería valued inventory: $${totalStockValue.toFixed(2)} MXN\n`);

    // 5. Update any remaining products in DB that have cost in File 1
    console.log('📖 Step 3: Enriching remaining catalog products with cost sheet data...');
    let remainingUpdated = 0;
    const allDbProducts = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.businessId, businessId));

    for (const p of allDbProducts) {
      if (parseFloat(p.cost || '0') > 0) continue; // Already has cost
      const costInfo = (p.sku ? costBySku.get(p.sku) : null) || costByName.get(normName(p.name));
      if (costInfo && costInfo.cost > 0) {
        await db
          .update(schema.products)
          .set({
            cost: costInfo.cost.toFixed(2),
            uom: costInfo.uom,
            saleType: costInfo.saleType,
          })
          .where(eq(schema.products.id, p.id));
        remainingUpdated++;
      }
    }
    console.log(`   ✓ Additional ${remainingUpdated} products enriched with true costs.\n`);

    // 6. Read File 3: SALIDAS DE SALA1 DEL 22-09-2026 (Sales movements)
    console.log('📖 Step 4: Ingesting SALIDAS DE SALA1 DEL 22-09-2026.xlsx into Kardex...');
    const wbSalidas = XLSX.readFile(fileSalidasPath);
    const rowsSalidas = XLSX.utils.sheet_to_json(wbSalidas.Sheets['Sheet1']) as any[];

    // Clear previous imported salidas in stock_ledger for clean idempotent import
    await db
      .delete(schema.stockLedger)
      .where(
        and(
          eq(schema.stockLedger.businessId, businessId),
          eq(schema.stockLedger.referenceType, 'pos_sale_import'),
        ),
      );

    let salesRecorded = 0;
    let totalItemsSold = 0;
    const finalStockByProduct = new Map<string, number>();

    for (const r of rowsSalidas) {
      const code = String(r['Código'] || '').trim();
      const prodName = String(r['Producto'] || '').trim();
      const qty = Math.abs(parseFloat(String(r['Cantidad'] || '0')));
      const desc = String(r['Descripción de movimiento'] || 'Venta');
      const cashier = String(r['Cajero'] || 'cajero');
      const timeStr = String(r['Hora'] || '');
      const has = parseFloat(String(r['Hay'] || '0'));

      let p = productBySku.get(code) || productByName.get(normName(prodName));
      if (!p) {
        const dept = String(r['Departamento'] || 'PASTES');
        const categoryId = await ensureCategory(dept);
        const classification = determineItemClassification(dept, prodName);
        const costInfo = costBySku.get(code) || costByName.get(normName(prodName));
        const cost = costInfo?.cost ?? 0;
        const { uom, saleType } = mapUomAndSaleType(costInfo?.uom || '', prodName);

        const [createdProd] = await db
          .insert(schema.products)
          .values({
            businessId,
            categoryId,
            name: prodName,
            sku: code,
            barcode: code,
            internalCode: code,
            cost: cost.toFixed(2),
            price: '0.00',
            priceWholesale: '0.00',
            saleType,
            uom,
            itemType: classification.itemType,
            isIngredient: classification.isIngredient,
            isSellable: classification.isSellable,
            isActive: true,
          })
          .returning();
        p = createdProd;
        productBySku.set(code, createdProd);
        productByName.set(normName(prodName), createdProd);
      }

      const unitCost = parseFloat(p.cost || '0');

      // Record in stockLedger
      await db.insert(schema.stockLedger).values({
        businessId,
        productId: p.id,
        branchId: branchSala1.id,
        quantityDelta: (-qty).toFixed(3),
        eventType: 'sale',
        unitCost: unitCost.toFixed(2),
        referenceType: 'pos_sale_import',
        documentNumber: desc,
        notes: `${desc} - ${cashier} (${timeStr})`,
      });

      salesRecorded++;
      totalItemsSold += qty;
      finalStockByProduct.set(p.id, has);
    }

    // Update branch stock levels for Sala 1 to reflect latest 'Hay' count
    for (const [prodId, finalQty] of finalStockByProduct.entries()) {
      const [existingBranchStock] = await db
        .select()
        .from(schema.stockLevels)
        .where(
          and(
            eq(schema.stockLevels.productId, prodId),
            eq(schema.stockLevels.branchId, branchSala1.id),
          ),
        );

      if (existingBranchStock) {
        await db
          .update(schema.stockLevels)
          .set({ quantity: finalQty.toFixed(3), updatedAt: new Date() })
          .where(eq(schema.stockLevels.id, existingBranchStock.id));
      } else {
        await db.insert(schema.stockLevels).values({
          productId: prodId,
          branchId: branchSala1.id,
          quantity: finalQty.toFixed(3),
        });
      }
    }

    console.log(`   ✓ Sales Kardex movements registered: ${salesRecorded} transactions`);
    console.log(`   ✓ Total items sold: ${totalItemsSold.toFixed(2)} units`);
    console.log(`   ✓ Sala 1 branch stock balances synchronized for ${finalStockByProduct.size} products.`);

    console.log('\n=======================================================================');
    console.log('✅ ALL FINANCE DATA IMPORTED SUCCESSFULLY!');
    console.log('=======================================================================');
  } catch (err) {
    console.error('❌ Error during import:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
