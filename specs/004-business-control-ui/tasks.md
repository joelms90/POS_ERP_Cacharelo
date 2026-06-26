# Tasks: Tauri Business Control Admin UI

**Input**: Design documents from `/specs/004-business-control-ui/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Bootstrap Tauri application at `apps/business_control_tauri` using `pnpm create tauri-app --template react-ts --manager pnpm --yes`
- [x] T002 Install Tailwind CSS dependencies (`tailwindcss`, `postcss`, `autoprefixer`) in `apps/business_control_tauri`
- [x] T003 Configure Tailwind design tokens (Obsidian, Onyx, Gold, Bronze) in `apps/business_control_tauri/tailwind.config.js`
- [x] T004 [P] Configure Vite dev server and target build options in `apps/business_control_tauri/vite.config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core UI structure, theme styling, and base layout

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Setup custom fonts (Inter & Bodoni Moda) and Tailwind directives in `apps/business_control_tauri/src/index.css`
- [x] T006 Create basic atom components (Button, Input, Badge, Heading) under `apps/business_control_tauri/src/components/atoms/`
- [x] T007 Create molecule components (FormField, ToastNotification) under `apps/business_control_tauri/src/components/molecules/`
- [x] T008 [P] Implement base API client fetch configurations and host configurations in `apps/business_control_tauri/src/services/api.ts`
- [x] T009 [P] Implement local session storage helper and lock check hook in `apps/business_control_tauri/src/hooks/useAuth.ts`
- [x] T010 Implement global layout template (`AdminLayout` with sidebar, header, and main panel) in `apps/business_control_tauri/src/components/templates/AdminLayout.tsx`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Administrator Authentication (Priority: P1) 🎯 MVP

**Goal**: Secure admin access with password lock screen and session management

**Independent Test**: Launch the app, enter `admin123` password, click unlock, and view the empty dashboard (token saved to local storage).

### Implementation for User Story 1

- [ ] T011 [P] [US1] Create LoginForm organism in `apps/business_control_tauri/src/components/organisms/LoginForm.tsx`
- [ ] T012 [P] [US1] Create LoginPage view component in `apps/business_control_tauri/src/pages/LoginPage.tsx`
- [ ] T013 [US1] Integrate LoginPage with routing controls and locking middleware in `apps/business_control_tauri/src/main.tsx`

**Checkpoint**: At this point, User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Employee Access Provisioning (Priority: P1)

**Goal**: Register, list, and revoke employee PIN access codes

**Independent Test**: Log in as admin, add a new Cashier named "Sofía" with PIN "4321", verify they appear in the grid, and delete them to verify they disappear.

### Implementation for User Story 2

- [ ] T014 [P] [US2] Implement user API endpoints client methods (`getUsers`, `addUser`, `deleteUser`) in `apps/business_control_tauri/src/services/api.ts`
- [ ] T015 [P] [US2] Create UserForm organism for registering employees in `apps/business_control_tauri/src/components/organisms/UserForm.tsx`
- [ ] T016 [P] [US2] Create UsersGrid organism for listing employees in `apps/business_control_tauri/src/components/organisms/UsersGrid.tsx`
- [ ] T017 [US2] Create DashboardPage view component in `apps/business_control_tauri/src/pages/DashboardPage.tsx`
- [ ] T018 [US2] Integrate UserForm and UsersGrid inside DashboardPage and wire mutations to the API client methods.

**Checkpoint**: At this point, User Stories 1 and 2 are fully functional together.

---

## Phase 5: User Story 3 - Sync Server & Database Health Monitoring (Priority: P2)

**Goal**: Display real-time indicators of the sync server status and database connectivity

**Independent Test**: Verify the status bar shows green badge when Node server is active and database verified, and shifts to red when the Node server is stopped.

### Implementation for User Story 3

- [ ] T019 [P] [US3] Implement health check query in `apps/business_control_tauri/src/services/api.ts`
- [ ] T020 [P] [US3] Create StatusIndicator and SystemHealthPanel components in `apps/business_control_tauri/src/components/molecules/StatusIndicator.tsx` and `src/components/organisms/SystemHealthPanel.tsx`
- [ ] T021 [US3] Add StatusIndicator and SystemHealthPanel to the AdminLayout header/sidebar and poll backend status every 10 seconds.

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Native window refinements and packaging

- [ ] T022 Configure Tauri window size constraints (min size 1024x768), native decorations, and application name in `apps/business_control_tauri/src-tauri/tauri.conf.json`
- [ ] T023 Refine visual layout responsive spacing, scrollbars, and hover transitions across all components
- [ ] T024 Write build instructions, requirements, and quickstart notes in `apps/business_control_tauri/README.md`
- [ ] T025 Run quickstart.md validation checks and verify overall visual stability

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion. Can run sequentially or in parallel.
- **Polish (Final Phase)**: Depends on all user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2). No dependencies on other stories.
- **User Story 2 (P2)**: Can start after Foundational (Phase 2). Integrates with US1 session controls.
- **User Story 3 (P3)**: Can start after Foundational (Phase 2). Integrates with AdminLayout dashboard status header.

### Parallel Opportunities

- Setup tasks T003 and T004 can run in parallel.
- Foundational tasks T008 and T009 can run in parallel.
- UI elements LoginForm (US1), UserForm (US2), and UsersGrid (US2) can be designed in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 & 2 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories).
3. Complete Phase 3: User Story 1 (Authentication).
4. Complete Phase 4: User Story 2 (Employee Provisioning).
5. **STOP and VALIDATE**: Confirm admin can log in and successfully register/revoke employee access PINs.
