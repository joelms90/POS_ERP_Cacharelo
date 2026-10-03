# Purchasing and Replenishment Rules

## BR-PO-001 — Purchase orders require an eligible supplier

- **Statement:** A purchase order generated from a stock alert requires a
  supplier-product mapping; without one, the product cannot be automatically
  ordered.
- **Owner:** Purchasing.
- **Authority:** `AlertsService.generatePurchaseOrder()`.
- **Verification:** An alert for a product without a supplier mapping returns
  “Producto sin proveedor registrado” and requires manual resolution.

## BR-PO-002 — Cheapest mapped supplier is selected for automated purchasing

- **Statement:** When multiple supplier-product mappings exist for a product,
  automated purchase-order generation selects the lowest mapped unit cost.
- **Owner:** Purchasing.
- **Authority:** `AlertsService.resolveCheapestProvider()`.
- **Verification:** The Feature 012 purchase-order scenarios cover multiple
  supplier costs.

## BR-PO-003 — Automatic purchase orders start as drafts

- **Statement:** A purchase order generated from an inventory alert is created
  in `draft` status for review before it is sent to a supplier.
- **Owner:** Purchasing approval.
- **Authority:** `AlertsService.generatePurchaseOrder()`.
- **Verification:** The generated PO is persisted with `status='draft'`.

## BR-REQ-001 — Replenishment quantity targets the effective maximum

- **Statement:** A requisition generated from an inventory alert requests the
  quantity needed to replenish to the applicable maximum threshold. When no
  maximum is available, the documented fallback is used.
- **Owner:** Inventory operations.
- **Authority:** Inventory alert/requisition generation service.
- **Verification:** See Feature 012 User Story 4 and its edge cases.
