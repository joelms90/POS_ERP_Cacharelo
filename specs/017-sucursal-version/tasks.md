# Tasks: Active Sucursal in App Version Badge

**Input**: Design documents from `/specs/017-sucursal-version/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/version-badge.md

**Tests**: Widget coverage is included because configured, unavailable, long-name, and accessibility states are explicit acceptance criteria.

## Phase 1: Setup

- [ ] T001 Create focused widget coverage for version-only, configured-sucursal, blank-sucursal, long-name, and semantic-label states in `apps/pos_flutter/test/ui/app_version_badge_test.dart`

## Phase 2: User Story 1 - Identify the Active Sucursal (Priority: P1) 🎯 MVP

**Goal**: Every configured role dashboard that displays the application version also identifies the terminal's active sucursal.

**Independent Test**: Build the reusable display with a known branch name and open each configured role header to confirm the same branch name is supplied.

- [ ] T002 [US1] Extend the reusable display with an optional sucursal input and accessible combined context in `apps/pos_flutter/lib/ui/widgets/app_version_badge.dart`
- [ ] T003 [US1] Supply `terminalBranchName` to existing configured role-header badge placements in `apps/pos_flutter/lib/ui/waiter/waiter_ordering_screen.dart`, `apps/pos_flutter/lib/ui/cashier/cashier_dashboard_screen.dart`, `apps/pos_flutter/lib/ui/encargado/encargado_dashboard_screen.dart`, and `apps/pos_flutter/lib/ui/kitchen/kitchen_dashboard_screen.dart`
- [ ] T004 [US1] Supply `terminalBranchName` only to the configured terminal login placement while retaining version-only unconfigured login output in `apps/pos_flutter/lib/ui/login_screen.dart`

## Phase 3: User Story 2 - Preserve Setup and Compact Layouts (Priority: P2)

**Goal**: The badge remains useful without a branch name and does not overflow with a long branch name.

**Independent Test**: Render the reusable display at narrow width with blank and long branch names.

- [ ] T005 [US2] Apply flexible, truncation-safe layout behavior for branch text in `apps/pos_flutter/lib/ui/widgets/app_version_badge.dart`

## Phase 4: User Story 3 - Accessible Location Context (Priority: P3)

**Goal**: Assistive technology receives the full application version and configured sucursal name.

**Independent Test**: Assert the badge semantic label includes both values when a branch is configured.

- [ ] T006 [US3] Verify semantic coverage for configured and unavailable branch names in `apps/pos_flutter/test/ui/app_version_badge_test.dart`

## Phase 5: Polish & Validation

- [ ] T007 Update completed task markers and verify the documented scenarios in `specs/017-sucursal-version/tasks.md` and `specs/017-sucursal-version/quickstart.md`
- [ ] T008 Run `flutter test test/ui/app_version_badge_test.dart` and `flutter analyze` from `apps/pos_flutter`

## Dependencies & Execution Order

- T001 defines the reusable behavior and precedes T002.
- T002 precedes the screen integrations in T003–T004.
- T005 and T006 complete responsive and accessibility requirements after T002.
- T007–T008 finish after all implementation tasks.

## Implementation Strategy

1. Deliver the reusable badge and its widget tests first.
2. Wire it to each existing version location using the cached terminal branch name.
3. Validate configured, unconfigured, narrow-layout, and accessibility cases before release.
