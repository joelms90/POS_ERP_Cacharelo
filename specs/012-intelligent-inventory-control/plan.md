# Implementation Plan: Control Inteligente de Inventario por Sucursal

**Branch**: `012-intelligent-inventory-control` | **Date**: 2026-08-05 | **Spec**: [spec.md](file:///Users/joelmorales/web/POS-ERP/specs/012-intelligent-inventory-control/spec.md)

**Input**: Feature specification from `/specs/012-intelligent-inventory-control/spec.md`

## Summary

Add per-branch stock thresholds, a low-stock alert engine, an alert dashboard ("Panel de Inventario"), auto-generated requisitions from alerts, and auto-generated purchase orders from global minimums. This involves:

1. **Database Schema & Migrations**: Add `branch_stock_thresholds`, `inventory_alerts`, and `business_inventory_settings` tables. No changes to existing tables.
2. **Backend API (sync_api)**: New modules for alerts and thresholds. Extend requisitions service for auto-generation. New auto-PO engine service. Scheduled job runner.
3. **Admin Portal (business_control_tauri)**: New "Panel de Inventario" page with alert dashboard, branch threshold management UI, and one-click requisition generation.
4. **Flutter POS App (pos_flutter)**: No changes needed for this spec. POS already reports sales and stock changes via existing endpoints.

## Technical Context

**Language/Version**:
- Backend: NestJS (TypeScript / Node.js 20)
- Web Admin: React 18 / TypeScript / Tauri

**Primary Dependencies**:
- Drizzle ORM, pg (Postgres client)
- NestJS Scheduler (`@nestjs/schedule`) for periodic alert engine runs

**Storage**:
- New Postgres tables: `branch_stock_thresholds`, `inventory_alerts`, `business_inventory_settings`
- Existing tables reused: `stockLevels`, `products`, `branches`, `warehouses`, `branchRequisitions`, `branchRequisitionItems`, `purchaseOrders`, `purchaseOrderItems`, `supplierProducts`, `inventoryMovements`

**Testing**:
- NestJS integration tests for alert engine (detection, deduplication, resolution)
- Unit tests for threshold fallback logic and auto-PO provider selection
- Frontend component tests for alert dashboard

**Target Platform**:
- Web / Desktop Tauri (Business Control Admin)
- Cloud (NestJS API + Postgres database)

**Performance Goals**:
- Alert engine processes 5,000 product-branch pairs in under 2 seconds
- Single alert-to-requisition generation API call completes in under 3 seconds
- Dashboard alert list loads in under 500ms with up to 200 active alerts

**Constraints**:
- Alert engine must be idempotent (safe to run multiple times)
- Auto-generated requisitions must reuse the existing requisition workflow without modification
- Auto-generated POs must be `draft` only (never auto-sent to providers)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Offline continuity**: N/A. This feature is entirely server-side logic + admin dashboard. POS operations that trigger stock changes already sync inventory movements; the alert engine runs server-side against synced data.
- **Local authority**: N/A. No local data storage required for this feature. Thresholds and alerts are stored server-side.
- **Sync contract**: PASS. The alert engine reacts to inventory movements that are already synced. Auto-generated requisitions and POs are server-side only.
- **Cloud role**: PASS. All intelligence (threshold comparison, alert generation, auto-requisition, auto-PO) runs on the cloud API.
- **Verification**: PASS. Integration tests will validate alert creation, deduplication, resolution, and auto-generation logic.

## Project Structure

### Documentation (this feature)

```text
specs/012-intelligent-inventory-control/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── data-model.md        # Phase 1 database schema definitions
└── tasks.md             # Task breakdown (generated after spec validation)
```

### Source Code

```text
apps/
├── sync_api/
│   └── src/
│       ├── database/
│       │   └── schema.ts                          # New tables: branch_stock_thresholds, inventory_alerts, business_inventory_settings
│       └── modules/
│           ├── inventory/
│           │   ├── inventory.service.ts           # Extend: call alert engine on stock changes
│           │   └── thresholds/
│           │       ├── thresholds.controller.ts   # CRUD for branch stock thresholds
│           │       ├── thresholds.service.ts      # Threshold upsert/delete/effective-threshold logic
│           │       └── dto/
│           ├── alerts/
│           │   ├── alerts.controller.ts           # List/filter/update inventory alerts
│           │   ├── alerts.service.ts              # Alert detection engine, auto-resolution
│           │   └── dto/
│           ├── requisitions/
│           │   └── requisitions.controller.ts     # Extend: POST auto-generate from alert
│           ├── purchase-orders/
│           │   └── purchase-orders.service.ts     # Extend: auto-PO generation method
│           └── scheduler/
│               └── inventory-scheduler.service.ts # Periodic job: run alert engine at configurable interval
└── business_control_tauri/
    └── src/
        ├── App.tsx                                # Add 'inventory-dashboard' tab for admin roles
        ├── components/templates/
        │   └── AdminLayout.tsx                    # Sidebar link for Panel de Inventario
        └── pages/
            └── InventoryDashboardPage.tsx         # Alert dashboard, summary cards, quick-actions
```

**Structure Decision**: New modules `thresholds` and `alerts` created under `inventory/` since they are logically part of inventory management. The scheduler module is separate for the periodic alert engine. Frontend gets one new page. Existing `RequisitionsPage` and `PurchaseOrdersPage` receive minor updates for auto-generation entry points.

## Key Design Decisions

1. **Branch thresholds in a separate table**, not added to `stockLevels`. `stockLevels` represents physical quantities and is modified by every inventory operation. Keeping thresholds separate avoids write contention and keeps the data model clean.

2. **Alert engine runs on every inventory write AND periodically**. The immediate trigger catches most cases in real-time. The periodic job (every 15 minutes default) is a safety net for edge cases (direct DB modifications, missed triggers, deployment gaps).

3. **Auto-PO grouping by provider**. When multiple products from the same provider drop below global minimum, they're grouped into one PO. This mimics real-world procurement: you place one order per provider, not one per product.

4. **No Flutter POS changes**. The POS already reports sales and inventory movements. The alert engine reacts to those movements server-side. Requisitions are generated server-side, so the POS just sees them appear in the existing requisition list.

5. **Effective threshold = branch threshold || global threshold**. Simple fallback chain. If neither is set (global minStock=0), no alerts are generated for that product (minStock=0 means "no minimum").

## Dependencies

- **Existing modules**: `inventory`, `requisitions`, `purchase-orders`, `products`, `branches`, `warehouses`
- **No new npm packages** required. `@nestjs/schedule` may be needed if periodic scheduling is implemented (check if already in dependencies).
