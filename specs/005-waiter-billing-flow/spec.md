# Feature Specification: Waiter Billing Flow and Ticket Printing

**Feature Branch**: `005-waiter-billing-flow`

**Created**: 2026-06-24

**Status**: Proposed

**Input**: User description: "the current @[apps/pos_flutter] app was good for the client there are some improvemntes we need to make first the waiter can send to print the ticket so the comensal can pay at caja, the waiter will have 2 payments flow efectivo and tarjeta (tarjeta will tell him what type of card and make him save the last 4 digits of the voucher, when efectivo it will print a ticket for the user so he can take and he has to pay at caja witht he cashier). Make the plan for this I have a M58-LL THERMAL PRINTER BRAND NEW"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Waiter Ticket Printing for Caja (Priority: P1)

As a waiter, I want to request the pre-cuenta (ticket) for an occupied table to print on the M58-LL thermal printer, so that the customer can take it to the caja (cashier register) and pay.

**Why this priority**: It is the default billing workflow for cash-paying customers. Printing the pre-cuenta is required before checkout can be performed.

**Independent Test**:
1. Select an occupied table in the Waiter ordering screen.
2. Tap "Cobrar Cuenta".
3. Select "Efectivo (Pagar en Caja)" payment flow.
4. Tap "Imprimir Ticket y Enviar a Caja".
5. Verify that the table state transitions to "Billing" (Por Cobrar), that the waiter's active table selection is cleared, and that a print job is queued with the monospaced layout optimized for a 58mm thermal printer (maximum 32 characters wide).

**Acceptance Scenarios**:
1. **Given** a table is in "Occupied" state, **When** the waiter taps "Cobrar Cuenta", **Then** the waiter is prompted to choose between Cash (Efectivo) and Card (Tarjeta) payment flows.
2. **Given** the waiter chooses "Efectivo (Pagar en Caja)", **When** they tap "Imprimir Ticket y Enviar a Caja", **Then** the system queues a pre-cuenta ticket print job, changes the table state to "Billing", and redirects the waiter back to the Floor Map.
3. **Given** the pre-cuenta print job, **When** formatting the ticket details, **Then** all rows must be structured to fit within 32 columns (e.g. 58mm paper size constraints) to prevent layout wrapping or clipping.

---

### User Story 2 - Waiter Card Payment Checkout (Priority: P2)

As a waiter, I want to process card payments directly at the table using a portable terminal by recording the card brand and the voucher's last 4 digits, so that the customer can pay immediately at the table and the table is closed/freed.

**Why this priority**: Enhances the checkout process for card payments, preventing guests from standing in line at the cashier and optimizing table turnover.

**Independent Test**:
1. Select an occupied table in the Waiter ordering screen.
2. Tap "Cobrar Cuenta".
3. Select "Tarjeta (Pago en Mesa)" payment flow.
4. Select card type (e.g., Visa, Mastercard, American Express, etc.) and enter a 4-digit voucher number.
5. Tap "Procesar Pago con Tarjeta".
6. Verify that the table state transitions to "Cleaning" (Limpieza), that the waiter's active selection is cleared, and that a card checkout print job is queued confirming the card details.

**Acceptance Scenarios**:
1. **Given** the waiter selects the "Tarjeta" payment flow in the billing dialog, **When** they attempt to finalize, **Then** the "Procesar Pago con Tarjeta" button is disabled until they select a card type and enter exactly 4 digits for the voucher reference.
2. **Given** a valid card type and voucher reference are entered, **When** the waiter taps "Procesar Pago con Tarjeta", **Then** the system records the transaction, prints a card checkout receipt with the card details, transitions the table state to "Cleaning", and returns the waiter to the Floor Map.

---

### Edge Cases

- **Printer Offline/Disconnected**: If the M58-LL printer is turned off or disconnected when the waiter requests a print job:
  - The payment transaction or billing state transition MUST still succeed locally in the state.
  - The print job is marked as "failed" in the printer queue.
  - A notification toast appears, and the waiter/cashier can retry printing the ticket from the global Printer Monitor Panel once the hardware issue is resolved.
- **Card Transaction Reference Mismatch**: The waiter enters a non-numeric string or less than 4 digits in the voucher field. (The UI validation MUST block finalization and display a helper error message until exactly 4 digits are input).
- **Simultaneous Edit and Billing**: A waiter edits Table 5 items while another waiter tries to process a card payment checkout for Table 5. (The system must evaluate table version/state and block checkout if unsaved cart items exist, forcing the waiter to either confirm or discard changes first).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Waiter app MUST display a "Cobrar Cuenta" action button in the Cart Sidebar instead of "SOLICITAR CUENTA (POR COBRAR)" when the table is occupied.
- **FR-002**: Tapping "Cobrar Cuenta" MUST present a payment flow dialog with two options: "Efectivo (Pagar en Caja)" and "Tarjeta (Pago en Mesa)".
- **FR-003**: The Cash payment flow MUST print a 58mm pre-cuenta ticket containing the restaurant title, date/time, table label, waiter name, itemized orders (with quantities, modifiers, and prices), subtotal, IVA (16%), total, and a clear message: "FAVOR DE PAGAR EN CAJA".
- **FR-004**: The Card payment flow MUST prompt the waiter to select a card brand (e.g., Visa, Mastercard, AMEX, Carnet) and input the last 4 digits of the banking voucher receipt.
- **FR-005**: All ticket details formatted for printing MUST be restricted to a maximum width of 32 characters per line to support the brand-new M58-LL 58mm thermal printer.
- **FR-006**: Submitting Cash payment billing MUST transition the table state to `TableState.billing`.
- **FR-007**: Submitting Card payment checkout MUST transition the table state to `TableState.cleaning` and add the sale amount to the current shift totals (if cash drawer adjustments or reports track all payments).
- **FR-008**: The card payment record MUST capture the card brand and voucher last 4 digits, transmitting them as payment reference details (`refCode` format: `"[Brand] - **** [Last4]"`) upon checkout.

### Key Entities

- **PaymentMethod**: Represents the selected payment type: Cash (`efectivo`) or Card (`tarjeta`).
- **CardPaymentDetails**: Temporary container holding the selected card brand (Visa, Mastercard, etc.) and the 4-digit voucher code.
- **PrintJob**: The print model configured with formatting constraints for the M58-LL printer target.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The waiter can request a pre-cuenta ticket print for cash payments in under 5 seconds (from floor map to print confirmation).
- **SC-002**: The waiter can complete a card payment checkout at the table, capturing the card details, in under 12 seconds.
- **SC-003**: All print jobs generated for the M58-LL printer MUST render with no character clipping or line-wrapping errors (lines strictly ≤ 32 chars).
- **SC-004**: Running entirely offline, the billing flow can mark tables and queue print jobs immediately without lagging or blocking the user interface.

## Assumptions

- **A-001**: The M58-LL printer uses standard ESC/POS commands and has a default line capacity of 32 characters (58mm width paper).
- **A-002**: Waiters have access to handheld card payment terminals (terminal bancaria) to swipe/insert cards at the table before entering voucher codes.
- **A-003**: Transactions processed via card do not add physical cash to the cashier drawer but are tracked under credit/debit transaction logs.
