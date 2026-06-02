# Tasks: Waiter and Cashier Application Screens

**Input**: Design documents from `/specs/003-waiter-cashier-screens/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and folder structure setups.

- [ ] T001 Create UI subdirectories `apps/pos_flutter/lib/ui/common/`, `apps/pos_flutter/lib/ui/widgets/`, `apps/pos_flutter/lib/ui/waiter/`, and `apps/pos_flutter/lib/ui/cashier/`
- [ ] T002 Configure mock floor layout data in JSON format at `apps/pos_flutter/assets/floor_plan_mesa.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core visual styles and theme setup that all screens depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 [P] Implement Empire Noir color tokens in `apps/pos_flutter/lib/ui/common/colors.dart`
- [ ] T004 [P] Configure serif and sans-serif text styles in `apps/pos_flutter/lib/ui/common/theme.dart`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Waiter Table Layout & Order Taking (Priority: P1) 🎯 MVP

**Goal**: Allow waiters to view graphical floor maps and take orders for active tables offline.

**Independent Test**: Put the app in mockup mode, select a table from the floor map, add items with modifiers, verify cart totals, and confirm the order.

### Implementation for User Story 1

- [ ] T005 [P] [US1] Create interactive table coordinates widget `apps/pos_flutter/lib/ui/widgets/table_node.dart`
- [ ] T006 [P] [US1] Create high-density food item tile widget `apps/pos_flutter/lib/ui/widgets/menu_card.dart`
- [ ] T007 [P] [US1] Create item custom modifiers dialog `apps/pos_flutter/lib/ui/waiter/modifier_dialog.dart`
- [ ] T008 [US1] Create zone-tabs filter layout `apps/pos_flutter/lib/ui/waiter/zone_tabs.dart`
- [ ] T009 [US1] Create the main order taking cart view `apps/pos_flutter/lib/ui/waiter/cart_sidebar.dart`
- [ ] T010 [US1] Assemble the primary Waiter dashboard at `apps/pos_flutter/lib/ui/waiter/waiter_ordering_screen.dart`
- [ ] T011 [US1] Add widget test for TableNode states in `apps/pos_flutter/test/ui/table_node_test.dart`
- [ ] T012 [US1] Add widget test for the order taking flow in `apps/pos_flutter/test/ui/waiter_ordering_screen_test.dart`

**Checkpoint**: User Story 1 is functional. The waiter ordering flow is complete and testable offline.

---

## Phase 4: User Story 2 - Cashier Session Control & Checkout (Priority: P2)

**Goal**: Allow cashiers to open/close shifts, view tables needing checkout, split bills, and process payments.

**Independent Test**: Open cashier dashboard, select occupied table, split total by N people or select items, verify math, enter cash amount or card ref, and finalize checkout.

### Implementation for User Story 2

- [ ] T013 [P] [US2] Implement cash float entry and Corte X/Z controls in `apps/pos_flutter/lib/ui/cashier/shift_control_panel.dart`
- [ ] T014 [P] [US2] Implement equal split slider and item checklist selector widget in `apps/pos_flutter/lib/ui/cashier/split_checkout_view.dart`
- [ ] T015 [US2] Create Cashier Dashboard listing active tables needing checkout in `apps/pos_flutter/lib/ui/cashier/cashier_dashboard_screen.dart`
- [ ] T016 [US2] Integrate the split checkout view into Cashier Dashboard for selected table checkout
- [ ] T017 [US2] Add unit test for billing splits math inside `apps/pos_flutter/test/ui/split_checkout_view_test.dart`

**Checkpoint**: User Stories 1 and 2 are integrated. Cashiers can checkout orders created by waiters.

---

## Phase 5: User Story 3 - Operational Status & Print Monitor (Priority: P3)

**Goal**: Display connection status, pending local sync counts, failed print alerts, and support ready notifications.

**Independent Test**: Simulate offline status, check header warnings, open print monitor, retry a failed job, and verify overlay toast notification slides in when food is ready.

### Implementation for User Story 3

- [ ] T018 [P] [US3] Create connection and sync warning header widget `apps/pos_flutter/lib/ui/widgets/offline_status_bar.dart`
- [ ] T019 [P] [US3] Implement floating order-ready toast widget in `apps/pos_flutter/lib/ui/widgets/custom_toast.dart`
- [ ] T020 [US3] Create print queue monitor dashboard with retry action at `apps/pos_flutter/lib/ui/widgets/printer_monitor_panel.dart`
- [ ] T021 [US3] Integrate status bar, overlay toasts, and print monitor triggers into Waiter and Cashier dashboards

**Checkpoint**: Full offline visibility and notifications are integrated.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation, formatting polish, and documentation.

- [ ] T022 Update quickstart.md validation logs
- [ ] T023 Run flutter analyzer and lint checks across all screens
- [ ] T024 Verify all UI interactive elements support keyboard navigation and focus rings

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion. Blocks user stories.
- **User Stories (Phase 3+)**: Depend on Foundational completion. US1 (Waiter) is MVP and should be completed first, followed by US2 (Cashier) and US3 (Status bar).
- **Polish (Phase 6)**: Depends on all user stories being complete.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Setup and Foundational folders and colors.
2. Build `table_node.dart`, `menu_card.dart`, `modifier_dialog.dart`.
3. Assemble `waiter_ordering_screen.dart` and verify order taking works offline.
