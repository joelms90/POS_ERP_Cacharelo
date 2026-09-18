# 🤝 Session Handoff Document

- **Project Name**: POS-ERP Monorepo (`joelms90/POS_ERP_Cacharelo`)
- **Date & Time**: 2026-09-18 (landing menu publish)
- **Branch**: `011-purchase-orders-requisitions`
- **Last Agent**: Codex

---

## 1. Executive Summary

The September 2026 cafeteria menu was published at `https://www.cacharelo.com/menus/menu-cafeteria.pdf`. The landing Firebase configuration now explicitly targets the primary `fresh-sensor-497515-d3` Hosting site; the custom-domain PDF download was checksum-verified after deployment.

This session revamped the **inventory system** from a mutable-counter model into an **immutable, ledger-driven model** and unified the operational UI (Órdenes de Compra, Requisiciones, Traspasos, Recepción, Panel de Inventario, Catálogo por Sucursal). Highlights:

1. **Ledger as source of truth** — added `stock_ledger` (+ `item_type`/`production_strategy`/`uom` on `products`) and a `LedgerService` that is the single write choke point. Every stock write now appends a ledger row and updates `stock_levels` as a read model.
2. **Intelligent inventory control** — `branch_stock_thresholds`, `inventory_alerts` (global vs branch), `business_inventory_settings`, and an idempotent alert engine. The "Panel de Inventario" distinguishes *Compra sugerida* (global low → OC), *Requisición sugerida* (branch low + transferable stock → transfer), and *Producción sugerida* (finished good → Ensamble).
3. **Per-sucursal stock** — POS sales now deduct the **selling branch's** stock (not the warehouse); warehouse holds bulk until transferred.
4. **Per-sucursal catalog** — `branch_products` table + "Catálogo por Sucursal" page (per-product sellable toggle, min/max thresholds, copy catalog, live branch stock).
5. **Unified UX** — OC, Requisiciones, Traspasos and Recepción now share a list + toggleable side-form pattern; Traspasos got a full lifecycle (Pendiente → En Tránsito → Recibido) with ship/receive actions and a "Falta / Generar OC / Producir / Ajustar a disponible" resolution flow.

---

## 2. Key Changes & File Map

### A. Backend (`apps/sync_api`)

- `src/database/schema.ts` — added `stockLedger`, `branchStockThresholds`, `inventoryAlerts` (nullable `branchId`), `businessInventorySettings`, `branchProducts`; `products` gains `itemType`/`productionStrategy`/`uom`; `recipes.wastePercent`; `warehouses.locationType`.
- `src/database/migrate.ts` + `scripts/idempotent-deploy-migrations.ts` — idempotent DDL for all of the above (kept in sync for prod).
- `src/modules/inventory/ledger.service.ts` — `LedgerService.applyMovement` (append ledger + update read model in one tx).
- `src/modules/inventory/inventory.service.ts` — receipt/production/transfer/adjust/PO-reception now route through the ledger; `shipTransfer` (with `adjustToAvailable`), `receiveTransfer`, `getTransfer` (items + origin availability), `getTransfers` (itemCount).
- `src/modules/inventory/alerts/alerts.service.ts` — alert engine (global vs branch), `generatePurchaseOrders` (bulk, grouped by provider), `generatePurchaseOrdersByProducts`, `runAutoPoEngine` (fixed "1 OC for 1 product" bug).
- `src/modules/inventory/thresholds/thresholds.service.ts` — per-branch min/max.
- `src/modules/recipes/` — `wastePercent` + BOM validation (parent = finished_good/wip, component ≠ service, no self-ref).
- `src/modules/orders/repositories/orders.repository.ts` — sale deduction targets the **branch**, not the warehouse.
- `src/modules/catalog/branch-catalog.service.ts` + `controller` — per-branch catalog (list/upsert/delete/copy); `products.service` accepts `branchId` to override `isSellable`.
- `scripts/backfill-stock-ledger.ts`, `scripts/reconcile-product-item-type.ts` — one-time backfills (idempotent, dry-run + `--apply`).

