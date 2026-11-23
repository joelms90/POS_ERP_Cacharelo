---
type: "workflow"
flow: "replenishment-to-receipt"
actors: [branch-operator, warehouse-operator, owner, inventory-admin]
endpoints: [requisitions, inventory, warehouses, branch-catalog]
seeds: [RequisitionsController, RequisitionsService, InventoryController, InventoryService, LedgerService, AuditLogService]
tables: [branch_requisitions, branch_requisition_items, requisition_item_ledger, audit_log, branch_stock_thresholds, stock_transfers, stock_transfer_items, stock_ledger, stock_levels]
rules: [BR-REQ-001, BR-TRN-001, BR-TRN-002, BR-TRN-003, BR-INV-001, BR-INV-002, BR-ROLE-003]
screens:
  - "apps/pos_flutter/lib/ui/requisitions/create_requisition.dart"
  - "apps/pos_flutter/lib/ui/warehouse/warehouse_dashboard_screen.dart"
  - "apps/business_control_tauri/src/pages/RequisitionsPage.tsx"
  - "apps/business_control_tauri/src/pages/TransfersPage.tsx"
  - "apps/business_control_tauri/src/pages/ReceiptsPage.tsx"
title: "Stock Replenishment & Transfer Workflow"
description: "Branch requisitions: OIS requests, owner / admin inventario authorizes, Almacén y Bodega dispatches and delivers, OIS confirms; every step audited per product."
status: "verified"
generated:
  at: "2026-11-23"
  by: "Claude Code"
tags:
  - "workflow"
  - "transfers"
  - "requisitions"
  - "transit"
  - "warehouse"
sources:
  - "INVENTORY_ARCHITECTURE.md"
  - "docs/purchase-order-to-inventory-flow.md"
  - "apps/sync_api/src/modules/inventory/"
  - "apps/sync_api/src/modules/requisitions/"
---

# Stock Replenishment & Transfer Workflow

A branch asks for stock, an administrator authorizes it, the central warehouse
dispatches and delivers it, and the branch confirms what arrived. Each step can
change quantities (with a note) and every change is kept per product.

---

## Who does what

| Step | Who | Where | Status after |
|---|---|---|---|
| Request | OIS (`branch_operator`) | POS → Requisiciones | `pending_approval` |
| Request (born authorized) | Owner / Admin. Inventario | Admin web → Requisiciones, or an inventory alert | `approved` |
| Authorize (may adjust quantities) / reject | Owner / Admin. Inventario | Admin web → Requisiciones → Revisar | `approved` / `rejected` |
| Hold (no stock yet) | Almacén y Bodega (`warehouse_purchasing_operator`) | POS → Salidas | `standby` |
| Dispatch (may adjust quantities) | Almacén y Bodega | POS → Salidas → Surtir y Despachar | `in_transit` |
| Mark delivered | Almacén y Bodega (Owner / Admin. Inv. on its behalf, with reason) | POS → Salidas → Marcar Entregada | `delivered` |
| Confirm receipt (may report differences) | OIS of the branch (Owner / Admin. Inv. on its behalf, with reason) | POS → Recibir | `completed` |

- Almacén y Bodega **never sees** `pending_approval` or `rejected` requisitions (list, detail and Salidas).
- Almacén y Bodega and Soporte Técnico **cannot create, authorize or reject**. Soporte Técnico is read-only.
- Owner / Admin. Inventario **cannot dispatch**: that is the warehouse step.
- An authorized requisition can be cancelled (`rejected`, reason required) until it is dispatched.

## Workflow

```text
OIS (POS) ─create─► pending_approval ─approve (owner / admin inv.)─► approved ◄─► standby
Owner / Admin. Inv. (web) ─create──────────────────────────────────► approved
                                                                        │ dispatch (bodega)
                                                                        ▼
        stock_transfers row created already in_transit (requisition_id set)
        ledger: origin warehouse −qty (transfer_out), En Tránsito +qty (transit_in)
                                                                        │ deliver (bodega)
                                                                        ▼
                                                                    delivered
                                                                        │ receive (OIS)
                                                                        ▼
        ledger: En Tránsito −qty, branch +received, shortage as transfer_shortage
                                                                    completed
```

Approval does **not** create a transfer. The transfer is created and shipped in one
transaction when Almacén y Bodega dispatches (`POST /requisitions/:id/dispatch`).

## Quantities and discrepancies

`branch_requisition_items` keeps `quantity_requested`, `quantity_approved`,
`quantity_dispatched` and `quantity_received`.

`requisition_item_ledger` is **append-only** (trigger) and holds one row per product
per stage (`requested`, `approved`, `dispatched`, `received`) with `quantity`,
`expected_quantity` (the previous stage), `difference`, `note`, actor and role.
Any difference against the previous stage requires a note. To investigate:

```sql
SELECT * FROM requisition_item_ledger WHERE difference <> 0 ORDER BY created_at DESC;
```

State changes are also written to `audit_log` (`entity_type = 'branch_requisition'`):
`created`, `created_approved`, `approved`, `rejected`, `held`, `dispatched`,
`delivered`, `delivered_on_behalf`, `received`, `received_on_behalf`.
`GET /requisitions/:id/history` returns both; the admin detail modal shows them.

## Endpoints

| Endpoint | Roles |
|---|---|
| `POST /requisitions` | OIS, owner, inventory_admin |
| `GET /requisitions/mine` | OIS |
| `GET /requisitions/pending` | owner, inventory_admin, support_tech |
| `GET /requisitions/outbound` | warehouse, owner, inventory_admin, support_tech |
| `POST /requisitions/:id/approve`, `/reject` | owner, inventory_admin |
| `POST /requisitions/:id/hold`, `/dispatch` | warehouse |
| `POST /requisitions/:id/deliver` | warehouse; owner / inventory_admin with notes |
| `POST /inventory/transfers/:id/receive` | OIS of the destination; owner / inventory_admin with note |
| `GET /requisitions/:id/history` | everyone who can read the requisition |

## Rules

- **BR-REQ-001**: only authorized requisitions reach Almacén y Bodega.
- **BR-TRN-001**: dispatch moves stock origin → En Tránsito; receipt moves En Tránsito → branch.
- **BR-TRN-002**: a receipt that differs from what was dispatched needs a note; the shortage leaves transit as `transfer_shortage`.
- **BR-TRN-003**: a requisition transfer can be received only after it is `delivered`.

Covered end to end by `apps/sync_api/src/modules/requisitions/requisitions.integration.spec.ts`.
