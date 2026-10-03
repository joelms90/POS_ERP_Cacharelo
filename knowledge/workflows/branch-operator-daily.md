---
type: "workflow"
title: "Branch Operator Daily Operational Workflow"
description: "Step-by-step procedure for branch operators managing requisitions, inbound shipments, and sales reconciliation."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "workflow"
  - "branch-operator"
  - "pos"
  - "transfers"
  - "requisitions"
sources:
  - "specs/013-unify-roles/spec.md"
  - "apps/pos_flutter/lib/ui/branch_operator/"
---

# Branch Operator Daily Operational Workflow

The `branch_operator` role is responsible for overseeing shift execution, ensuring inventory availability, receiving warehouse shipments, and verifying shift financial totals.

---

## 1. Morning Shift Initialization

1. **Tablet Login**:
   - The operator selects their profile on the Flutter POS tablet and inputs their 4-6 digit quick PIN.
   - The terminal calls `POST /api/auth/login-tablet`, binding the operator's session token to the terminal's branch (`BR-ROLE-002`).
2. **Review Low-Stock Alerts**:
   - Operator checks branch stock levels. If ingredients or finished goods are running low, they initiate an internal requisition.

---

## 2. Creating a Branch Requisition

1. **Requisitions Screen**:
   - Navigate to the **Requisiciones** tab in the POS.
   - Tap **Nueva Requisición**.
2. **Product Catalog Search**:
   - Search products by name, SKU, or internal barcode.
   - Add items and specify the requested quantity (targets effective maximum stock per `BR-REQ-001`).
3. **Submission**:
   - Submit the draft. Requisition is persisted with status `pending_approval`.
   - *Note*: Under `BR-ROLE-003`, the branch operator cannot approve their own requisition.

---

## 3. Inbound Transfer Reception

1. **Inspect Pending Inbound Transfers**:
   - Navigate to the **Recibir** tab in the branch operator workflow.
   - The list shows transfers currently `in_transit` to this branch.
2. **Physical Count & Verification**:
   - Count delivered items.
   - Enter the actual received quantity (`quantity_received`).
3. **Discrepancy Notes**:
   - If `quantity_received !== shipped_quantity`, the operator **must provide an explicit discrepancy note** (`BR-TRN-002`).
4. **Confirm Receipt**:
   - Tap **Confirmar Recepción**.
   - Server decrements the virtual `En Tránsito` warehouse and credits the branch inventory in `stock_ledger`.

---

## 4. End-of-Day Sales Summary

1. Tap **Resumen** in the operator view.
2. Review aggregated cash and card transaction volume processed across all active terminals for that branch.
3. Compare against physical cashier drawer cuts (Corte Z).
