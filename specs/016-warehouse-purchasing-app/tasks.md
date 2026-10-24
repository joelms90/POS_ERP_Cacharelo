# Tasks: Dedicated Warehouse Operator App (Almacén y Bodega)

**Input**: Design documents from `/specs/016-warehouse-purchasing-app/`  
**Prerequisites**: [plan.md](file:///Users/joelmorales/web/POS-ERP/specs/016-warehouse-purchasing-app/plan.md), [spec.md](file:///Users/joelmorales/web/POS-ERP/specs/016-warehouse-purchasing-app/spec.md), [research.md](file:///Users/joelmorales/web/POS-ERP/specs/016-warehouse-purchasing-app/research.md), [data-model.md](file:///Users/joelmorales/web/POS-ERP/specs/016-warehouse-purchasing-app/data-model.md), [contracts/](file:///Users/joelmorales/web/POS-ERP/specs/016-warehouse-purchasing-app/contracts/api-contracts.md)

---

## Phase 1: Setup & Routing (Foundational)

**Purpose**: Route the warehouse operator away from store counter screens to the new dedicated workspace.

- [ ] T001 Update `apps/pos_flutter/lib/ui/login_screen.dart` to route `UserRole.warehousePurchasingOperator` directly to `WarehouseDashboardScreen` instead of `EncargadoDashboardScreen`.
- [ ] T002 Create directory `apps/pos_flutter/lib/ui/warehouse/` and implement `warehouse_dashboard_screen.dart` scaffold with top status bar (active warehouse badge, online/sync status, logout) and bottom/side navigation tabs.
- [ ] T003 Add warehouse data methods to `apps/pos_flutter/lib/ui/common/app_state.dart` (`fetchWarehousePurchaseOrders`, `receivePurchaseOrder`, `fetchWarehouseRequisitions`, `dispatchRequisition`, `fetchWarehouseInventory`, `adjustWarehouseStock`).

---

## Phase 2: User Story 1 - Recepción de Mercancía de Proveedores (Priority: P1)

**Purpose**: Receive supplier shipments against existing POs, record actual delivered quantities, mermas/discrepancies, and enter stock into the bodega.

- [ ] T004 [US1] Implement `PoReceivingTab` in `apps/pos_flutter/lib/ui/warehouse/tabs/po_receiving_tab.dart` displaying incoming POs filtered by `status=sent,partially_received` with provider name, delivery date, and item count.
- [ ] T005 [US1] Implement `PoReceivingDialog` in `apps/pos_flutter/lib/ui/warehouse/widgets/po_receiving_dialog.dart` with:
  - Read-only original requested quantities and agreed costs.
  - Default "Recibir Completo" pre-population.
  - Large tactile numeric keypad for fast quantity and invoice cost adjustments.
  - Mandatory discrepancy reason dropdown/text when `received < ordered`.
- [ ] T006 [US1] Connect reception confirmation in `app_state.dart` to call `POST /purchase-orders/:id/receive` and verify that warehouse inventory increments in `stock_ledger`.
- [ ] T007 [US1] Verify read-only enforcement: ensure NO options exist in `PoReceivingTab` or `PoReceivingDialog` to create, edit line items, or delete original Purchase Orders.

---

## Phase 3: User Story 2 - Surtido y Despacho de Requisiciones a Sucursales (Priority: P1)

**Purpose**: Review store branch replenishment requests, verify on-hand stock, pack goods, and dispatch stock transfers to branches.

- [ ] T008 [US2] Implement `RequisitionsDispatchTab` in `apps/pos_flutter/lib/ui/warehouse/tabs/requisitions_dispatch_tab.dart` listing pending store requisitions (`status=pending_approval,standby`) grouped by branch.
- [ ] T009 [US2] Implement `PickingListModal` in `apps/pos_flutter/lib/ui/warehouse/widgets/picking_list_modal.dart` showing requested items alongside real-time warehouse stock availability with picking check-off.
- [ ] T010 [US2] Connect `dispatchRequisition` in `app_state.dart` to call `POST /branch-requisitions/:id/approve` to decrement warehouse stock and transition transfer to `in_transit`.
- [ ] T011 [US2] Implement Requisition Standby/Reject dialog in `apps/pos_flutter/lib/ui/warehouse/widgets/requisition_decision_dialog.dart` with mandatory explanation note.
- [ ] T012 [US2] Verify read-only enforcement: ensure NO options exist to create new requisitions on behalf of branches or alter requested item quantities.

---

## Phase 4: User Story 3 - Auditoría Rápida de Stock y Conteo Físico en Bodega (Priority: P2)

**Purpose**: Quick bodega stock lookups, barcode scanner integration, and justified adjustments for damaged/expired goods.

- [ ] T013 [US3] Implement `WarehouseStockTab` in `apps/pos_flutter/lib/ui/warehouse/tabs/warehouse_stock_tab.dart` showing on-hand products grouped by category with current stock and cost.
- [ ] T014 [US3] Add hardware barcode scanner integration in `WarehouseStockTab` using persistent `FocusNode` with `onSubmitted` to resolve scanned products by `barcode` or `sku` in < 150ms.
- [ ] T015 [US3] Implement `StockAdjustmentDialog` in `apps/pos_flutter/lib/ui/warehouse/widgets/stock_adjustment_dialog.dart` with delta quantity input and mandatory reason code (`merma`, `rotura`, `caducidad`, `conteo_fisico`, `correccion`).

---

## Phase 5: User Story 4 - Historial de Movimientos de Bodega (Priority: P3)

**Purpose**: Shift trace of received supplier shipments and dispatched branch transfers.

- [ ] T016 [US4] Implement `MovementHistoryTab` in `apps/pos_flutter/lib/ui/warehouse/tabs/movement_history_tab.dart` showing chronological trace of today's receipts and outbound dispatches.
- [ ] T017 [US4] Add movement detail dialog displaying timestamp, carrier/driver notes, and individual item quantities.

---

## Phase 6: Polish & Verification Gate

**Purpose**: Verification of zero store artifacts, responsiveness, and clean compilation.

- [ ] T018 Run `flutter analyze` in `apps/pos_flutter` and resolve any typing or linter warnings.
- [ ] T019 Verify UI responsiveness across tablet landscape and desktop viewports, ensuring large touch targets for bodega work.
- [ ] T020 Run full monorepo verification (`make check-all` or Flutter tests).
