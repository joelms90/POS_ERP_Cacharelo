# Inventory Rules

## BR-INV-001 — Every physical stock change is ledger-backed

- **Statement:** A physical inventory movement must append an immutable
  `stock_ledger` entry through `LedgerService.applyMovement()`.
- **Owner:** Inventory operations.
- **Authority:** `apps/sync_api/src/modules/inventory/ledger.service.ts`.
- **Consequence:** Application business logic must not write `stock_levels` or
  `inventory_movements` directly.
- **Verification:** Unit/integration tests for each sale, receipt, transfer,
  production, adjustment, or opening-stock pathway assert its ledger movement.

## BR-INV-002 — Every ledger movement has a location

- **Statement:** A ledger movement must identify at least one stock location:
  a warehouse or a branch.
- **Owner:** Inventory operations.
- **Authority:** `LedgerService.applyMovement()` rejects movements with neither
  location.
- **Verification:** Attempting to apply a movement without both identifiers
  must fail.

## BR-INV-003 — Branch thresholds override global thresholds

- **Statement:** For a product at a branch, a configured branch minimum/maximum
  threshold takes precedence over the product’s global threshold; otherwise the
  global threshold is used.
- **Owner:** Inventory administration.
- **Authority:** Inventory alert and threshold services.
- **Verification:** See the acceptance scenarios in
  `specs/012-intelligent-inventory-control/spec.md`.

## BR-INV-004 — Low-stock alerts are per product and location scope

- **Statement:** An active alert represents one affected product in its global
  or branch scope; subsequent evaluations update or resolve that alert rather
  than creating uncontrolled duplicates.
- **Owner:** Inventory operations.
- **Authority:** `apps/sync_api/src/modules/inventory/alerts/alerts.service.ts`.
- **Verification:** Alert-engine acceptance scenarios in feature 012.
