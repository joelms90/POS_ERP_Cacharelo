---
type: "rule"
title: "Purchasing & Replenishment Business Rules"
description: "Authoritative business rules for automated purchase order creation, supplier mappings, and branch stock replenishment."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "purchasing"
  - "requisitions"
  - "suppliers"
  - "business-rules"
sources:
  - "apps/sync_api/src/modules/inventory/alerts/alerts.service.ts"
  - "apps/sync_api/src/modules/purchase-orders/"
  - "apps/sync_api/src/modules/requisitions/"
---

# Purchasing & Replenishment Business Rules

These rules dictate how automated procurement and branch replenishment requisitions are evaluated and generated.

---

## BR-PO-001 — Purchase orders require an eligible supplier

- **Statement**: An automated purchase order generated from an inventory alert requires an active supplier-product mapping in `supplier_products` or a primary provider directly linked in `products.provider_id`. Without a valid supplier mapping, the product cannot be automatically ordered.
- **Owner**: Purchasing Administration.
- **Authority**: `AlertsService.generatePurchaseOrder()`.
- **Consequence**: An alert for a product without a supplier mapping flags "Producto sin proveedor registrado" and requires manual operational intervention.
- **Verification**: Alert-to-PO conversion tests asserting error handling when supplier mappings are absent.

---

## BR-PO-002 — Lowest mapped supplier cost is selected for automated purchasing

- **Statement**: When multiple supplier-product mappings exist in `supplier_products` for a single product, automated purchase-order generation selects the supplier offering the lowest unit cost.
- **Owner**: Purchasing Operations.
- **Authority**: `AlertsService.resolveCheapestProvider()`.
- **Consequence**: Businesses minimize acquisition costs without requiring manual price comparison on standard replenishment cycles.
- **Verification**: Unit tests with multiple supplier rows asserting the lowest unit cost is assigned to the purchase order line.

---

## BR-PO-003 — Automated purchase orders start as drafts

- **Statement**: Any purchase order automatically generated from an inventory alert or batch job must be created with `status = 'draft'`.
- **Owner**: Purchasing Approval.
- **Authority**: `apps/sync_api/src/modules/purchase-orders/services/purchase-orders.service.ts`.
- **Consequence**: Automated purchase orders are never sent directly to suppliers or committed without human review and explicit operator approval.
- **Verification**: Database record assertions verifying newly created POs have `status = 'draft'`.

---

## BR-REQ-001 — Replenishment quantity targets the effective maximum

- **Statement**: A branch requisition generated from an inventory alert calculates the requested replenishment quantity as `effective_max_stock - current_quantity`. If no maximum threshold is defined, the documented fallback formula is applied.
- **Owner**: Inventory Operations.
- **Authority**: `AlertsService.generateRequisition()` and `RequisitionsService`.
- **Consequence**: Branches replenish up to their ideal storage capacity, preventing both stockouts and stock overflow in limited retail spaces.
- **Verification**: Requisition calculation unit tests across zero-max and positive-max threshold scenarios.
