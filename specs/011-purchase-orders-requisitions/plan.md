# Implementation Plan: Purchase Orders & Inventory Requisitions Module

**Branch**: `011-purchase-orders-requisitions` | **Date**: 2026-07-17 | **Spec**: [spec.md](file:///Users/joelmorales/web/POS-ERP/specs/011-purchase-orders-requisitions/spec.md)

**Input**: Feature specification from `/specs/011-purchase-orders-requisitions/spec.md`

## Summary

Implement the Purchase Orders (Órdenes de Compra), Inventory Reception with Average Cost Recalculation, and Branch Requisitions (Requisiciones) module. This involves:
1. **Database Schema & Migrations**: Add tables `purchase_orders`, `purchase_order_items`, `branch_requisitions`, and `branch_requisition_items`. Update Drizzle schema.
2. **Backend API (sync_api)**: Create endpoints and services for PO CRUD, receipt process linking to PO, average cost recalculation, and branch requisitions workflow (accept/reject/standby).
3. **Flutter POS App (pos_flutter)**: Add support for creating requisitions locally in Isar database when offline, enqueuing them in the sync queue, and syncing them on reconnection.
4. **Admin Portal (business_control_tauri)**: Implement UI pages for PO management, PO receiving/reception, and warehouse approval dashboard for branch requisitions.

## Technical Context

**Language/Version**:
- Backend: NestJS (TypeScript / Node.js 20)
- POS Client: Flutter 3.19+ / Dart 3.3+
- Web Admin: React 18 / TypeScript / Tauri

**Primary Dependencies**:
- Drizzle ORM, pg (Postgres client)
- Isar Database (local POS DB)

**Storage**:
- Postgres tables: `purchase_orders`, `purchase_order_items`, `branch_requisitions`, `branch_requisition_items`.
- Local Isar collections: `LocalBranchRequisition`, `LocalBranchRequisitionItem` on Flutter POS client.
- Sync operations queue (`SyncOperation`) for offline-created requisitions.

**Testing**:
- NestJS integration tests for PO reception, average cost calculations, and requisition approvals.
- Flutter widget & unit tests for offline requisition creation and sync behavior.

**Target Platform**:
- Web / Desktop Tauri (Business Control Admin)
- Mobile / Web POS (Flutter Client)
- Cloud (NestJS API + Postgres database)

**Performance Goals**:
- Weighted average cost recalculation completes in < 100ms.
- Local requisition creation on POS completes in < 50ms with instant Isar write.
- Sync worker processes queued offline requisitions in < 2s upon network recovery.

**Constraints**:
- Requisition creation on POS must not require an active internet connection.
- Average cost updates must update the master product cost (`products.cost`) and log audit records in `inventory_movements`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Offline continuity**: PASS. POS operators can create, view, and save branch requisitions offline. Critical operations are fully supported without an internet connection.
- **Local authority**: PASS. Requisitions created offline are written to Isar with unique UUIDs, local versions, and a sync status of `pending`.
- **Sync contract**: PASS. Enqueued requisitions are synced using idempotent APIs. Duplicate submissions are handled via unique client-side UUIDs.
- **Cloud role**: PASS. Cloud API processes the requisitions, manages the transition to stock transfers, and coordinates the business-wide average cost recalculation.
- **Verification**: PASS. Integration tests will validate the math of average cost recalculation and offline-to-online sync of queued requisitions.

## Project Structure

### Documentation (this feature)

```text
specs/011-purchase-orders-requisitions/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Phase 0 research & cost calculation analysis
├── data-model.md        # Phase 1 database schema & Isar model definitions
└── quickstart.md        # Phase 1 walkthrough & testing quickstart guide
```

### Source Code

```text
apps/
├── sync_api/
│   └── src/
│       ├── database/
│       │   └── schema.ts                     # Schema updates (PO, Requisition tables)
│       └── modules/
│           ├── purchase-orders/              # Purchase orders routes & services
│           ├── requisitions/                 # Branch requisitions routes & services
│           └── inventory/
│               └── inventory.service.ts      # Average cost math & stock movement updates
├── pos_flutter/
│   └── lib/
│       ├── models/
│       │   └── local_requisition.dart        # Isar requisition models
│       ├── services/
│       │   └── requisition_service.dart      # Requisition local cache & sync service
│       └── ui/
│           └── requisitions/
│               └── create_requisition.dart   # Requisition form screen
└── business_control_tauri/
    └── src/
        ├── pages/
        │   ├── PurchaseOrdersPage.tsx        # PO CRUD & Listing
        │   ├── ReceptionPage.tsx             # PO receiving & cost entry
        │   └── RequisitionsApprovalPage.tsx  # Manager approval dashboard
```

**Structure Decision**: Monorepo split into backend NestJS API (`apps/sync_api`), React-Tauri desktop/web admin portal (`apps/business_control_tauri`), and Flutter mobile/web POS client (`apps/pos_flutter`).
