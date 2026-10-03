---
type: "rule"
title: "Stock Transfers & Inbound Receipts Rules"
description: "Authoritative business rules for inter-warehouse and branch stock transfers, transit locations, and receipt discrepancy tracking."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "transfers"
  - "receipts"
  - "transit"
  - "inventory"
  - "business-rules"
sources:
  - "apps/sync_api/src/modules/inventory/transfers/"
  - "apps/sync_api/src/modules/inventory/ledger.service.ts"
  - "apps/sync_api/src/database/schema.ts"
---

# Stock Transfers & Inbound Receipts Rules

These rules dictate how physical inventory is transferred between warehouses and branch storage locations.

---

## BR-TRN-001 — Transfers utilize a virtual transit location

- **Statement**: An inter-location stock transfer cannot directly move stock from origin to destination in a single step. When dispatched, stock moves from origin to a virtual `En Tránsito` warehouse (`location_type = 'transit'`). Only upon physical receipt at the destination branch/warehouse does stock move from `En Tránsito` into destination inventory.
- **Owner**: Supply Chain & Inventory Control.
- **Authority**: `LedgerService` and `StockTransfersService`.
- **Consequence**: Stock in transit is not considered available for immediate sale at the destination, nor does it remain in origin available balance. Total business stock remains conserved.
- **Verification**: Ledger balance tests verifying intermediate balance in transit warehouse during `in_transit` transfer status.

---

## BR-TRN-002 — Receiving requires actual quantities and discrepancy notes

- **Statement**: When receiving an inbound transfer (`stock_transfers`), the receiving operator must specify the actual `quantity_received` for each item. If the received quantity does not equal the shipped quantity, an auditable `receipt_note` is mandatory.
- **Owner**: Audit & Branch Management.
- **Authority**: `StockTransfersService.receiveTransfer()`.
- **Consequence**: Broken, missing, or stolen goods are identified at the moment of handover. Stock ledger is credited only with what was physically verified.
- **Verification**: Inbound receipt tests verifying that mismatched quantities without a `receiptNote` fail with `422 Unprocessable Entity`.

---

## BR-TRN-003 — Inbound reception updates ledger synchronously

- **Statement**: Confirming an inbound transfer creates synchronous `stock_ledger` movements: negative delta for the virtual transit warehouse, and positive delta for the receiving destination branch/warehouse.
- **Owner**: Inventory Operations.
- **Authority**: `LedgerService.applyMovement()`.
- **Consequence**: Discrepancies between shipped and received quantities leave the residual difference in the transit audit ledger for administrative reconciliation.
- **Verification**: Database transaction tests ensuring atomic movement execution.
