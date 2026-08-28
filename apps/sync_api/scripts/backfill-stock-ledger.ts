#!/usr/bin/env tsx
/**
 * Backfill the immutable `stock_ledger` from the legacy `inventory_movements`
 * and reconcile any drift against the `stock_levels` read model.
 *
 * Usage:
 *   npx tsx scripts/backfill-stock-ledger.ts            # dry-run (report only)
 *   npx tsx scripts/backfill-stock-ledger.ts --apply    # actually write rows
 *
 * Idempotent: the copy step refuses to run if stock_ledger already has rows
 * (unless --force). The reconcile step only writes when --apply is passed.
 */

import { db } from '../src/database/connection';
import { sql } from 'drizzle-orm';

const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');

const groupKey = (productId: string, warehouseId: string | null, branchId: string | null) =>
  `${productId}|${warehouseId ?? 'WNULL'}|${branchId ?? 'BNULL'}`;

async function main() {
  console.log(APPLY ? '✍️  Apply mode ON' : '🔍 Dry-run mode (use --apply to write)');
  console.log(`DATABASE_URL: ${(process.env.DATABASE_URL || 'postgres://pos_user:pos_password@localhost:5432/pos_dev').split('@')[1] ?? 'local'}\n`);

  // 1. Count existing ledger rows
  const ledgerCountRes = await db.execute(sql`SELECT count(*)::int AS c FROM stock_ledger`);
  const ledgerCount = Number(ledgerCountRes.rows[0]?.c ?? 0);
  console.log(`stock_ledger rows currently: ${ledgerCount}`);

  // 2. Copy inventory_movements -> stock_ledger (guarded)
  if (ledgerCount === 0) {
    console.log('📥 Copying inventory_movements -> stock_ledger...');
    if (APPLY) {
      await db.execute(sql`
        INSERT INTO stock_ledger (
          id, business_id, product_id, branch_id, warehouse_id,
          quantity_delta, event_type, unit_cost, reference_type, reference_id,
          document_number, notes, lot_number, expiration_date, created_at, created_by_id
        )
        SELECT
          gen_random_uuid(), business_id, product_id, branch_id, warehouse_id,
          quantity, type, NULL, NULL, reference_id,
          document_number, notes, lot_number, expiration_date, created_at, created_by_id
        FROM inventory_movements;
      `);
      console.log('✅ Copied inventory_movements into stock_ledger.');
    } else {
      const c = await db.execute(sql`SELECT count(*)::int AS c FROM inventory_movements`);
      console.log(`   (dry-run) would copy ${Number(c.rows[0]?.c ?? 0)} rows.`);
    }
  } else if (FORCE && APPLY) {
    console.log('⚠️  --force: appending movements again (may duplicate).');
    await db.execute(sql`
      INSERT INTO stock_ledger (
        id, business_id, product_id, branch_id, warehouse_id,
        quantity_delta, event_type, unit_cost, reference_type, reference_id,
        document_number, notes, lot_number, expiration_date, created_at, created_by_id
      )
      SELECT
        gen_random_uuid(), business_id, product_id, branch_id, warehouse_id,
        quantity, type, NULL, NULL, reference_id,
        document_number, notes, lot_number, expiration_date, created_at, created_by_id
      FROM inventory_movements;
    `);
  } else {
    console.log('ℹ️  stock_ledger already has rows; skipping copy (pass --force --apply to re-copy).\n');
  }

  // 3. Reconcile: ledger sum vs stock_levels
  console.log('\n⚖️  Reconciling stock_ledger SUM(quantity_delta) vs stock_levels...');

  const ledgerSums = await db.execute(sql`
    SELECT
      product_id,
      COALESCE(warehouse_id::text, 'WNULL') AS wh,
      COALESCE(branch_id::text, 'BNULL') AS br,
      SUM(quantity_delta)::numeric AS sum_delta
    FROM stock_ledger
    GROUP BY product_id, COALESCE(warehouse_id::text, 'WNULL'), COALESCE(branch_id::text, 'BNULL');
  `);

  const stockLevels = await db.execute(sql`
    SELECT
      product_id,
      COALESCE(warehouse_id::text, 'WNULL') AS wh,
      COALESCE(branch_id::text, 'BNULL') AS br,
      quantity
    FROM stock_levels;
  `);

  const ledgerMap = new Map<string, number>();
  for (const r of ledgerSums.rows) {
    ledgerMap.set(groupKey(r.product_id, r.wh === 'WNULL' ? null : r.wh, r.br === 'BNULL' ? null : r.br), Number(r.sum_delta));
  }

  const driftRows: Array<{
    productId: string;
    warehouseId: string | null;
    branchId: string | null;
    stockQty: number;
    ledgerQty: number;
    diff: number;
    businessId: string | null;
  }> = [];

  // businessId lookup for adjustment rows
  const businessMap = new Map<string, string>();
  const products = await db.execute(sql`SELECT id, business_id FROM products`);
  for (const r of products.rows) {
    businessMap.set(r.id, r.business_id);
  }

  for (const s of stockLevels.rows) {
    const wh = s.wh === 'WNULL' ? null : s.wh;
    const br = s.br === 'BNULL' ? null : s.br;
    const key = groupKey(s.product_id, wh, br);
    const ledgerQty = ledgerMap.get(key) ?? 0;
    const stockQty = Number(s.quantity);
    const diff = stockQty - ledgerQty;
    if (Math.abs(diff) > 1e-9) {
      driftRows.push({
        productId: s.product_id,
        warehouseId: wh,
        branchId: br,
        stockQty,
        ledgerQty,
        diff,
        businessId: businessMap.get(s.product_id) ?? null,
      });
    }
  }

  // Also detect stock_ledger entries with no stock_levels counterpart (shouldn't happen, but report)
  const stockKeys = new Set<string>();
  for (const s of stockLevels.rows) {
    stockKeys.add(groupKey(s.product_id, s.wh === 'WNULL' ? null : s.wh, s.br === 'BNULL' ? null : s.br));
  }
  const orphanLedger = [...ledgerMap.keys()].filter((k) => !stockKeys.has(k));

  console.log(`   stock_levels rows: ${stockLevels.rows.length}`);
  console.log(`   ledger aggregate groups: ${ledgerMap.size}`);
  console.log(`   drift rows (need adjustment): ${driftRows.length}`);
  console.log(`   orphan ledger groups (no stock_levels row): ${orphanLedger.length}`);

  if (driftRows.length > 0) {
    console.log('\n--- Drift detail (first 20) ---');
    for (const d of driftRows.slice(0, 20)) {
      console.log(
        `   product=${d.productId} loc=${d.warehouseId ?? d.branchId} stock=${d.stockQty} ledger=${d.ledgerQty} diff=${d.diff}`,
      );
    }
    if (APPLY) {
      console.log('\n📝 Writing reconciling adjustment rows...');
      for (const d of driftRows) {
        if (!d.businessId) continue;
        await db.execute(sql`
          INSERT INTO stock_ledger (
            id, business_id, product_id, branch_id, warehouse_id,
            quantity_delta, event_type, notes, created_at
          )
          VALUES (
            gen_random_uuid(), ${d.businessId}, ${d.productId}, ${d.branchId}, ${d.warehouseId},
            ${d.diff}, 'adjustment', 'Reconciliación de backfill (ajuste histórico)', now()
          );
        `);
      }
      console.log(`✅ Wrote ${driftRows.length} adjustment rows.`);
    }
  } else {
    console.log('\n✅ No drift detected.');
  }

  if (orphanLedger.length > 0) {
    console.log('\n⚠️  Orphan ledger groups (ledger has stock but no stock_levels row):');
    for (const k of orphanLedger.slice(0, 20)) {
      console.log(`   ${k}`);
    }
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ Backfill failed:', e);
  process.exit(1);
});
