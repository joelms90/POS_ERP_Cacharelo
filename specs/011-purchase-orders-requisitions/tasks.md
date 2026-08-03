# Tasks: Purchase Orders & Inventory Requisitions Module

**Input**: Design documents from `/specs/011-purchase-orders-requisitions/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initial project setup and basic scaffolding.

- [ ] T001 [P] Create folder directories for new backend modules (`apps/sync_api/src/modules/purchase-orders` and `apps/sync_api/src/modules/requisitions`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core database schema updates and models bootstrap required by all user stories.

**⚠️ CRITICAL**: No user story implementation can begin until these database changes are complete.

- [x] T002 Update `apps/sync_api/src/database/schema.ts` to add the tables: `purchaseOrders`, `purchaseOrderItems`, `branchRequisitions`, and `branchRequisitionItems`.
- [x] T003 Generate and apply the PostgreSQL baseline migrations for the new tables.
- [x] T004 [P] Create Flutter Dart cache models `LocalBranchRequisition` and `LocalBranchRequisitionItem` in `apps/pos_flutter/lib/models/local_requisition.dart`.
- [x] T005 Register the new keys/methods in `SecureStorageService` to load, save, and manage cached branch requisitions.

---

## Phase 3: User Story 1 - Purchase Orders (Priority: P1) 🎯 MVP

**Goal**: Create and manage Purchase Orders from suppliers in the Admin Portal.

**Independent Test**: Create a PO with items, mark it as sent, and verify it lists correctly in the PO grid.

- [x] T006 [P] [US1] Create PO CRUD controller, service, and repository in `apps/sync_api/src/modules/purchase-orders/`.
- [x] T007 [P] [US1] Create React/Tauri UI page for PO management, listing, and draft forms in `apps/business_control_tauri/src/pages/PurchaseOrdersPage.tsx`.
- [x] T008 [US1] Write backend integration tests for creating, retrieving, and updating POs.

---

## Phase 4: User Story 2 - PO Reception & Average Cost (Priority: P1) 🎯 MVP

**Goal**: Process PO receptions, update stock levels, recalculate product average costs, and write audit movements.

**Independent Test**: Process a PO receipt with different cost values and check that `products.cost` updates to the weighted average.

- [x] T009 [US2] Implement actual received quantities and unit cost entry in `apps/sync_api/src/modules/purchase-orders/purchase-orders.service.ts`.
- [x] T010 [US2] Implement average cost calculation logic inside `apps/sync_api/src/modules/inventory/inventory.service.ts`, updating `products.cost` and logging `receipt` movements.
- [x] T011 [US2] Create React/Tauri UI page for PO Reception input in `apps/business_control_tauri/src/pages/ReceptionPage.tsx`.
- [x] T012 [US2] Write NestJS integration tests to verify the mathematical accuracy of average cost recalculations under normal, zero, and negative stock conditions.

---

## Phase 5: User Story 3 - Branch Requisitions & Transfers (Priority: P2)

**Goal**: Request supplies from POS while offline, sync when online, and approve requisitions in the Admin dashboard to generate transfers.

**Independent Test**: Submit a requisition from POS while offline, reconnect, verify it reaches the server as pending, and approve it in the admin console to generate a transfer.

- [x] T013 [P] [US3] Create branch requisitions CRUD and state transitions API in `apps/sync_api/src/modules/requisitions/`.
- [x] T014 [P] [US3] Implement requisition approval logic in backend, which automatically creates a pending `stock_transfers` record.
- [x] T015 [US3] Implement Flutter UI screens for branch users to create and view requisitions in `apps/pos_flutter/lib/ui/requisitions/create_requisition.dart`.
- [x] T016 [US3] Implement local Isar persistence and `SyncOperation` queuing/synchronization logic for requisitions in `apps/pos_flutter/lib/services/requisition_service.dart`.
- [x] T017 [US3] Create warehouse manager approval dashboard in `apps/business_control_tauri/src/pages/RequisitionsApprovalPage.tsx`.
- [x] T018 [US3] Write integration tests for local caching, network reconnect sync worker behavior, and backend approval transitions.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation, observation, and final walkthrough verification.

- [ ] T019 Run quickstart.md validation steps and verify all API responses.
- [ ] T020 Document offline sync troubleshooting instructions for branch requisitions.
