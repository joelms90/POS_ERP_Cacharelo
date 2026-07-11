# Tasks: Multi-Role User Support

**Input**: Design documents from `/specs/010-multi-role-users/`

**Prerequisites**: plan.md (required), spec.md (required)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Verify project structure and branch config for multi-role branch setup

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure changes that must be complete before any user story can be implemented

- [X] T002 Update schema definition in `apps/sync_api/src/database/schema.ts` to support roles list column (JSONB format) on `users` table
- [X] T003 Generate and execute database migration scripts on GCE VM to update `users` table column structure
- [X] T004 Update JWT token serialization in `apps/sync_api/src/modules/auth/auth.service.ts` to embed roles list collection
- [X] T005 Update role validation guards in NestJS backend controllers to support array-membership verification
- [X] T006 Update offline user credentials cache in `apps/pos_flutter/lib/services/secure_storage_service.dart` to support role lists

---

## Phase 3: User Story 1 - Flutter PIN Keypad & Role Selection (Priority: P1) 🎯 MVP

**Goal**: Enable POS operators to select their active session role upon successful PIN entry.

**Independent Test**: Log in using a multi-role user PIN. Verify the keypad triggers the role selection modal and loading the chosen dashboard sets the local `currentUserRole` and socket parameters correctly.

### Implementation for User Story 1

- [X] T007 [P] [US1] Update role parsing logic in `apps/pos_flutter/lib/ui/common/app_state.dart` to read and parse roles list array
- [X] T008 [P] [US1] Create a role selection dialog component inside `apps/pos_flutter/lib/ui/login_screen.dart`
- [X] T009 [US1] Update PIN entry validation callback in `apps/pos_flutter/lib/ui/login_screen.dart` to display role selection dialog if user contains multiple roles
- [X] T010 [US1] Pass the chosen active role as query parameter during WebSocket handshake initialization in `apps/pos_flutter/lib/ui/common/app_state.dart`

**Checkpoint**: At this point, User Story 1 (PIN Login and Role Selection) should be fully functional on POS devices.

---

## Phase 4: User Story 2 - Operator Administration in Business Control (Priority: P2)

**Goal**: Enable administrators to check and assign multiple roles to operators.

**Independent Test**: Open operator forms, select both Cashier and Waiter roles, save, and check if both badges render on the dashboard operator grid.

### Implementation for User Story 2

- [X] T011 [P] [US2] Replace single role dropdown with check boxes in operator form `apps/business_control_tauri/src/components/organisms/UserForm.tsx`
- [X] T012 [P] [US2] Update operator display cards in `apps/business_control_tauri/src/components/organisms/UsersGrid.tsx` to render multiple Badges

**Checkpoint**: User Story 2 is functional; admins can configure multi-role operators.

---

## Phase 5: User Story 3 - POS Simulator Waiters Filter (Priority: P3)

**Goal**: Align POS simulator waiter filtering with the new roles list representation.

**Independent Test**: Load the POS Simulator in Business Control, and check if the waiter dropdown displays all operators assigned the "waiter" role.

### Implementation for User Story 3

- [X] T013 [US3] Update active waiters query filters in `apps/business_control_tauri/src/pages/PosSimulatorPage.tsx` to check user roles array list

**Checkpoint**: All user stories functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality checks and optimizations

- [ ] T014 Run full Dart analysis compiler checks (`flutter analyze`) on terminal client
- [X] T015 Run Tauri build/linter validations on the Business Control portal
- [ ] T016 Validate E2E role selection offline resilience and WebSocket sync checks
