---
type: "workflow"
title: "Procurement & Purchase Orders Workflow"
description: "Procedure for converting inventory alerts to purchase orders, price comparison, supplier confirmation, and goods reception."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "workflow"
  - "purchasing"
  - "procurement"
  - "suppliers"
  - "stock-ledger"
sources:
  - "docs/purchase-order-to-inventory-flow.md"
  - "apps/sync_api/src/modules/purchase-orders/"
---

# Procurement & Purchase Orders Workflow

This workflow describes how the POS-ERP system detects global supply deficits, generates purchase orders for external vendors, and registers received inventory into warehouse stock.

---

## 1. Inventory Alert Evaluation

- **Scheduled Engine**: Background cron job or manual trigger scans stock balances across all locations.
- **Trigger**: When global stock for a product falls below `products.min_stock`, an `inventory_alerts` record is generated (`alert_type = 'low_stock'`, `branch_id = NULL`).

---

## 2. Supplier Selection & Draft PO Generation

- **Supplier Lookup**: The system queries `supplier_products` for the lowest unit cost (`BR-PO-002`). If no supplier is mapped, the system checks `products.provider_id` (`BR-PO-001`).
- **Target Quantity**: Calculates replenishment quantity required to bring inventory up to `products.max_stock`.
- **Creation**: An automated purchase order is inserted with `status = 'draft'` (`BR-PO-003`).

---

## 3. Review & Supplier Dispatch

- The purchasing manager opens **Órdenes de Compra** in the Admin Dashboard.
- Manager reviews item lines, unit costs, and delivery dates.
- Upon approval, the PO status transitions to `sent` and a formal PDF purchase order is dispatched to the supplier.

---

## 4. Inbound Delivery & Kardex Registration

1. **Physical Reception**: Supplier delivers shipment to the receiving warehouse.
2. **Reception Entry**: Warehouse operator opens `PurchaseOrdersPage.tsx` and records actual delivered quantities.
3. **Ledger Ingestion**:
   - Creates `inventory_receipts` and `inventory_receipt_items` records.
   - Triggers `LedgerService.applyMovement()` with `event_type = 'receipt'`.
   - Increments `stock_ledger` and updates `stock_levels`.
   - Marks the purchase order as `received` (or `partially_received`).