### B. Admin Dashboard (`apps/business_control_tauri`)

- `src/pages/InventoryDashboardPage.tsx` — Panel de Inventario (summary cards, alerts with type-aware actions, multi-select bulk OC, "Producir" → production modal).
- `src/pages/BranchCatalogPage.tsx` — Catálogo por Sucursal (sellable toggle, min/max inputs, copy catalog, branch stock).
- `src/pages/ProductionOrderModal.tsx` — Ensamble modal with inline recipe builder + "Generar OC de faltantes".
- `src/pages/PurchaseOrdersPage.tsx`, `RequisitionsPage.tsx`, `TransfersPage.tsx`, `ReceiptsPage.tsx` — unified list + side-form layout; Traspasos full lifecycle + reports modal.
- `src/components/molecules/ToastNotification.tsx` — z-index `z-[100]` so toasts show above modals.
- `src/services/api.ts` — error handling prefers NestJS `message` over `error`; new endpoints; `getProducts` accepts `branchId`.
- `src/App.tsx` — persists selected business in localStorage.
- `e2e/` — `product-create`, `purchase-order-inventory-flow`, `panel-inventory-bulk-oc`, `panel-inventory-oc-alert-resolution`, `branch-out-of-stock-requisition`, `branch-catalog` specs.

### C. POS (`apps/pos_flutter`)

- `lib/ui/common/app_state.dart` — `fetchMenuDynamic` passes `terminalBranchId` so each terminal shows its own menu.

---

## 3. Current Status

| Component | Status | Notes |
| :--- | :--- | :--- |
| Backend (`apps/sync_api`) | ✅ Builds | `npm run build` green; new tables/columns migrated locally |
| Admin (`apps/business_control_tauri`) | ✅ Builds | `npm run build` green; e2e navigation + feature specs pass |
| POS (`apps/pos_flutter`) | ⚠️ Not rebuilt | branchId change needs `flutter analyze` + rebuild |
| Landing menu (`apps/landing_page`) | ✅ Published | September 2026 PDF live at `/menus/menu-cafeteria.pdf` |
| Migrations (prod) | ⚠️ Not applied | see `docs/pre-deployment-checklist.md` |
| Data backfills (prod) | ⚠️ Not applied | `backfill-stock-ledger.ts` + `reconcile-product-item-type.ts` |

---

## 4. Next Steps (for the next agent)

1. **Pre-deploy**: follow `docs/pre-deployment-checklist.md` — run `make backend-migrate`, then the two backfill scripts, then deploy backend + admin + POS.
2. **POS verify/rebuild**: `cd apps/pos_flutter && flutter analyze`, bump version, `make flutter-portal-deploy`.
3. **Verify per-sucursal model**: correct legacy warehouse stock (adjust), stock branches via Traspasos, set per-branch thresholds.
4. **Reconciled flag review**: `reconcile-product-item-type.ts` reclassified 3 products (`Empanada Queso`, `Empanada Jamon`, `Coca Cola`) as `raw_material`; confirm if they should be `finished_good`.
5. **Optional follow-ups**:
   - Surface `skipped` product **names** (not just count) in "Generar OC de faltantes".
   - Convert remaining `alert()` error handlers (Assembly, Providers) to toast with `err.message`.
   - Add stock availability check to the "Nuevo Traspaso" form (before submit).

---

## 5. Helpful Commands

```bash
# Backend
cd apps/sync_api && npm run build && npm test

# Admin
cd apps/business_control_tauri && pnpm build && npx playwright test

# POS
cd apps/pos_flutter && flutter analyze

# Migrations / backfills (prod)
make backend-migrate
cd apps/sync_api && npx tsx scripts/backfill-stock-ledger.ts --apply
cd apps/sync_api && npx tsx scripts/reconcile-product-item-type.ts --apply
```

---

*Handoff document updated successfully.*
