# Feature Specification: Waiter and Cashier Application Screens

**Feature Branch**: `003-waiter-cashier-screens`

**Created**: 2026-06-02

**Status**: Approved

**Input**: User description: "I want that you give me a spec for desigining the application screens for the waiter, cashier"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Waiter Table Layout & Order Taking (Priority: P1)

As a waiter, I want to unlock the POS device with my PIN or fingerprint, view the real-time status of dining zones, assign customers to tables, and take custom orders at the table, so that I can serve customers efficiently even when the network is offline.

**Why this priority**: Order taking is the front line of restaurant operations. Its continuity determines the speed of service and guest satisfaction.

**Independent Test**: Put the application in offline mode, unlock using a cached PIN, navigate dining zones, select an empty table, add items from categories (e.g. Pastes, Hamburgers) with modifiers, verify total calculation, and submit the order. The order must be saved locally with UUID v4 and a kitchen print job must be queued.

**Acceptance Scenarios**:

1. **Given** the waiter is logged out, **When** they enter their PIN or use biometrics, **Then** they are logged in using cached credentials and shown the zone-based table layout.
2. **Given** the waiter is viewing the table layout, **When** they tap on an empty table, **Then** they can assign the number of guests and open a new order, transitioning the table's state to "Occupied".
3. **Given** an open order at a table, **When** the waiter taps "Agregar Ítems", **Then** they see a categorized menu grid with search and modifier selectors (e.g. extra toppings, preparation notes).
4. **Given** an order is composed, **When** the waiter taps "Confirmar Comanda", **Then** the local database commits the transaction, and the system queues print jobs for the kitchen/bar thermal printers.

---

### User Story 2 - Cashier Session Control & Checkout (Priority: P2)

As a cashier, I want to manage my cash register drawer, view all tables requesting billing, split bills, apply discounts, and process payments using cash or card references, so that checkout is fast, accurate, and offline-resilient.

**Why this priority**: Billing and cashier sessions are necessary to secure restaurant cash flow and close the transaction lifecycle.

**Independent Test**: Open the cashier dashboard, select a table marked as "Billing", initiate checkout, select a payment method, apply a 10% discount, complete the sale, and print the receipt. Verify that cash drawer controls are accessible and active sales are tracked.

**Acceptance Scenarios**:

1. **Given** a cashier starts their shift, **When** they open the app, **Then** they must enter the initial cash drawer amount to unlock the checkout actions.
2. **Given** tables are currently occupied, **When** a table is marked as "Billing" (either by waiter or cashier), **Then** it highlights in bronze gold in the cashier dashboard with a flashing notification indicator.
3. **Given** a table checkout flow, **When** the cashier selects "Dividir Cuenta", **Then** they can choose to split equally by number of people or assign specific items to separate sub-bills.
4. **Given** an offline checkout, **When** card payment is selected, **Then** the UI prompts the cashier to enter a manual transaction reference from the external physical card terminal.

---

### User Story 3 - Operational Status & Print Monitor (Priority: P3)

As a restaurant manager or operator, I want a persistent system status monitor that displays the count of unsynced local transactions and any failed or pending print jobs, so that we have complete visibility into the system's operational health.

**Why this priority**: Helps operators diagnose connection and hardware issues immediately, avoiding lost orders or double billing.

**Independent Test**: Disconnect the network, make two sales, fail a print job by powering off a printer, and check the status indicator. The status panel must display "2 ventas pendientes de sincronizar" and "1 comanda fallida". Re-enable print and tap "Reintentar" to verify reprint.

**Acceptance Scenarios**:

1. **Given** the user is on any main application screen, **When** transactions are pending sync, **Then** a subtle status bar at the top or bottom displays the count of pending syncs in yellow-gold.
2. **Given** a printer has run out of paper or lost connection, **When** a comanda or receipt print job fails, **Then** a floating alert badge appears next to the settings icon, indicating a failed print job.
3. **Given** a failed print job, **When** the user taps the print queue monitor, **Then** they can view the ticket details and tap "Reintentar Impresión" or "Reasignar Impresora" to redirect it.

---

### Edge Cases

