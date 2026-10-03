---
type: "table"
title: "Stock Ledger & Inventory Tables"
description: "Detailed schema definition, indices, and event types for stock_ledger and related inventory tables."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "schema"
  - "database"
  - "stock-ledger"
  - "tables"
sources:
  - "apps/sync_api/src/database/schema.ts"
---

# Stock Ledger & Inventory Tables

The inventory system relies on `stock_ledger` as the append-only source of truth, complemented by materialized `stock_levels` and threshold configurations.

---

## 1. `stock_ledger`

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO (PK) | Unique movement identifier. |
| `business_id` | `uuid` | NO (FK) | Reference to `businesses.id`. |
| `product_id` | `uuid` | NO (FK) | Reference to `products.id`. |
| `branch_id` | `uuid` | YES (FK) | Physical branch context (if branch movement). |
| `warehouse_id` | `uuid` | YES (FK) | Physical or virtual warehouse context. |
| `quantity_delta` | `decimal(12,3)`| NO | Positive (stock in) or negative (stock out). |
| `event_type` | `varchar(30)` | NO | `receipt`, `sale`, `production_input`, `production_output`, `transfer_out`, `transfer_in`, `adjustment`, `initial`. |
| `unit_cost` | `decimal(10,2)`| YES | Unit cost at time of movement. |
| `reference_type` | `varchar(30)` | YES | Associated entity type (`order`, `receipt`, `transfer`, `op`). |
| `reference_id` | `uuid` | YES | Foreign ID of the associated operational document. |
| `document_number`| `varchar(50)` | YES | Human-readable folio, invoice number, or order SKU. |
| `lot_number` | `varchar(100)`| YES | Lot or batch code. |
| `expiration_date`| `timestamptz` | YES | Lot expiration date. |
| `created_at` | `timestamptz` | NO | Server insertion timestamp (`defaultNow()`). |
| `created_by_id` | `uuid` | YES (FK) | Operator who executed the movement (`users.id`). |

### Indices
- `idx_stock_ledger_bus_prod`: `(business_id, product_id)`
- `idx_stock_ledger_branch`: `(branch_id)`
- `idx_stock_ledger_warehouse`: `(warehouse_id)`
- `idx_stock_ledger_created_at`: `(created_at)`

---

## 2. `stock_levels` (Materialized Read Model)

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO (PK) | Row identifier. |
| `product_id` | `uuid` | NO (FK) | Reference to `products.id`. |
| `branch_id` | `uuid` | YES (FK) | Branch location (exclusive with warehouse). |
| `warehouse_id` | `uuid` | YES (FK) | Warehouse location. |
| `quantity` | `decimal(12,3)`| NO | Current on-hand stock balance. |
| `updated_at` | `timestamptz` | NO | Last update timestamp. |

---

## 3. `inventory_alerts`

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO (PK) | Alert identifier. |
| `business_id` | `uuid` | NO (FK) | Reference to `businesses.id`. |
| `product_id` | `uuid` | NO (FK) | Reference to `products.id`. |
| `branch_id` | `uuid` | YES (FK) | NULL for global purchase alert; branch ID for requisition alert. |
| `alert_type` | `varchar(20)` | NO | `low_stock` or `out_of_stock`. |
| `threshold` | `decimal(12,3)`| NO | Trigger threshold level. |
| `current_qty` | `decimal(12,3)`| NO | Quantity on hand when alert fired. |
| `status` | `varchar(20)` | NO | `active`, `acknowledged`, `resolved`. |
| `acknowledged_by`| `uuid` | YES (FK) | Operator who reviewed the alert. |
