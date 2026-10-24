# Implementation Plan: Dedicated Warehouse Operator App (Almacén y Bodega)

**Branch**: `016-warehouse-purchasing-app` | **Date**: 2026-10-24 | **Spec**: [spec.md](file:///Users/joelmorales/web/POS-ERP/specs/016-warehouse-purchasing-app/spec.md)

**Input**: Feature specification from `/specs/016-warehouse-purchasing-app/spec.md`

## Summary

Implement the dedicated **Warehouse Operator App (`WarehouseDashboardScreen`)** in the Flutter POS client (`apps/pos_flutter`) for the canonical role `warehouse_purchasing_operator`.
The module replaces the temporary storefront counter screen with a warehouse-first workspace focused strictly on execution:
1. **Recepción de Proveedores (Entradas a Bodega)**: Inspecting open Purchase Orders issued by administration (`sent`), entering actual received quantities and real unit costs, logging discrepancy notes/returns, and adding stock to the bodega ledger.
2. **Surtido y Despacho a Sucursales (Salidas de Bodega)**: Fulfilling pending Branch Requisitions with picking guidance, deducting bodega inventory, and dispatching stock transfers in transit.
3. **Auditoría de Existencias y Ajustes en Bodega**: On-hand stock lookups, barcode scanner input, and justified manual adjustments (mermas, roturas, caducidad).
4. **Historial de Movimientos de Turno**: Chronological trace of inbound receipts and outbound branch dispatches.
5. **Strict Segregation of Duties**: The operator interface has zero capabilities to create, edit, or delete original Purchase Orders or Branch Requisitions.

---

## Technical Context

**Language/Version**:
- Client: Flutter 3.19+ / Dart 3.3+
- Backend: NestJS / Node.js 20 / TypeScript
- Database: PostgreSQL (Drizzle ORM) + local Flutter secure storage / Isar cache

**Primary Dependencies**:
- Flutter Material 3, Riverpod / ListenableBuilder `AppState`, HTTP client
- NestJS modules: `PurchaseOrdersModule`, `RequisitionsModule`, `InventoryModule`

**Storage**:
- PostgreSQL tables: `purchase_orders`, `purchase_order_items`, `branch_requisitions`, `stock_transfers`, `stock_ledger`, `inventory_movements`, `warehouses`
- Flutter Client cache: Cached POs, Requisitions, and offline sync queue for physical adjustments

**Testing**:
- Flutter unit and widget tests (`test/ui/warehouse/`)
- Backend authorization and reception tests (`npm test` in `apps/sync_api`)

**Target Platform**:
- Landscape Android tablets, iOS iPads, macOS/Windows All-in-One warehouse workstations, and Flutter Web POS

**Performance Goals**:
- PO check-in and reception complete in < 60 seconds.
- Barcode scan resolves product details and stock in < 150ms.
- Requisitions update within 5s via WebSocket or 15s polling.

**Constraints**:
- Strict segregation of duties: No PO creation/editing in Flutter; No Requisition creation/deletion in Flutter.
- Local receipt write before server acknowledge fallback.
- High-contrast, tactile UI suitable for industrial or dim bodega lighting.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Offline continuity**: PASS. The warehouse operator can conduct physical counts, barcode lookups, and draft reception forms offline. Completed operations queue locally and sync idempotently upon network reconnect.
- **Local authority**: PASS. Counts and reception states are stored locally with UUIDs and timestamped versioning.
- **Sync contract**: PASS. PO receipts and transfer dispatches use existing idempotent REST endpoints (`/purchase-orders/:id/receive`, `/branch-requisitions/:id/approve`).
- **Cloud role**: PASS. Cloud API processes weighted average cost recalculations and updates the central stock ledger without blocking the local client.
- **Verification**: PASS. Unit and widget tests will validate the UI state transitions, read-only guarantees, and backend integration.

---

## Project Structure

### Documentation (this feature)

```text
specs/016-warehouse-purchasing-app/
├── spec.md              # Feature requirements and boundaries
├── plan.md              # Implementation plan (this file)
├── research.md          # Phase 0 architectural & UX decisions
├── data-model.md        # Phase 1 data contracts and DTOs
├── quickstart.md        # Phase 1 setup and testing guide
└── contracts/
    └── api-contracts.md # Endpoints consumed by the Flutter app
```

### Source Code Architecture

```text
apps/pos_flutter/lib/
├── ui/
│   ├── login_screen.dart                     # Routes warehousePurchasingOperator to WarehouseDashboardScreen
│   └── warehouse/                            # NEW: Dedicated warehouse operator workspace
│       ├── warehouse_dashboard_screen.dart   # Main scaffold with 4 tabs and bodega header
│       ├── tabs/
│       │   ├── po_receiving_tab.dart         # Tab 1: Incoming supplier POs & check-in modal
│       │   ├── requisitions_dispatch_tab.dart# Tab 2: Branch requests & picking/dispatch workflow
│       │   ├── warehouse_stock_tab.dart      # Tab 3: Bodega stock catalog, barcode lookup & adjustments
│       │   └── movement_history_tab.dart     # Tab 4: Shift trace of received/dispatched items
│       └── widgets/
│           ├── po_receiving_dialog.dart      # Tactile check-in dialog with numeric keypad
│           ├── picking_list_modal.dart       # Surtido & dispatch confirmation dialog
│           └── stock_adjustment_dialog.dart  # Reason-coded adjustment modal (merma/rotura)
├── ui/common/
│   └── app_state.dart                        # Integration of warehouse fetch/submit methods
```

---

## Phases and Milestones

1. **Phase 0 - Research & UX Ergonomics** (`research.md`): Finalize tactile inputs, barcode scanner handler, and read-only boundaries.
2. **Phase 1 - Contracts & Data Models** (`data-model.md`, `contracts/`): Document DTOs for PO reception, requisition dispatch, and stock adjustment.
3. **Phase 2 - Flutter Implementation**:
   - Create `WarehouseDashboardScreen` and connect routing in `login_screen.dart`.
   - Build `PoReceivingTab` and `PoReceivingDialog` with numeric keypad.
   - Build `RequisitionsDispatchTab` with picking and transfer dispatch.
   - Build `WarehouseStockTab` with barcode listener and adjustment modal.
   - Build `MovementHistoryTab`.
4. **Phase 3 - Verification & Testing**: Run Flutter widget tests, manual verification, and build check.
