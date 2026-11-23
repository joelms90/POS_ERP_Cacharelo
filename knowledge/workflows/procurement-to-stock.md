---
type: "workflow"
flow: "procurement-to-stock"
actors: [owner, inventory-admin, warehouse-purchasing-operator]
endpoints: [inventory/alerts, purchase-orders, inventory, supplier-products, providers]
seeds: [AlertsService, PurchaseOrdersController, PurchaseOrdersService, InventoryService, LedgerService, AuditLogService]
tables: [inventory_alerts, purchase_orders, purchase_order_items, purchase_order_receipt_ledger, audit_log, supplier_products, stock_ledger, stock_levels]
rules: [BR-PO-001, BR-PO-002, BR-PO-003, BR-INV-001, BR-INV-002]
screens:
  - "apps/business_control_tauri/src/pages/PurchaseOrdersPage.tsx"
  - "apps/business_control_tauri/src/pages/ReceiptsPage.tsx"
  - "apps/business_control_tauri/src/pages/InventoryDashboardPage.tsx"
  - "apps/pos_flutter/lib/ui/warehouse/warehouse_dashboard_screen.dart"
title: "Procurement & Purchase Orders Workflow"
description: "OCs: owner / admin inventario create and authorize; Almacén y Compras buys, marks them on the way and registers the entrada (count + price paid); every entrada line is audited."
status: "verified"
generated:
  at: "2026-11-23"
  by: "Claude Code"
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

Owner / Admin. Inventario decide what to buy; Almacén y Compras buys it, brings it to
the warehouse and counts it in. Stock and average cost change only when the entrada
is confirmed.

## Who does what

| Step | Who | Where | Status after |
|---|---|---|---|
| Create (by hand or from inventory alerts) | Owner / Admin. Inventario | Admin → Órdenes de Compra, Panel de Inventario | `draft` |
| Edit (replaces lines) / delete | Owner / Admin. Inventario | Admin, drafts only | `draft` |
| Authorize | Owner / Admin. Inventario | Admin → Autorizar | `authorized` ("Por comprar") |
| Mark purchased (ticket/factura optional) | Almacén y Compras (`warehouse_purchasing_operator`) | POS → Compras y Entradas | `purchased` ("Comprada · en camino a bodega") |
| Entrada: single count + price paid | Almacén y Compras | POS → Compras y Entradas → Registrar Entrada | `partially_received` / `received` |
| Cancel (reason) | Owner / Admin. Inventario | Admin, while nothing has been received | `cancelled` |
| Close short (reason) | Owner / Admin. Inventario | Admin, partly received | `closed_short` |

- Almacén y Compras **never sees drafts or cancelled OCs** and cannot create, edit or authorize.
- Owner / Admin. Inventario may mark purchased or register an entrada **on behalf of** Almacén y Compras, always with a reason (logged as `*_on_behalf`).
- Soporte Técnico is read-only.
- An entrada needs the OC to be `purchased` (or already `partially_received`).

## Workflow

```text
draft ─authorize─► authorized ─mark purchased─► purchased ─entrada─► partially_received ─entrada─► received
  └──────────── cancel (reason) while nothing received ───► cancelled        └─ close short ─► closed_short
```

## Entrada rules

- One count per line per entrada; only products of the OC.
- **Differences are allowed but audited**: if a quantity differs from what is pending (short, merma, over-delivery) or the price paid differs from the estimate, a note is required.
- In one transaction, per line received: weighted average cost of the product across the business, `receipt` movement in `stock_ledger` at the OC destination, `purchase_order_items.quantity_received` and `unit_cost_actual` (weighted average of what was paid across entradas).
- `purchase_order_receipt_ledger` (**append-only**) keeps one row per line per entrada: ordered, previously received, received, pending after, `quantity_difference`, estimated vs actual price, `cost_difference`, note, folio, actor. To investigate:

```sql
SELECT * FROM purchase_order_receipt_ledger
WHERE quantity_difference <> 0 OR cost_difference <> 0
ORDER BY created_at DESC;
```

- Every state change is also in `audit_log` (`entity_type = 'purchase_order'`); `GET /purchase-orders/:id/history` returns both, shown in the admin detail.
- Totals (`subtotal`, `total`) are calculated by the server from the lines.

## Alerts

- `POST /inventory/alerts/:id/generate-purchase-order`, bulk variants and `auto-purchase-orders` create **drafts** (Owner / Admin. Inventario only).
- The auto engine skips products already on any open OC (`draft`, `authorized`, `purchased`, `partially_received`).

## Endpoints

| Endpoint | Roles |
|---|---|
| `GET /purchase-orders`, `/:id`, `/:id/history` | owner, inventory_admin, support_tech, warehouse (no drafts) |
| `GET /purchase-orders/purchasing` | same; returns authorized, purchased, partially_received |
| `POST /purchase-orders`, `PATCH /:id`, `DELETE /:id` | owner, inventory_admin (edit/delete drafts only) |
| `POST /:id/authorize`, `/:id/cancel`, `/:id/close` | owner, inventory_admin |
| `POST /:id/purchase`, `/:id/receive` | warehouse; owner / inventory_admin with a reason |

## Rules

- **BR-PO-001**: only authorized OCs reach Almacén y Compras.
- **BR-PO-002**: stock and cost change only at a confirmed entrada.
- **BR-PO-003**: any quantity or price difference at an entrada needs a note and is kept per line in `purchase_order_receipt_ledger`.

Covered end to end by `apps/sync_api/src/modules/purchase-orders/purchase-orders.integration.spec.ts`.
