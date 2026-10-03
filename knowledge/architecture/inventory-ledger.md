---
type: "architecture"
title: "Inventory Stock Ledger Architecture"
description: "Design and guarantees of the immutable, event-driven stock ledger, materialized stock levels, and virtual transit accounting."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "inventory"
  - "stock-ledger"
  - "event-sourcing"
  - "architecture"
sources:
  - "INVENTORY_ARCHITECTURE.md"
  - "apps/sync_api/src/modules/inventory/ledger.service.ts"
  - "apps/sync_api/src/database/schema.ts"
---

# Inventory Stock Ledger Architecture

The POS-ERP inventory system is built on an **immutable append-only ledger pattern**. The total stock on hand for any product at any location is strictly defined as the mathematical sum of all historical quantity deltas.

---

## 1. Single Source of Truth (`stock_ledger`)

All physical movements append an immutable row into `stock_ledger`:

- `quantity_delta`: Signed decimal (+ positive for stock additions, − negative for reductions).
- `event_type`: Categorizes the movement reason:
  - `receipt`: Inbound supplier delivery.
  - `sale`: Point-of-sale customer order fulfillment.
  - `production_input`: Raw material consumption during a production run (BOM).
  - `production_output`: Finished product manufactured from a production run.
  - `transfer_out`: Stock shipped from origin location.
  - `transfer_in`: Stock received at destination location.
  - `adjustment`: Physical stock audit correction or shrinkage write-off.
  - `initial`: Opening stock balance initialization.
- `location`: Exactly one of `branch_id` or `warehouse_id`.

---

## 2. Materialized Cache (`stock_levels`)

To avoid evaluating millions of historical delta sums on every read, a materialized read table `stock_levels` maintains real-time location balances:

- Maintained **strictly within the same database transaction** by `LedgerService.applyMovement()`.
- Direct manual writes to `stock_levels` are strictly forbidden.
- In case of any inconsistency, `stock_levels` can be fully rebuilt by replaying `stock_ledger` sums.

---

## 3. Virtual Transit Warehouse Accounting

Inter-location stock transfers do not jump instantaneously between locations:

1. **Shipment (`in_transit`)**:
   - Origin warehouse/branch is deducted (`quantity_delta = -X`).
   - Virtual `En Tránsito` warehouse (`location_type = 'transit'`) is credited (`quantity_delta = +X`).
2. **Reception (`received`)**:
   - Virtual `En Tránsito` warehouse is deducted (`quantity_delta = -received_qty`).
   - Destination warehouse/branch is credited (`quantity_delta = +received_qty`).
3. **Discrepancy Resolution**:
   - Any difference between shipped and received quantities remains logged in the transit ledger accompanied by an auditable `receipt_note` for reconciliation.
