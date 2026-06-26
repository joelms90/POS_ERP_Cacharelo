# Modules: POS Order Workflow & Shifts

This document details the core workflow modules responsible for sales, kitchen order tracking, and cash reconciliation.

---

## 1. Orders Module

### Purpose
Manages the lifecycle of table orders and ticket details from dining room service to payment checkout.

### Responsibilities
*   Tracks table states (`free`, `occupied`, `billing`, `cleaning`).
*   Aggregates items and calculates subtotals, discounts, and taxes.

### Business Rules
*   Every order must be linked to a `table_id`, `waiter_id`, and `branch_id`.
*   Active items must be flagged as `is_sent = true` once dispatched to the kitchen.
*   Once paid/checkout, the order state becomes `closed`.

### Endpoints
*   `POST /orders` (Create active order)
*   `POST /orders/:id/items` (Add items to order)
*   `POST /orders/:id/billing` (Initiate pre-cuenta checkout request)

### Database Tables
*   `orders` (Order UUID, table ID, branch ID, waiter ID, state, subtotal, discount, tax, total, version)
*   `order_items` (Item UUID, order ID, product ID, quantity, price, assigned_guest, is_sent, notes)
*   `order_item_modifiers` (Links active modifier IDs to order items)

---

## 2. Kitchen Tickets (KDS) Module

### Purpose
Routes ordered items to the correct preparation station (Cocina, Barra) and monitors preparation times.

### Responsibilities
*   Updates ticket states (`pending`, `preparing`, `ready`, `served`).
*   Tracks prep times to issue alerts for orders taking too long.

### Business Rules
*   Items belong to specific stations based on category (e.g. category 'Bebidas' goes to 'Barra', 'Platillos' goes to 'Cocina').
*   When a ticket state becomes `ready`, a local notification is dispatched to the waiter.

### Database Tables
*   `kitchen_tickets` (Ticket UUID, order ID reference, status, station, created_at, started_at, ready_at)

---

## 3. Payments Module

### Purpose
Logs all transactions, splits bills, and processes payments (Cash, Card).

### Business Rules
*   Supports split billing (by seat/person, or equal shares).
*   For card payments, requires card brand and terminal reference details.

### Database Tables
*   `payments` (Payment UUID, order ID, amount, payment_method, reference_code, timestamp)

---

## 4. Cash Registers Module (Shifts)

### Purpose
Controls cash drawer shifts, opening floats, and cash deposits/withdrawals.

### Business Rules
*   A shift must be opened with an explicit cash float amount (`initial_float`).
*   During active shifts, cashiers log cash drops (cash-in) and withdrawals (cash-out).
*   Closing the shift (`corte_z`) calculates starting cash, cash sales, drops, and expected balance, locking the register.

### Database Tables
*   `cash_shifts` (Shift UUID, cashier ID, branch ID, initial_float, cash_drawer_amount, opened_at, closed_at, status)
*   `cash_transactions` (Transaction UUID, shift ID, type [cash-in, cash-out], amount, reason, timestamp)
