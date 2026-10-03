---
type: "workflow"
title: "Order, Kitchen Routing & Billing Workflow"
description: "End-to-end dining operational workflow from floor order taking, KDS ticket dispatch, preparation, and cashier settlement."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "workflow"
  - "orders"
  - "pos"
  - "kitchen"
  - "cashier"
  - "billing"
sources:
  - "specs/003-waiter-cashier-screens/spec.md"
  - "specs/005-waiter-billing-flow/spec.md"
  - "apps/pos_flutter/lib/ui/order/"
---

# Order, Kitchen Routing & Billing Workflow

This workflow guides the end-to-end lifecycle of a dine-in restaurant order, connecting the waiter tablet, kitchen display system (KDS), and cashier register.

---

## 1. Table Opening & Ordering

1. **Table Selection**: Waiter taps an available table (e.g. "Mesa 4") on the floor plan map. Table state transitions to `occupied`.
2. **Item Entry**: Waiter searches or browses catalog categories, adding items to specific guests (`assigned_guest`).
3. **Dispatch to Kitchen**:
   - Waiter taps **Enviar a Cocina**.
   - Items are marked `is_sent = true`.
   - The backend applies KDS routing rules (`BR-KDS-001` & `BR-KDS-002`), emitting station tickets (`station='cocina'` or `station='barra'`).
   - Thermal printers print hardcopy order slips at physical preparation stations.

---

## 2. Kitchen & Bar Preparation

1. **New Ticket Arrival**: Cook or bartender sees the new ticket flash on the KDS tablet screen (`status = 'pending'`).
2. **Work in Progress**: Kitchen staff taps the ticket to acknowledge (`status = 'preparing'`).
3. **Ready Notification**: When food is plated, cook marks the ticket as `ready`. Waiter tablet displays a readiness notification.
4. **Service**: Runner delivers plates to table and marks the ticket as `served`.

---

## 3. Account Closing & Cashier Settlement

1. **Request Pre-Bill (Cuenta)**: Waiter taps **Pedir Cuenta**. Table state moves to `billing`. A pre-check summary slip prints for the customer.
2. **Cashier Payment Processing**:
   - Cashier opens the table on the cashier terminal.
   - Selects payment method: Cash, Credit/Debit Card, or Mixed.
   - Enters received amounts; system calculates change.
3. **Fiscal Ticket Issuance**:
   - System registers row in `payments`.
   - Order transitions to `state = 'closed'`.
   - Thermal receipt printer emits the final fiscal customer ticket with business tax information (`ticket_fiscal_configurations`).
4. **Table Reset**: Table transitions to `cleaning` or returns immediately to `free`.
