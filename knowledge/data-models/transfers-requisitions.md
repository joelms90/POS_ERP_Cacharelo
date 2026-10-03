---
type: "table"
title: "Transfers, Requisitions & Purchase Orders Tables"
description: "Relational schema definitions for stock transfers, transfer items, branch requisitions, and supplier purchase orders."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "schema"
  - "transfers"
  - "requisitions"
  - "purchasing"
  - "tables"
sources:
  - "apps/sync_api/src/database/schema.ts"
---

# Transfers, Requisitions & Purchase Orders Tables

These tables manage the replenishment pipeline connecting branch demand to central warehouses and external suppliers.

---

## 1. `branch_requisitions`

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO (PK) | Requisition identifier. |
| `business_id` | `uuid` | NO (FK) | Reference to `businesses.id`. |
| `from_branch_id`| `uuid` | NO (FK) | Requesting branch (`branches.id`). |
| `to_warehouse_id`| `uuid`| NO (FK) | Fulfilling warehouse (`warehouses.id`). |
| `status` | `varchar(20)` | NO | `pending_approval`, `approved`, `standby`, `rejected`, `completed`. |
| `notes` | `text` | YES | Operator explanation or urgency note. |
| `created_by` | `uuid` | NO (FK) | Requesting operator (`users.id`). |

---

## 2. `stock_transfers`

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO (PK) | Transfer identifier. |
| `business_id` | `uuid` | NO (FK) | Reference to `businesses.id`. |
| `from_warehouse_id`| `uuid`| YES (FK) | Shipped from warehouse. |
| `from_branch_id` | `uuid`| YES (FK) | Shipped from branch. |
| `to_warehouse_id` | `uuid`| YES (FK) | Destination warehouse. |
| `to_branch_id` | `uuid`| YES (FK) | Destination branch. |
| `status` | `varchar(20)` | NO | `pending`, `in_transit`, `completed`, `cancelled`. |
| `received_by` | `uuid` | YES (FK) | Receiving branch operator (`users.id`). |
| `received_at` | `timestamptz` | YES | Exact timestamp of reception. |
| `receipt_note` | `text` | YES | Mandatory discrepancy explanation if quantities mismatch. |

---

## 3. `stock_transfer_items`

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO (PK) | Item line identifier. |
| `transfer_id` | `uuid` | NO (FK) | Reference to `stock_transfers.id`. |
| `product_id` | `uuid` | NO (FK) | Reference to `products.id`. |
| `quantity` | `decimal(12,3)`| NO | Shipped quantity. |
| `quantity_received`| `decimal(12,3)`| YES | Actual physical quantity counted at destination. |
| `unit_cost` | `decimal(10,2)`| NO | Valuation unit cost. |
| `total_cost` | `decimal(10,2)`| NO | Valuation total cost. |

---

## 4. `purchase_orders`

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO (PK) | Purchase order identifier. |
| `po_number` | `varchar(50)` | NO (Unique)| Human-readable document folio (e.g. `PO-2026-001`). |
| `provider_id` | `uuid` | NO (FK) | Target supplier (`providers.id`). |
| `status` | `varchar(20)` | NO | `draft`, `sent`, `partially_received`, `received`, `cancelled`. |
| `total` | `decimal(10,2)`| NO | Agreed purchase order total. |
| `created_by` | `uuid` | NO (FK) | Buyer user who issued the order. |
