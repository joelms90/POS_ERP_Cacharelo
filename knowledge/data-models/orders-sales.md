---
type: "table"
title: "Orders, Sales & KDS Tables"
description: "Relational schema definitions for orders, order items, kitchen tickets, cashier shifts, and payments."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "schema"
  - "orders"
  - "sales"
  - "kds"
  - "tables"
sources:
  - "apps/sync_api/src/database/schema.ts"
---

# Orders, Sales & KDS Tables

These tables model restaurant dining room operations, order state lifecycles, kitchen dispatching, and cashier shift reconciliation.

---

## 1. `orders`

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO (PK) | Order identifier. |
| `client_uuid` | `varchar(120)` | YES | Client-side idempotency UUID for offline creations. |
| `branch_id` | `uuid` | NO (FK) | Reference to `branches.id`. |
| `table_id` | `uuid` | NO (FK) | Reference to `branch_tables.id`. |
| `waiter_id` | `uuid` | NO (FK) | User who opened/owns the order (`users.id`). |
| `state` | `varchar(20)` | NO | `open`, `billing`, `closed`, `cancelled`. |
| `subtotal` | `decimal(10,2)`| NO | Item sum before discounts/taxes. |
| `discount` | `decimal(10,2)`| NO | Applied discount amount. |
| `tax` | `decimal(10,2)`| NO | Total tax calculated. |
| `total` | `decimal(10,2)`| NO | Final payable total. |
| `cancellation_reason` | `text` | YES | Mandatory audit reason if cancelled. |
| `cancelled_by` | `uuid` | YES (FK) | Operator who cancelled the order. |
| `cancelled_at` | `timestamptz` | YES | Timestamp of cancellation. |

---

## 2. `order_items`

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO (PK) | Item row identifier. |
| `order_id` | `uuid` | NO (FK) | Reference to `orders.id`. |
| `product_id` | `uuid` | NO (FK) | Reference to `products.id`. |
| `quantity` | `integer` | NO | Number of units ordered. |
| `price` | `decimal(10,2)`| NO | Unit price applied to this line. |
| `assigned_guest` | `integer` | NO | Guest seat number (for split billing). |
| `is_sent` | `boolean` | NO | `true` once dispatched to kitchen/bar KDS. |
| `notes` | `text` | YES | Kitchen preparation notes (e.g. "sin cebolla"). |

---

## 3. `kitchen_tickets`

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO (PK) | Ticket identifier. |
| `order_id` | `uuid` | NO (FK) | Reference to `orders.id`. |
| `status` | `varchar(20)` | NO | `pending`, `preparing`, `ready`, `served`. |
| `station` | `varchar(50)` | NO | Target station: `cocina` or `barra`. |
| `created_at` | `timestamptz` | NO | Ticket emission time. |
| `started_at` | `timestamptz` | YES | Cook began preparing. |
| `ready_at` | `timestamptz` | YES | Preparation finished. |
| `served_at` | `timestamptz` | YES | Dish delivered to table. |

---

## 4. `cash_shifts` (Cortes de Caja)

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO (PK) | Shift identifier. |
| `cashier_id` | `uuid` | NO (FK) | Cashier user who opened the shift. |
| `branch_id` | `uuid` | NO (FK) | Branch context. |
| `initial_float` | `decimal(10,2)`| NO | Opening cash float amount. |
| `cash_drawer_amount` | `decimal(10,2)`| NO | Calculated live cash amount. |
| `status` | `varchar(20)` | NO | `open` or `closed`. |
| `denomination_counts`| `jsonb` | YES | Counted cash breakdown (bills/coins) at Corte Z. |
| `close_snapshot` | `jsonb` | YES | Financial audit totals at closing. |
