---
type: "rule"
title: "Inventory & Stock Ledger Business Rules"
description: "Authoritative business rules governing physical stock movements, ledger immutability, location scopes, and threshold overrides."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "inventory"
  - "stock-ledger"
  - "business-rules"
  - "thresholds"
sources:
  - "apps/sync_api/src/modules/inventory/ledger.service.ts"
  - "apps/sync_api/src/modules/inventory/alerts/alerts.service.ts"
  - "apps/sync_api/src/database/schema.ts"
---

# Inventory & Stock Ledger Business Rules

These rules enforce strict auditability, multi-location accuracy, and integrity across the physical stock inventory of all branches and warehouses.

---

## BR-INV-001 — Every physical stock change is ledger-backed

- **Statement**: Any physical inventory movement must append an immutable `stock_ledger` entry via `LedgerService.applyMovement()`.
- **Owner**: Inventory Operations.
- **Authority**: `apps/sync_api/src/modules/inventory/ledger.service.ts`.
- **Consequence**: Application business logic, controllers, and scripts must never write directly to `stock_levels` or `inventory_movements`. The `stock_levels` table is purely a materialized read model updated synchronously within the ledger transaction.
- **Verification**: Integration tests asserting that sales, receipts, production completions, transfer shipments/receipts, and inventory adjustments always create a corresponding `stock_ledger` row with non-null `quantity_delta`.

---

## BR-INV-002 — Every ledger movement has a defined location

- **Statement**: A ledger movement must specify exactly one physical location context: either a warehouse (`warehouse_id`) or a branch (`branch_id`).
- **Owner**: Inventory Operations.
- **Authority**: `LedgerService.applyMovement()`.
- **Consequence**: Movements specifying neither location or attempting to specify both simultaneously will be rejected with an `UnprocessableEntityException`.
- **Verification**: Unit tests in `ledger.service.spec.ts` testing location validation.

---

## BR-INV-003 — Branch thresholds override global thresholds

- **Statement**: For a given product at a branch, a configured branch threshold in `branch_stock_thresholds` (`min_stock` / `max_stock`) takes complete precedence over the product's global threshold in `products.min_stock` / `products.max_stock`. If no branch threshold is set (or values are 0), the global threshold is used as fallback.
- **Owner**: Inventory Administration.
- **Authority**: `apps/sync_api/src/modules/inventory/alerts/alerts.service.ts`.
- **Consequence**: Stock alert calculations and automated requisition quantities evaluate branch-level thresholds first before falling back to product global defaults.
- **Verification**: Threshold resolution acceptance tests in `alerts.service.spec.ts`.

---

## BR-INV-004 — Low-stock alerts are unique per product and location scope

- **Statement**: An active inventory alert represents one affected product within a specific scope (either a specific `branch_id` or global scope where `branch_id IS NULL`). Subsequent alert evaluations must update or resolve existing alerts rather than generating duplicate active rows.
- **Owner**: Inventory Operations.
- **Authority**: `apps/sync_api/src/database/schema.ts` (`unq_ia_product_branch_active` & `unq_ia_product_global_active`) and `AlertsService`.
- **Consequence**: Alert database tables enforce unique partial indexes on active/acknowledged alerts.
- **Verification**: Unique constraint verification in Postgres and automated alert engine deduplication tests.
