# Tasks: Dedicated Warehouse Operator App (Almacén y Bodega)

**Input**: Design documents from `/specs/016-warehouse-purchasing-app/`  
**Prerequisites**: [plan.md](file:///Users/joelmorales/web/POS-ERP/specs/016-warehouse-purchasing-app/plan.md), [spec.md](file:///Users/joelmorales/web/POS-ERP/specs/016-warehouse-purchasing-app/spec.md), [research.md](file:///Users/joelmorales/web/POS-ERP/specs/016-warehouse-purchasing-app/research.md), [data-model.md](file:///Users/joelmorales/web/POS-ERP/specs/016-warehouse-purchasing-app/data-model.md), [contracts/](file:///Users/joelmorales/web/POS-ERP/specs/016-warehouse-purchasing-app/contracts/api-contracts.md)

---

## Phase 1: Setup & Routing (Foundational)

**Purpose**: Route the warehouse operator away from store counter screens to the new dedicated workspace.

- [x] T001 Update `apps/pos_flutter/lib/ui/login_screen.dart` to route `UserRole.warehousePurchasingOperator` directly to `WarehouseDashboardScreen` instead of `EncargadoDashboardScreen`.
- [x] T002 Create directory `apps/pos_flutter/lib/ui/warehouse/` and implement `warehouse_dashboard_screen.dart` scaffold with top status bar (active warehouse badge, online/sync status, logout) and bottom/side navigation tabs.
- [x] T003 Add warehouse data methods to `apps/pos_flutter/lib/ui/common/app_state.dart` (`fetchWarehousePurchaseOrders`, `receivePurchaseOrder`, `fetchWarehousePendingRequisitions`, `updateRequisitionStatus`, `fetchWarehouseStock`, `fetchWarehousesList`).

---

## Phase 2: User Story 1 - Recepción de Mercancía de Proveedores (Priority: P1)

**Purpose**: Receive supplier shipments against existing POs, record actual delivered quantities, mermas/discrepancies, and enter stock into the bodega.

- [x] T004 [US1] Implement `PoReceivingTab` in `apps/pos_flutter/lib/ui/warehouse/` displaying incoming POs filtered by `status=sent,partially_received` with provider name, delivery date, and item count.
- [x] T005 [US1] Implement `_openReceiveDialog` in `warehouse_dashboard_screen.dart` with:
  - Read-only original requested quantities and agreed costs.
  - Default "Recibir Completo" pre-population.
  - Large tactile numeric keypad for fast quantity and invoice cost adjustments.
  - Mandatory discrepancy reason / invoice number capture.
- [x] T006 [US1] Connect reception confirmation in `app_state.dart` to call `POST /purchase-orders/:id/receive` and verify that warehouse inventory increments in `stock_ledger`.
- [x] T007 [US1] Verify read-only enforcement: ensure NO options exist in `PoReceivingTab` or dialog to create, edit line items, or delete original Purchase Orders.

---

## Phase 3: User Story 2 - Surtido y Despacho de Requisiciones a Sucursales (Priority: P1)

**Purpose**: Review store branch replenishment requests, verify on-hand stock, pack goods, and dispatch stock transfers to branches.

- [x] T008 [US2] Implement `RequisitionsTab` in `apps/pos_flutter/lib/ui/warehouse/` listing pending store requisitions (`status=pending,standby`) grouped by branch.
- [x] T009 [US2] Implement item breakdown showing requested items alongside stock quantities.
- [x] T010 [US2] Connect `_dispatchRequisition` in `app_state.dart` to call `PATCH /requisitions/:id/status` to decrement warehouse stock and transition transfer to `approved` / in transit.
- [x] T011 [US2] Implement Requisition Standby dialog in `warehouse_dashboard_screen.dart` with mandatory explanation note.
- [x] T012 [US2] Verify read-only enforcement: ensure NO options exist to create new requisitions on behalf of branches or alter requested item quantities.

---

## Phase 4: User Story 3 - Auditoría Rápida de Stock y Conteo Físico en Bodega (Priority: P2)

**Purpose**: Quick bodega stock lookups, barcode scanner integration, and warehouse switcher.

- [x] T013 [US3] Implement `WarehouseStockTab` in `warehouse_dashboard_screen.dart` showing on-hand products with current stock, SKU, barcode, and cost.
- [x] T014 [US3] Add hardware barcode scanner integration in `WarehouseStockTab` using persistent `FocusNode` to resolve scanned products by `barcode`, `sku`, or name.
- [x] T015 [US3] Implement multi-warehouse switcher dropdown in AppBar to audit individual bodega stocks.

---

## Phase 5: User Story 4 - Historial de Movimientos de Bodega (Priority: P3)

**Purpose**: Shift trace of received supplier shipments and dispatched branch transfers.

- [ ] T016 [US4] Implement dedicated movement history view with carrier/driver notes and timestamps.
- [ ] T017 [US4] Add movement filter by date range and provider.

---

## Phase 6: Polish & Verification Gate

**Purpose**: Verification of zero store artifacts, responsiveness, and clean compilation.

- [x] T018 Run `flutter analyze` in `apps/pos_flutter` and resolve any typing or linter errors (0 compilation errors).
- [x] T019 Verify UI responsiveness across tablet landscape and desktop viewports, ensuring flexible app bar and touch targets.
- [x] T020 Run widget tests in `warehouse_flow_test.dart` and deploy to Firebase Hosting (`https://cacharelo-pos.web.app`).
