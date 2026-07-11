# Feature Specification: Configurable Fiscal Customer Ticket

**Feature Branch**: `006-fiscal-ticket-config`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "For the final customer ticket, define a valid purchase receipt that includes fiscal business data, operation number, date/time, detailed products/services with prices and taxes, and serves as guarantee/proof of transaction. Ticket configuration must be controlled from the business control site and synced if it changes. Seed mock example data that can later be changed."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Print Compliant Final Ticket (Priority: P1)

As a cashier or waiter completing a customer payment, I need the final printed ticket to include the required business, operation, product, price, and tax information so the customer receives a valid proof of purchase and guarantee.

**Why this priority**: This is the legally and operationally critical customer-facing output. Without it, completed sales may produce incomplete receipts.

**Independent Test**: Complete a paid sale and inspect the final customer ticket. The ticket must include seller identity, fiscal identifier, unique operation number, sale date/time, itemized detail, prices, tax breakdown or "IVA incluido", and total paid.

**Acceptance Scenarios**:

1. **Given** a business has active ticket fiscal settings, **When** a cashier completes a table checkout, **Then** the final customer ticket prints with the configured fiscal business identity, RFC, address/contact details when configured, operation number, date/time, item lines, tax information, payment method, and total.
2. **Given** a waiter completes a card payment at the table, **When** the final customer ticket is generated, **Then** the customer receives the same compliant final-ticket structure as cashier checkout, including the card reference details allowed by existing payment flow.
3. **Given** menu prices are customer-facing IVA-included prices, **When** the final ticket prints, **Then** each customer-visible line remains understandable and the ticket clearly states either item-level included tax or a summary breakdown of net amount, IVA, and total.

---

### User Story 2 - Manage Ticket Fiscal Configuration (Priority: P2)

As a business administrator, I need to configure the fiscal and receipt text for each business or branch from the business control site so tickets can be corrected without changing the POS app.

**Why this priority**: The business needs ownership over legal identity, RFC, address, receipt numbering label, footer notes, and compliance wording.

**Independent Test**: Update ticket settings in the business control site, save them, and verify that a subsequent synced POS ticket uses the updated information.

**Acceptance Scenarios**:

1. **Given** an administrator is editing a branch's ticket settings, **When** they update the legal name, RFC, address, and footer text, **Then** the settings are saved and shown as the active ticket configuration for that branch.
2. **Given** a branch has no custom ticket settings, **When** tickets are printed, **Then** the system uses seeded default settings for the business line so receipts are not blank or incomplete.
3. **Given** an administrator enters an invalid or empty required fiscal field, **When** they try to save, **Then** the system prevents activation of incomplete ticket settings and explains which field is missing.

---

### User Story 3 - Sync Ticket Configuration to Terminals (Priority: P3)

As an offline POS terminal operator, I need ticket configuration changes made in business control to sync to the terminal so final tickets stay current even when the POS operates offline later.

**Why this priority**: Restaurant terminals must continue to print valid tickets during internet interruptions while eventually receiving configuration updates.

**Independent Test**: Change ticket settings while the terminal is offline, reconnect, sync, then complete a sale and verify the new ticket settings are used.

**Acceptance Scenarios**:

1. **Given** the business control site changes ticket settings, **When** a terminal syncs successfully, **Then** the terminal stores and uses the latest active configuration for future final tickets.
2. **Given** the terminal is offline, **When** a final ticket is printed, **Then** it uses the most recently synced active configuration and marks no additional user action as required.
3. **Given** a configuration update fails to sync, **When** the terminal prints a final ticket, **Then** it continues using the previous valid configuration rather than blocking the sale.

---

### Edge Cases

