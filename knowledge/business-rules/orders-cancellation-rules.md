---
type: "rule"
title: "Order Cancellation & Audit Business Rules"
description: "Authoritative business rules for table orders, cancellation reasons, and server-side audit trails."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "orders"
  - "cancellations"
  - "audit"
  - "business-rules"
sources:
  - "apps/sync_api/src/modules/orders/"
  - "apps/sync_api/src/database/schema.ts"
---

# Order Cancellation & Audit Business Rules

These rules govern the cancellation of dine-in/takeout orders and ensure full compliance and fraud prevention.

---

## BR-ORD-001 — Order cancellation requires an explicit reason and operator audit

- **Statement**: An order cannot transition to `state = 'cancelled'` without a mandatory cancellation reason (`cancellation_reason`). The server must record the operator's ID (`cancelled_by`) and the exact server timestamp (`cancelled_at`).
- **Owner**: Audit & Fraud Prevention.
- **Authority**: `apps/sync_api/src/modules/orders/services/orders.service.ts`.
- **Consequence**: Cashiers and waitstaff cannot silently void tables or orders. Every cancelled order creates an auditable record visible in financial loss reports.
- **Verification**: Database and controller tests asserting that cancelling an order without `reason` fails with a `400 Bad Request`, and that successful cancellations persist `cancelled_by`, `cancelled_at`, and `cancellation_reason`.

---

## BR-ORD-002 — Settled orders cannot be cancelled

- **Statement**: An order that has reached `state = 'closed'` with registered payments cannot be directly cancelled. Any financial correction requires an explicit refund or manager credit adjustment workflow.
- **Owner**: Financial Controller.
- **Authority**: `OrdersService`.
- **Consequence**: Historical sales figures and accounting reconciliation cannot be retroactively altered by voiding closed receipts.
- **Verification**: State transition tests asserting error when attempting to cancel closed orders.
