---
type: "workflow"
title: "Stock Replenishment & Transfer Workflow"
description: "End-to-end workflow tracing branch requisitions through warehouse approval, transit shipment, and destination reception."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "workflow"
  - "transfers"
  - "requisitions"
  - "transit"
  - "warehouse"
sources:
  - "INVENTORY_ARCHITECTURE.md"
  - "docs/purchase-order-to-inventory-flow.md"
  - "apps/sync_api/src/modules/inventory/transfers/"
---

# Stock Replenishment & Transfer Workflow

This workflow tracks the lifecycle of an internal branch replenishment request as it transitions through warehouse dispatch and physical reception.

---

## Workflow Flowchart

```text
[Branch Operator]
Creates Requisition (`pending_approval`)
       │
       ▼
[Warehouse Purchasing Operator]
Reviews & Approves Requisition (`approved`)
       │
       ▼
[Warehouse Dispatches Shipment]
Creates `stock_transfers` (`in_transit`)
- Deducts origin warehouse in `stock_ledger`
- Credits virtual `En Tránsito` warehouse in `stock_ledger`
       │
       ▼ [Physical Transport]
       │
       ▼
[Destination Branch Operator]
Verifies physical count in POS **Recibir** tab
- Inputs `quantity_received`
- Adds mandatory `receipt_note` if quantities differ
       │
       ▼
[Reception Confirmed (`completed`)]
- Deducts virtual `En Tránsito` warehouse in `stock_ledger`
- Credits destination branch in `stock_ledger`
```

---

## Detailed Stages

### Stage 1: Branch Request
- Branch stock drops below threshold (`min_stock`).
- Operator (or automated alert engine) creates `branch_requisitions` row.
- Initial state: `pending_approval`.

### Stage 2: Warehouse Fulfillment
- Central warehouse operator reviews pending requisitions in the Admin Dashboard (`RequisitionsPage.tsx`).
- Operator checks warehouse stock availability.
- Operator approves requested quantities (or marks partial quantities in `quantity_approved`).
- System generates a linked `stock_transfers` record in `in_transit` status.
- Origin warehouse stock is immediately deducted; virtual `En Tránsito` stock is credited (`BR-TRN-001`).

### Stage 3: Inbound Receipt & Discrepancy Recording
- Delivery arrives at the branch.
- Branch manager opens the **Recibir** tab on the tablet.
- Operator inspects each line item.
- If physical units are damaged or missing, the operator records the true count and submits an explanatory note (`BR-TRN-002`).
- Upon confirmation:
  - Destination branch stock increases in `stock_levels` and `stock_ledger`.
  - Transit location balance is closed out.
