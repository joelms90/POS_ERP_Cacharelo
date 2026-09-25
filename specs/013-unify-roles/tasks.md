# Tasks: Unified Operational Roles

## Phase 1: Foundation

- [ ] T001 Create canonical role/capability definitions in `apps/sync_api/src/modules/auth/`.
- [ ] T002 [P] Align dashboard role assignment and tabs in `apps/business_control_tauri/src/App.tsx` and `components/organisms/UserForm.tsx`.
- [ ] T003 [P] Align Flutter role parsing, aliases, and active-role selection in `apps/pos_flutter/lib/ui/common/app_state.dart`.

## Phase 2: User Story 1 - Branch operator (P1)

- [X] T004 [US1] Gate branch-operator POS actions and requisition creation in `apps/pos_flutter/lib/ui/`.
- [X] T005 [US1] Add API authorization for branch-scoped requisitions and transfer reception in `apps/sync_api/src/modules/requisitions/` and `modules/inventory/`.
- [X] T006 [US1] Require and persist transfer-receipt discrepancy notes in `apps/sync_api/src/modules/inventory/`.

## Phase 3: User Story 2 - Warehouse/purchasing operator (P1)

- [ ] T007 [US2] Gate purchase orders, supplier reception, requisition decisions, and transfer dispatch in dashboard pages.
- [ ] T008 [US2] Enforce warehouse/purchasing API permissions and prevent requisition self-approval in `apps/sync_api/src/modules/`.
- [ ] T009 [US2] Require supplier-receipt mismatch notes and audit actor/outcome.

## Phase 4: User Story 3 - Consistent administration (P2)

- [ ] T010 [US3] Migrate legacy role aliases and expose canonical bundles in user management.
- [ ] T011 [US3] Add authorization and legacy-mapping tests.

## Phase 5: Validation and Documentation

- [ ] T012 Update business-rule documentation and mark implementation status in `specs/013-unify-roles/`.
- [ ] T013 Run backend, dashboard, and Flutter validation commands.

## Branch Operator Daily Workflow Extension

- [X] T014 [US1] Remove warehouse selection and add editable/discardable requisition drafts in `apps/pos_flutter/lib/ui/requisitions/create_requisition.dart`.
- [X] T015 [US1] Add authenticated personal requisition history and status filtering in `apps/sync_api/src/modules/requisitions/` and `apps/pos_flutter/lib/ui/common/app_state.dart`.
- [X] T016 [US1] Add branch-scoped inbound delivery verification and receipts UI in `apps/sync_api/src/modules/inventory/` and `apps/pos_flutter/lib/ui/encargado/`.
- [X] T017 [US1] Add branch-scoped daily cash/card sales and audited cancellation in `apps/sync_api/src/modules/orders/` and `apps/pos_flutter/lib/ui/encargado/`.
- [X] T018 [US1] Add focused requisition workflow behavior coverage in `apps/pos_flutter/test/requisitions_flow_test.dart` and backend service tests.