- **Offline PIN mismatch**: A waiter attempts to login with a PIN that was changed on the cloud database but has not yet synced to the local cache. (System MUST authenticate with the local cached hash and log a sync-warning once reconnected).
- **Simultaneous Table Updates**: A waiter adds items to Table 5 while another waiter tries to checkout Table 5 on a different device. (System MUST reconcile items using local version numbers or prompt for merge confirmation during sync).
- **Printer paper runs out mid-ticket**: The receipt prints partially and the printer reports an error. (System MUST preserve the transaction as successful and mark the print job as "failed", allowing the cashier to reprint to a backup printer).
- **Sudden device shutdown**: The tablet battery dies exactly as the cashier hits "Finalizar Pago". (Since transaction is written in Isar before success callback, the sale MUST recover as completed/pending sync upon next boot).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The user interface MUST adhere to the "Empire Noir" design language, featuring deep obsidian backgrounds (#0B0B0C), Champagne Gold accents (#D4AF37), Aged Bronze outlines (#8C7853), Bodoni Moda typography for headers, and Inter for controls/body.
- **FR-002**: Screen elements MUST have comfortable touch targets (minimum 48x48 dp) optimized for high-volume service on 8" to 10" Android tablets and Windows touchscreen terminals.
- **FR-003**: The Waiter interface MUST support zone classification (e.g. "Salón Principal", "Terraza", "Bar") with distinct tab switches.
- **FR-004**: The Table Map screen MUST dynamically render table shapes (circle, square) and colors reflecting their states: Free (bronze outline), Occupied (gold fill), Billing (flashing gold highlight), and Cleaning (neutral grey outline).
- **FR-005**: The Menu Ordering screen MUST group items by brand categories (e.g. Pastes, Hamburguesas) based on local JSON structures.
- **FR-006**: Item customization dialogs MUST support multi-select checkbox grids for modifiers and a text field for special kitchen instructions.
- **FR-007**: The Cashier Dashboard MUST feature a permanent Sidebar showing Cash Session Status, Cash-in/Cash-out, and shift reports (X/Z Reports).
- **FR-008**: The Checkout screen MUST allow payment splitting by quantity of people (split totals) or item-level distribution (seat-based).
- **FR-009**: The Payment interface MUST display clear input validation for offline cash transactions (calculating exact change) and manual reference code entries for card transactions.
- **FR-010**: A persistent Status Header MUST display real-time synchronization state (Online/Offline) and the count of pending local sync operations.
- **FR-011**: A dedicated Printer Queue Monitor page MUST show all ESC/POS print jobs, their targets (Kitchen, Bar, cashier), and state (Queued, Printing, Printed, Failed), with individual retry buttons.

### Key Entities

- **Zone**: Represents a physical area of the restaurant containing a collection of tables.
- **TableState**: Represents a table’s operational status (Free, Occupied, Billing, Cleaning).
- **Cart**: Ephemeral local container for items being ordered before commitment.
- **CashSession**: Local shift log detailing cashier identity, opening float, cash drops, sales summaries, and closing cash counts.
- **SplitBill**: Sub-structure representing a partitioned subset of an order's items and total.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A waiter can open a table, add 5 items with modifiers, and submit the order in under 15 seconds.
- **SC-002**: A cashier can perform a split checkout (divided between cash and manual card reference) and print the receipt in under 30 seconds.
- **SC-003**: Navigating between zones and loading the table layout grid takes less than 150ms on standard 1.8GHz processor devices.
- **SC-004**: When offline, 100% of UI operations (table state changes, orders, billing) continue without showing modal blocker loaders or network timeouts.

## Assumptions

- **A-001**: The physical tablets used by waiters are 16:9 or 16:10 aspect ratio and are held in landscape orientation by default.
- **A-002**: Local printer discovery and status reports depend on the ESC/POS printing service configured in Phase 5.
- **A-003**: The menu configuration and items are cached locally from the cloud, and inventory values represent the latest known online sync state.

---

## Design Decisions (Clarifications Resolved)

- **Table Layout Presentation**: **Option B - Graphical Coordinate Map** (draggable table items representing actual floor plan coordinates to provide intuitive spatial representation).
- **Kitchen/Bar Ready Notifications**: **Option A - Visual Tab Badge + Floating Toast** (subtle visual indicator, counts on a 'Ready' tab with a fading pop-up card for immediate waiter feedback).
- **Split Billing Interface**: **Option A - Numeric Equal Split + Item Selection** (allow cashiers to split total bill equally by N or checkout selected items separately; balances 90% of restaurant billing splits with efficient, clean UI).
