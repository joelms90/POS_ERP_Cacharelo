# Implementation Plan: Waiter Billing Flow and Ticket Printing

**Branch**: `005-waiter-billing-flow` | **Date**: 2026-06-24 | **Spec**: [spec.md](file:///Users/joelmorales/web/POS-ERP/specs/005-waiter-billing-flow/spec.md)

**Input**: Feature specification from `/specs/005-waiter-billing-flow/spec.md`

## Summary

Implement a new table billing action dialog on the Waiter Ordering Screen's Cart Sidebar that allows the waiter to initiate table checkouts. The flow supports two options:
1. **Efectivo (Cash)**: Mark the table state as `TableState.billing` (Por Cobrar) and print a pre-cuenta ticket formatted for the M58-LL 58mm printer so the comensal can pay at the cashier.
2. **Tarjeta (Card)**: Process the payment directly at the table using a portable terminal. The waiter selects the card brand and enters the last 4 digits of the banking voucher receipt. This immediately processes checkout, marks the table as `TableState.cleaning`, and logs the sale.

Both options generate print jobs format-restricted to 32 monospaced character columns to fit the new M58-LL printer.

## Technical Context

**Language/Version**:
- Client: Flutter 3.19+ / Dart 3.3+

**Primary Dependencies**:
- Frontend: `flutter` SDK, `provider` or `ListenableBuilder` (for `AppState` changes), `uuid` (existing)

**Storage**:
- Local Database (Isar): Uses the existing `PrintJob` queue and `TableModel.state` modifications in the `AppState` class.

**Testing**:
- Unit/Widget Testing: Test the payment dialog options, input validation for voucher number, and formatting output of 32-character receipt lines.
- Integration Testing: Verify table transitions (Occupied -> Billing -> Cleaning) and local print job queuing.

**Target Platform**:
- Android / Windows (Landscape touchscreen tablet layout)

**Project Type**:
- Landscape Tablet POS UI & Local Controller State Machine

**Performance Goals**:
- Frame rate: 60fps on target hardware.
- Pre-cuenta ticket generation and state transition: < 100ms.
- Payment dialog transition latency: < 80ms.

**Constraints**:
- Must be fully functional offline; no blocking network queries.
- Ticket details must not exceed 32 characters in width.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Offline continuity**: PASS. Waiters can select the payment flow, input card details, change table states, and queue print jobs without internet connection.
- **Local authority**: PASS. Table checkout commits immediately to local state and queues a `PrintJob` locally.
- **Sync contract**: PASS. Card checkout leverages the existing `checkoutTable` method in `AppState`, which enqueues a standard offline sync operation with reference code format `"[Brand] - **** [Last4]"`.
- **Cloud role**: PASS. Backend synchronizes the transaction using standard REST API contracts. No database changes are required.
- **Verification**: PASS. We will add a widget test to verify payment method validation and state routing.

## Project Structure

### Documentation (this feature)

```text
specs/005-waiter-billing-flow/
├── spec.md              # Feature specification
├── plan.md              # This file
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Actionable task breakdown
```

### Source Code (Modified Files)

The implementation involves modifying existing files inside `apps/pos_flutter/`:

```text
apps/pos_flutter/lib/
├── ui/
│   ├── common/
│   │   └── app_state.dart              # Modify requestBilling() and add helper for 58mm printing
│   ├── waiter/
│   │   ├── cart_sidebar.dart           # Change "SOLICITAR CUENTA" button to open payment dialog
│   │   ├── waiter_ordering_screen.dart # Handle dialog outcome (Efectivo vs Tarjeta flows)
│   │   └── payment_flow_dialog.dart    # New custom dialog for selecting payment type and entering card details
```

**Structure Decision**:
Place the new `payment_flow_dialog.dart` inside the `ui/waiter/` directory next to the ordering screen files. Modify the `AppState` class in `lib/ui/common/app_state.dart` to support ticket-formatting for 32 columns.

## Complexity Tracking

*No constitution violations detected. Fits within the existing state management and printing architecture.*
