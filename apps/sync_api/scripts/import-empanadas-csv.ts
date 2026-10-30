import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

interface CsvRow {
  name: string;
  price: string;
  categoryName: string;
  targetStation: string;
}

function classifyProduct(name: string): { categoryName: string; targetStation: string } {
  const lower = name.toLowerCase();
  if (lower.startsWith('paste ')) {
    const sweetKeywords = ['arroz', 'cajeta', 'crema', 'fresa', 'manzana', 'nutella', 'piña', 'zarzamora'];
    const isSweet = sweetKeywords.some((k) => lower.includes(k));
    return {
      categoryName: isSweet ? 'Pastes Dulces' : 'Pastes Salados',
      targetStation: 'cocina',
    };
  }
  if (
    lower.includes('americano') ||
    lower.includes('capuccino') ||
    lower.includes('chocolate') ||
    lower.includes('moka')
  ) {
    return { categoryName: 'Cafetería', targetStation: 'barra' };
  }
  return { categoryName: 'Bebidas y Refrescos', targetStation: 'barra' };
}

async function main() {
  const csvPath =
    process.env.CSV_PATH ||
    path.join(process.env.HOME || '', 'Downloads/productos_precios.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at: ${csvPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, 'utf-8');
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(',');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const price = parseFloat(parts[1].trim()).toFixed(2);
      const { categoryName, targetStation } = classifyProduct(name);
      rows.push({ name, price, categoryName, targetStation });
    }
  }

  console.log(`Parsed ${rows.length} products from CSV.`);

  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db';
  const client = new Client({ connectionString });
  await client.connect();

  const EMPANADAS_BIZ_ID = 'd3b07384-d113-4a0e-a555-e5b12824bf03';

  try {
    await client.query('BEGIN');

    // 1. Ensure categories exist
    const categoryMap = new Map<string, string>();
    const distinctCategories = Array.from(
      new Set(rows.map((r) => JSON.stringify({ name: r.categoryName, station: r.targetStation })))
    ).map((s) => JSON.parse(s));

    for (const cat of distinctCategories) {
      const catCheck = await client.query(
        `SELECT id FROM categories WHERE business_id = $1 AND name = $2 AND deleted_at IS NULL`,
        [EMPANADAS_BIZ_ID, cat.name]
      );
      if (catCheck.rows.length > 0) {
        categoryMap.set(cat.name, catCheck.rows[0].id);
      } else {
        const catInsert = await client.query(
          `INSERT INTO categories (business_id, name, target_station) VALUES ($1, $2, $3) RETURNING id`,
          [EMPANADAS_BIZ_ID, cat.name, cat.station]
        );
        categoryMap.set(cat.name, catInsert.rows[0].id);
        console.log(`Created category '${cat.name}' (${cat.station})`);
      }
    }

    // 2. Insert products
    let inserted = 0;
    for (const r of rows) {
      const catId = categoryMap.get(r.categoryName);
      await client.query(
        `INSERT INTO products (
          business_id, category_id, name, price, cost, sale_type, item_type, is_sellable, is_active
        ) VALUES ($1, $2, $3, $4, '0.00', 'pieza', 'finished_good', true, true)`,
        [EMPANADAS_BIZ_ID, catId, r.name, r.price]
      );
      inserted++;
    }

    await client.query('COMMIT');
    console.log(`✅ Successfully imported ${inserted} products into Empanadas.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