- If the ticket configuration is missing required fiscal data, final ticket printing must fall back to seeded mock defaults and surface a clear administrative warning during sync or configuration review.
- If operation number generation encounters a duplicate, the system must generate or request a new unique operation identifier before finalizing the printed ticket.
- If a ticket is reprinted, the reprint must preserve the original operation number, date/time, item lines, totals, and payment information, and clearly identify itself as a reprint.
- If the business has multiple branches, branch-specific ticket settings take precedence over business-wide defaults.
- If internet drops during checkout, the final ticket still prints with the last valid synced settings, and the sale sync remains queued through existing offline behavior.
- If a configuration edit is made while terminals have pending offline sales, old sales retain their original ticket content and new sales use the new configuration only after sync.
- If an item has discounts or modifiers, the final ticket must show enough detail for the customer to understand the charged amount and included tax.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide configurable final customer ticket settings managed from the business control site.
- **FR-002**: Ticket settings MUST support seller display name, legal name or business name, RFC or fiscal identifier, branch name, branch address, optional phone/contact, and optional footer/legal notes.
- **FR-003**: Ticket settings MUST support a configurable receipt prefix or series label used with a unique operation number.
- **FR-004**: Every final customer ticket MUST include seller information, fiscal identifier, unique operation number, date and time of sale, payment method, itemized purchase detail, tax information, and total paid.
- **FR-005**: The itemized purchase detail MUST include product or service description, quantity, unit price, line total, and modifiers/notes that affect price.
- **FR-006**: The tax section MUST either show net subtotal, IVA amount, and total, or clearly state "IVA incluido" with enough breakdown to satisfy customer-facing proof of purchase expectations.
- **FR-007**: The system MUST treat customer-facing menu prices as IVA-included for waiter/customer interactions and avoid adding IVA again on top of those prices.
- **FR-008**: The final ticket MAY show net prices and included IVA breakdown for cashier/fiscal clarity, but the total charged MUST match the customer-facing IVA-included sale total.
- **FR-009**: Ticket configuration changes MUST sync to POS terminals and replace the active local configuration only after a successful sync.
- **FR-010**: Terminals MUST retain and use the most recently synced valid ticket configuration while offline.
- **FR-011**: The system MUST seed a mock default fiscal ticket configuration for initial use, including realistic placeholder legal name, RFC, branch address, receipt prefix, IVA wording, and footer text.
- **FR-012**: Business control users MUST be able to view, edit, save, and activate ticket configuration for a business or branch.
- **FR-013**: Business control users MUST be prevented from activating ticket settings that omit mandatory fiscal fields.
- **FR-014**: Final ticket reprints MUST preserve the original ticket data and identify the copy as a reprint.
- **FR-015**: The system MUST define synchronization and conflict behavior for ticket configuration changes shared with terminals: the latest valid active configuration wins for future sales, while already completed tickets remain unchanged.
- **FR-016**: The system MUST define offline behavior for checkout: if configuration sync is unavailable, checkout and final ticket printing continue with the last valid local settings.

### Key Entities *(include if feature involves data)*

- **Ticket Fiscal Configuration**: Business or branch-level settings that define legal seller information, RFC/fiscal identifier, branch display data, receipt prefix/series, tax wording, footer notes, and active status.
- **Ticket Snapshot**: Immutable receipt content captured at sale completion, including operation number, fiscal configuration used, sale date/time, itemized lines, tax amounts/wording, payment details, total, and reprint status.
- **Operation Number**: Unique receipt identifier generated per completed sale, using a configured prefix or series and a sequence or equivalent uniqueness rule.
- **Ticket Line Item**: Product or service purchased, including description, quantity, unit price, modifiers or notes that affect price, tax treatment, and line total.
- **Ticket Sync State**: Terminal-local record of the latest valid ticket fiscal configuration and its last successful sync timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of newly completed final customer tickets include seller identity, RFC/fiscal identifier, operation number, date/time, itemized detail, tax information, and total.
- **SC-002**: A business administrator can update and activate branch ticket settings in under 3 minutes after opening the configuration screen.
- **SC-003**: After a successful terminal sync, the next completed sale uses updated ticket configuration without requiring app restart or manual terminal reconfiguration.
- **SC-004**: Terminals can complete and print at least 20 consecutive final tickets while offline using the last valid synced ticket settings.
- **SC-005**: Reprinted tickets match the original ticket snapshot for operation number, date/time, items, taxes, payment, and total in 100% of tested reprint cases.
- **SC-006**: Support incidents for "missing fiscal data on final ticket" are reduced to zero for sales completed after this feature is active and configured.

## Assumptions

- The initial seeded configuration will use mock placeholder data and must be visibly editable from business control before production use.
- Ticket configuration is primarily branch-specific, with business-wide defaults used when a branch does not override them.
- Existing checkout, offline sale queueing, and terminal sync behavior remain in scope and must continue to work.
- Customer-facing prices in the POS menu are considered IVA-included unless a future business rule explicitly marks an item as non-taxable or differently taxed.
- This feature defines receipt content and configuration behavior; formal electronic invoice generation is outside the scope of this feature.
- The legal text supplied by the user is used as business guidance for valid customer proof of purchase, not as a substitute for professional legal or accounting advice.
