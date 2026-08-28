#!/usr/bin/env tsx
/**
 * Reconcile legacy `is_sellable` / `is_ingredient` flags with `item_type`.
 *
 * The inventory model now derives these booleans from `item_type`:
 *   raw_material   -> is_ingredient = true,  is_sellable = false
 *   wip            -> is_ingredient = false, is_sellable = false
 *   finished_good  -> is_ingredient = false, is_sellable = true
 *   service        -> is_ingredient = false, is_sellable = true
 *
 * Usage:
 *   npx tsx scripts/reconcile-product-item-type.ts           # dry-run (report only)
 *   npx tsx scripts/reconcile-product-item-type.ts --apply   # write changes
 */

import { db } from '../src/database/connection';
import { sql } from 'drizzle-orm';

const APPLY = process.argv.includes('--apply');

const EXPECTED: Record<string, { isIngredient: boolean; isSellable: boolean }> = {
  raw_material: { isIngredient: true, isSellable: false },
  wip: { isIngredient: false, isSellable: false },
  finished_good: { isIngredient: false, isSellable: true },
  service: { isIngredient: false, isSellable: true },
};

async function main() {
  console.log(APPLY ? '✍️  Apply mode ON' : '🔍 Dry-run mode (use --apply to write)');

  const rows = await db.execute(sql`
    SELECT id, name, item_type, is_sellable, is_ingredient
    FROM products
    WHERE deleted_at IS NULL
  `);

  const mismatches: Array<{ id: string; name: string; itemType: string; current: string; expected: string }> = [];

  for (const r of rows.rows as any[]) {
    const itemType = r.item_type || 'finished_good';
    const exp = EXPECTED[itemType];
    if (!exp) continue;

    const currentSellable = r.is_sellable !== false;
    const currentIngredient = r.is_ingredient === true;

    if (currentSellable !== exp.isSellable || currentIngredient !== exp.isIngredient) {
      mismatches.push({
        id: r.id,
        name: r.name,
        itemType,
        current: `isSellable=${currentSellable}, isIngredient=${currentIngredient}`,
        expected: `isSellable=${exp.isSellable}, isIngredient=${exp.isIngredient}`,
      });
    }
  }

  console.log(`\nTotal products: ${rows.rows.length}`);
  console.log(`Mismatches: ${mismatches.length}`);

  if (mismatches.length > 0) {
    console.log('\n--- Mismatch detail (first 20) ---');
    for (const m of mismatches.slice(0, 20)) {
      console.log(`  [${m.itemType}] ${m.name}  ${m.current}  ->  ${m.expected}`);
    }

    if (APPLY) {
      console.log('\n📝 Applying reconciliation...');
      await db.execute(sql`
        UPDATE products
        SET
          is_sellable = CASE item_type
            WHEN 'raw_material' THEN false
            WHEN 'wip' THEN false
            ELSE true
          END,
          is_ingredient = CASE item_type
            WHEN 'raw_material' THEN true
            ELSE false
          END,
          updated_at = now()
        WHERE deleted_at IS NULL;
      `);
      console.log(`✅ Reconciliated ${mismatches.length} products.`);
    }
  } else {
    console.log('✅ No mismatches detected.');
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ Reconcile failed:', e);
  process.exit(1);
});
