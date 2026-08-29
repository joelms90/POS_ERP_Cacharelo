# Pre-Deployment Checklist

> Read this **before every deployment** (backend, admin, or POS). It lists migrations,
> one-time data reconciliations, and rebuild reminders that must not be skipped.

**Last updated**: 2026-08-28

---

## 1. Database migrations (backend) — REQUIRED

Run the idempotent migration script against production **before** deploying the new backend.

```bash
# Opens Cloud SQL proxy + runs scripts/idempotent-deploy-migrations.ts
make backend-migrate
```

This idempotently creates/alters everything below (safe to run multiple times):

| Migration | Table / column |
|-----------|----------------|
| `stock_ledger` | immutable inventory ledger (source of truth) |
| `products.item_type`, `production_strategy`, `uom` | product inventory model |
| `branch_stock_thresholds` | per-branch min/max overrides |
| `inventory_alerts` + `branch_id` nullable + global unique index | global vs branch alerts |
| `business_inventory_settings` | auto-requisition / default warehouse |
| `recipes.waste_percent` | BOM waste % |
| `warehouses.location_type` | `'warehouse' | 'transit'` |
| `branch_products` | per-branch sellable catalog |
| `production_runs` | `destination_warehouse_id`, `status`, `actual_quantity_produced`, `started_at` (OP lifecycle) |

> ⚠️ Note: the full Drizzle journal runner (`npm run migrate` / app-boot `runMigrations`) can
> fail on pre-existing manually-created objects (e.g. `admin_business_access`). Prefer
> `make backend-migrate` (idempotent script) for production.

---

## 2. One-time data reconciliations — REQUIRED ONCE

Run these against production **after** the migrations (they are idempotent, dry-run by default).

### 2.1 Backfill the stock ledger

```bash
# via db-proxy, then:
cd apps/sync_api
DATABASE_URL='postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db' \
  npx tsx scripts/backfill-stock-ledger.ts        # dry-run first
# ...review output, then:
DATABASE_URL='...' npx tsx scripts/backfill-stock-ledger.ts --apply
```

Copies legacy `inventory_movements` into `stock_ledger` and writes reconciling
`adjustment` rows so `SUM(stock_ledger.quantity_delta) == stock_levels.quantity` (zero drift).

### 2.2 Reconcile product flags with `item_type`

```bash
cd apps/sync_api
DATABASE_URL='...' npx tsx scripts/reconcile-product-item-type.ts        # dry-run
DATABASE_URL='...' npx tsx scripts/reconcile-product-item-type.ts --apply
```

Recomputes `products.is_sellable` / `is_ingredient` from `item_type`:
`raw_material -> (ingredient, not sellable)`, `wip -> (not sellable)`,
`finished_good/service -> (sellable)`.

> ⚠️ After this, insumos are **no longer globally sellable**. Re-enable them per-branch
> via **Catálogo por Sucursal** if a branch should sell them (e.g. retail).
> Also review products that sound like finished goods but are `raw_material`
> (historically `is_ingredient` was set from `providerId` in the old import).

### 2.3 Stock model change: sales now deduct from the sucursal (per-sucursal)

POS sales decrement the **selling sucursal's** stock (and its recipe/backflush
ingredients), no longer the primary warehouse. The intended flow is:

```
Proveedor → Recepción → Bodega (bulk)
                         ↓ Traspaso (ship → transit → receive)
                        Sucursal  ← POS deducts HERE
```

**Migration actions after this change:**

1. **Review legacy warehouse stock** — historical sales drained the warehouse, so many
   products have negative or stale warehouse balances. Do a physical count and use
   *Ajuste de stock* (`adjustStock`) to correct the warehouse to reality.
2. **Stock the sucursales** — create Traspasos (Bodega → Sucursal) for the products each
   branch sells, otherwise sales will drive branch stock negative.
3. **Per-branch thresholds** — set `branch_stock_thresholds` so the Panel's "Requisición
   sugerida" alerts fire when a sucursal is low.

---

## 3. Rebuild & deploy each app

| App | Command | Notes |
|-----|---------|-------|
| Backend | `make backend-deploy-fast` | after steps 1–2 |
| Admin | `make admin-deploy` | new pages: Panel de Inventario, Catálogo por Sucursal |
| POS Web | `make flutter-web-deploy` | menu now branch-aware |
| POS Full | `make flutter-portal-deploy` | bump `pubspec.yaml` version first |

### Flutter version bump (POS)

A pre-commit hook auto-bumps `pubspec.yaml`, but verify the version before a release:

1. Increment `version:` in `apps/pos_flutter/pubspec.yaml` (e.g. `1.0.1+5` → `1.0.2+6`).
2. Run `make flutter-portal-deploy`.

The POS now passes `terminalBranchId` to `GET /products?branchId=…`, so **each terminal
shows its own menu** based on the per-branch catalog.

---

## 4. Post-deploy verification

- `curl -I https://cacharelo-central.web.app` → 200
- `curl https://pos-sync-api-232144991863.us-central1.run.app/api/health` → 200
- Confirm new tables exist in prod: `stock_ledger`, `branch_products`, `inventory_alerts`, `branch_stock_thresholds`.
- Confirm `SUM(stock_ledger) == stock_levels` (re-run backfill dry-run → "No drift detected").
- Open Panel de Inventario and Catálogo por Sucursal in the admin dashboard.
