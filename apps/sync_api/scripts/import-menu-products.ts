import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/database/schema';
import { eq, and } from 'drizzle-orm';
import { CACHARELO_MENU_PRESET } from '../../menu_generator/src/data/defaultMenu';
import * as path from 'path';
import * as fs from 'fs';

function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function resolveCategoryName(section: { id: string; name: string; kicker?: string }): string {
  switch (section.id) {
    case 'ensaladas':
      return 'Ensaladas';
    case 'desayunos-huevos-al-gusto':
      return 'Huevos al Gusto';
    case 'desayunos-especialidades':
      return 'Desayunos Especiales';
    case 'waffles-belgas':
      return 'Waffles Belgas';
    case 'bowls-de-fruta':
      return 'Bowls de Fruta';
    case 'croissant':
      return 'Croissants';
    case 'sandwiches':
      return 'Sandwiches';
    case 'baguettes':
      return 'Baguettes';
    case 'bagels':
      return 'Bagels';
    case 'pan-artesanal':
      return 'Pan Artesanal';
    case 'extras':
      return 'Extras y Modificadores';
    case 'bebidas-calientes':
      return 'Bebidas Calientes';
    case 'tes':
      return 'Tés e Infusiones';
    case 'smoothies':
      return 'Smoothies y Bebidas Frías';
    case 'refrescos':
      return 'Refrescos y Aguas';
    default:
      return section.name;
  }
}

