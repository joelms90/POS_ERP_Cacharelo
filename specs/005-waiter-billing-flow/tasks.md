# Tasks: Waiter Billing Flow and Ticket Printing

**Input**: Design documents from `/specs/005-waiter-billing-flow/`

**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup & Foundational (Blocking Prerequisites)

**Purpose**: Core logic and shared formatting rules for the 58mm printer.

- [x] T001 Implement print-formatting helpers in `apps/pos_flutter/lib/ui/common/app_state.dart` to support 32-column line formatting (centering, column padding, item dividers) optimized for the M58-LL 58mm thermal printer.

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 2: User Story 1 - Waiter Ticket Printing for Caja (Priority: P1) 🎯 MVP

**Goal**: Allow waiters to print 58mm pre-cuenta tickets and mark tables as "Billing" (Por Cobrar) so they can pay at the cashier register.

**Independent Test**: Put the app in offline mode, select an occupied table, click "Cobrar Cuenta", choose "Efectivo", and tap print. Verify a print job is queued with standard 32-column formatting and the table state becomes "Billing".

### Implementation for User Story 1

- [x] T002 [P] [US1] Create the payment selection dialog base skeleton at `apps/pos_flutter/lib/ui/waiter/payment_flow_dialog.dart`.
- [x] T003 [US1] Implement "Efectivo" payment flow in `payment_flow_dialog.dart` which:
  - Formats and enqueues a monospaced 32-character wide pre-cuenta `PrintJob`.
  - Calls `requestBilling(tableId)` in `AppState`.
- [x] T004 [US1] Replace the "SOLICITAR CUENTA" button in `apps/pos_flutter/lib/ui/waiter/cart_sidebar.dart` with "COBRAR CUENTA", calling the new payment flow dialog.
- [x] T005 [US1] Update `apps/pos_flutter/lib/ui/waiter/waiter_ordering_screen.dart` to handle the billing dialog return, clearing active selections and displaying confirmation toasts.

**Checkpoint**: User Story 1 is functional. Waiters can print tickets for cash customers to pay at the register.

---

## Phase 3: User Story 2 - Waiter Card Payment Checkout (Priority: P2)

**Goal**: Allow waiters to perform card payment checkouts directly at the table using portable terminals by logging card brand and voucher last 4 digits.

**Independent Test**: Select an occupied table, click "Cobrar Cuenta", choose "Tarjeta", select Visa, enter "1234", and tap process. Verify checkout is recorded, a 32-column receipt prints, and the table transitions to "Cleaning".

### Implementation for User Story 2

- [x] T006 [US2] Add ChoiceChips for card brand selection (Visa, Mastercard, AMEX, Carnet) and a 4-digit TextField for the voucher code in `apps/pos_flutter/lib/ui/waiter/payment_flow_dialog.dart`.
- [x] T007 [US2] Implement Card payment finalization in `payment_flow_dialog.dart` which:
  - Validates card selections and voucher length.
  - Calls `checkoutTable` in `AppState` with reference code `"[Brand] - **** [Last4]"`.
  - Enqueues a monospaced card payment receipt `PrintJob` for the printer.
  - Returns the waiter to the Floor Map.

**Checkpoint**: User Story 2 is functional. Waiters can checkout card customers at the table.

---

## Phase 4: Polish & Verification

**Purpose**: Quality checks, automated tests, and formatting polish.

- [x] T008 [P] Add widget tests in `apps/pos_flutter/test/ui/waiter_billing_flow_test.dart` to verify payment dialog input validation and card/cash flow routing.
- [x] T009 Run `flutter analyze` and verification checks on `apps/pos_flutter`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: Must be completed first to provide standard ticket formatting helpers.
- **User Story 1 (Phase 2)**: Core cash-caja flow. Can run after Foundational completion.
- **User Story 2 (Phase 3)**: Card-table flow. Extends the payment dialog built in US1.
- **Polish (Phase 4)**: Runs after both stories are complete.