async function main() {
  console.log('=======================================================================');
  console.log('🍽️  IMPORTING CACHARELO MENU PRESET INTO CAFETERÍA POS CATALOG        ');
  console.log('=======================================================================');

  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL || 'postgresql://pos_user:pos_password@localhost:5432/pos_dev',
  });
  const db = drizzle(pool, { schema });

  try {
    // 1. Get primary business
    const businesses = await db.select().from(schema.businesses);
    const targetBusiness = businesses.find((b) => b.name.includes('Cacharelo')) || businesses[0];
    if (!targetBusiness) throw new Error('No business found in database.');
    const businessId = targetBusiness.id;
    console.log(`🏢 Business: "${targetBusiness.name}" (${businessId})`);

    // 2. Get Almacén Cafetería and Branch Sala 1 / Centro
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

    // 3. Ensure Categories
    const existingCats = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.businessId, businessId));
    const categoryMap = new Map<string, string>();
    for (const c of existingCats) {
      categoryMap.set(norm(c.name), c.id);
    }

    const ensureCategory = async (catName: string): Promise<string> => {
      const k = norm(catName);
      if (categoryMap.has(k)) return categoryMap.get(k)!;

      const [newCat] = await db
        .insert(schema.categories)
        .values({
          businessId,
          name: catName,
          description: `Categoría ${catName} del menú de cafetería`,
        })
        .returning();
      categoryMap.set(k, newCat.id);
      return newCat.id;
    };

    // 4. Fetch existing products
    const dbProducts = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.businessId, businessId));
    const productBySku = new Map<string, typeof dbProducts[number]>();
    const productByName = new Map<string, typeof dbProducts[number]>();
    for (const p of dbProducts) {
      if (p.sku) productBySku.set(String(p.sku).trim(), p);
      productByName.set(norm(p.name), p);
    }

    // 5. Iterate through menu sections and dishes
    let createdCount = 0;
    let updatedCount = 0;
    let stockLevelsCreated = 0;

    for (const section of CACHARELO_MENU_PRESET.sections) {
      const catName = resolveCategoryName(section);
      const categoryId = await ensureCategory(catName);
      const isExtra = section.name.toUpperCase() === 'EXTRAS';

      console.log(`📂 Processing Section: "${section.name}" (Kicker: "${section.kicker || ''}") -> Cat: "${catName}" (${section.dishes?.length || 0} items)`);

      for (const dish of (section.dishes || [])) {
        const sku = `MENU-${dish.id.toUpperCase()}`;
        const price = (dish.price || 0).toFixed(2);
        const imageUrl = dish.image || null;

        // Check if matching by SKU or Name
        const existing = productBySku.get(sku) || productByName.get(norm(dish.name));

        let productId: string;

        if (existing) {
          // Update menu dish
          productId = existing.id;
          await db
            .update(schema.products)
            .set({
              name: dish.name,
              sku: existing.sku || sku,
              barcode: existing.barcode || sku,
              price,
              imageUrl: imageUrl || existing.imageUrl,
              isSellable: true,
              itemType: isExtra ? 'raw_material' : 'finished_good',
              productionStrategy: isExtra ? 'none' : 'backflush',
              uom: 'piece',
              saleType: 'pieza',
              categoryId,
            })
            .where(eq(schema.products.id, existing.id));
          updatedCount++;
        } else {
          // Insert new dish
          const [newProd] = await db
            .insert(schema.products)
            .values({
              businessId,
              categoryId,
              name: dish.name,
              sku,
              barcode: sku,
              internalCode: dish.id,
              cost: '0.00',
              price,
              priceWholesale: '0.00',
              saleType: 'pieza',
              uom: 'piece',
              itemType: isExtra ? 'raw_material' : 'finished_good',
              productionStrategy: isExtra ? 'none' : 'backflush',
              isIngredient: isExtra,
              isSellable: true,
              isActive: true,
              imageUrl,
            })
            .returning();
          productId = newProd.id;
          productBySku.set(sku, newProd);
          productByName.set(norm(dish.name), newProd);
          createdCount++;
        }

        // Ensure stock level row exists for Almacén Cafetería
        const [existingWhStock] = await db
          .select()
          .from(schema.stockLevels)
          .where(
            and(
              eq(schema.stockLevels.productId, productId),
              eq(schema.stockLevels.warehouseId, whCafeteria.id),
            ),
          );

        if (!existingWhStock) {
          await db.insert(schema.stockLevels).values({
            productId,
            warehouseId: whCafeteria.id,
            quantity: '0.000',
          });
          stockLevelsCreated++;
        }

        // Ensure stock level row exists for Branch Sala 1 / Centro
        const [existingBrStock] = await db
          .select()
          .from(schema.stockLevels)
          .where(
            and(
              eq(schema.stockLevels.productId, productId),
              eq(schema.stockLevels.branchId, branchSala1.id),
            ),
          );

        if (!existingBrStock) {
          await db.insert(schema.stockLevels).values({
            productId,
            branchId: branchSala1.id,
            quantity: '0.000',
          });
        }
      }
    }

    console.log('\n=======================================================================');
    console.log(`✅ Menu Import Completed:`);
    console.log(`   ✓ New Dishes Created in Catalog: ${createdCount}`);
    console.log(`   ✓ Existing Products Updated with Menu Data: ${updatedCount}`);
    console.log(`   ✓ Stock Level entries initialized: ${stockLevelsCreated}`);
    console.log('=======================================================================');

    // 6. Copy dish images to business_control_tauri/public/dishes
    const srcDishesDir = path.resolve(__dirname, '../../menu_generator/public/dishes');
    const destDishesDir = path.resolve(__dirname, '../../business_control_tauri/public/dishes');

    if (fs.existsSync(srcDishesDir)) {
      if (!fs.existsSync(destDishesDir)) {
        fs.mkdirSync(destDishesDir, { recursive: true });
      }
      const files = fs.readdirSync(srcDishesDir);
      let copied = 0;
      for (const file of files) {
        const srcFile = path.join(srcDishesDir, file);
        const destFile = path.join(destDishesDir, file);
        if (fs.statSync(srcFile).isFile()) {
          fs.copyFileSync(srcFile, destFile);
          copied++;
        }
      }
      console.log(`🖼️  Copied ${copied} dish images to apps/business_control_tauri/public/dishes/`);
    }

  } catch (err) {
    console.error('❌ Error during menu import:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
