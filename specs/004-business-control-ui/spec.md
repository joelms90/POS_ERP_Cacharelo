# Feature Specification: Tauri Business Control Admin UI

**Feature Branch**: `004-business-control-ui`

**Created**: 2026-06-11

**Status**: Draft

**Input**: User description: "lets work on how we are going to control our business check @[apps/sync_api] that is the backend I am thinking we need a proper UI we can use React tauri with typescript and vite `pnpm create tauri-app` and lets use tailwind https://tailwindcss.com/docs/installation/using-vite for our theme lets use atomic components strategy, make the plan and the task in order to achieve this."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Administrator Authentication (Priority: P1)

As a business administrator, I want to authenticate securely with the control panel so that unauthorized staff cannot view credentials or modify employee permissions.

**Why this priority**: Protecting access configuration and credential data (PINs) is critical to business security.

**Independent Test**: Can launch the application, see an authentication lock screen, enter the administrator password, and successfully unlock the administration dashboard.

**Acceptance Scenarios**:

1. **Given** the application is locked, **When** I enter the correct administrator password, **Then** I am granted access to the dashboard.
2. **Given** the application is locked, **When** I enter an incorrect password, **Then** I see a clear error message and remain on the lock screen.
3. **Given** I am on the dashboard, **When** I click "Cerrar Sesión" (Logout), **Then** my session is cleared, and I am returned to the lock screen.

---

### User Story 2 - Employee Access Provisioning (Priority: P1)

As a business administrator, I want to create, view, and revoke login PINs for my employees (Waiters, Cashiers, Kitchen staff) so that I can manage who has access to the POS terminals.

**Why this priority**: Employees cannot access POS tablets or kitchen screens without registered PINs.

**Independent Test**: Can add a new waiter with a unique 4-digit PIN, see them in the employee grid, and subsequently delete them to revoke access.

**Acceptance Scenarios**:

1. **Given** I am on the employee management panel, **When** I submit a new employee named "Sofía" with role "Cashier" and PIN "4321", **Then** the employee is created and displayed in the registered users list.
2. **Given** I am on the employee management panel, **When** I attempt to register a PIN that is already assigned to another employee, **Then** I receive a duplicate PIN error and the registration fails.
3. **Given** I have a registered employee in the list, **When** I click the delete button for that employee and confirm, **Then** the employee is removed from the list and their PIN is invalidated.

---

### User Story 3 - Sync Server & Database Health Monitoring (Priority: P2)

As a business administrator, I want to see the status of the sync server and its database connection so that I can verify if the synchronization system is running properly.

**Why this priority**: Critical for identifying sync issues between local tablets and the server.

**Independent Test**: Displays a clear status indicator showing if the Node server is active and connected to PostgreSQL.

**Acceptance Scenarios**:

1. **Given** the sync server is running and database connection is healthy, **When** I view the dashboard header, **Then** I see a green indicator showing the server is active and database is connected.
2. **Given** the sync server is unreachable or offline, **When** the application tries to load, **Then** I see a persistent warning banner indicating connection failure.

---

### User Story 4 - Restaurant Sales Intelligence Dashboard (Priority: P1)

As a restaurant owner or manager, I want the Reports section to summarize the most important business health metrics so that I can make daily decisions without manually reconciling raw POS data.

**Why this priority**: The current sales dashboard mixes order-level totals and item-level sales in a way that can produce confusing results. For example, a weekly response can show `totalSales = 886` while product-level sales sum much higher because closed zero-total orders still contribute item rows. Reports must use one clear accounting basis.

**Independent Test**: Request `/api/reports/sales-dashboard` for a known date range and verify that gross sales, net sales, item sales, payments, and branch/user totals reconcile within rounding tolerance.

**Acceptance Scenarios**:

1. **Given** closed orders with line items and payments, **When** the sales dashboard loads, **Then** the KPI cards show reconciled gross sales, discounts, net sales collected, order count, average check, item count, payment mix, and contribution margin.
2. **Given** a closed order has no successful payment or a zero total, **When** reports aggregate product performance, **Then** the row is flagged or excluded according to the selected accounting basis instead of silently inflating product revenue.
3. **Given** the business operates in Mexico, **When** hourly sales are displayed, **Then** the hour buckets use the configured business timezone instead of Cloud Run server UTC.
4. **Given** a metric is not supported by the current data model, **When** the dashboard displays it, **Then** it is labeled as pending data capture rather than presented as a real value.

---

### Edge Cases

- **Connection Drop**: If the network connection to `sync_api` is lost while the administrator is editing user access, the UI must display a connection error alert and disable edit actions rather than silently failing or hanging.
- **PIN Format Violations**: The UI must prevent submitting PINs that are not exactly 4 digits or contain non-numeric characters, notifying the user immediately on the form.
- **Concurrent DB Modifications**: If another administrator modifies the database, the employee list should support manual refresh to sync with the current backend state.
- **Server Database Configuration Errors**: If the backend server fails to connect to PostgreSQL and is using JSON fallback, the UI should display a status warning so the administrator is aware that data is not persisting to the main database.
- **Unpaid Closed Orders**: Closed orders with `total = 0`, missing payments, or payment totals that do not match order totals must be surfaced as reconciliation exceptions in reports.
- **Timezone Drift**: Date-range filters and hourly buckets must consistently use the business timezone (`America/Mexico_City` by default) so management views match the restaurant day.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST authenticate the administrator using the server-configured admin password.
- **FR-002**: System MUST allow registering employees with a name, a unique 4-digit numeric PIN, and a role.
- **FR-003**: Roles MUST be restricted to: Waiter (Mesero), Cashier (Cajero), and Kitchen (Pantalla Cocina).
- **FR-004**: System MUST display a list of all registered employees showing name, role, and PIN.
- **FR-005**: System MUST allow revoking an employee's access (deleting them) with a confirmation dialog.
- **FR-006**: System MUST show a real-time status indicator of the sync server backend and database connectivity.
- **FR-007**: System MUST validate PIN inputs on the client side (numeric, length 4) before making API calls.
- **FR-008**: System MUST secure all employee-related API requests by attaching the administrator authorization token.
- **FR-009**: Reports MUST reconcile order totals, item totals, and payment totals, returning explicit exception counts when they differ.
- **FR-010**: Reports MUST distinguish gross sales, discounts, taxes, net sales, collected payments, and contribution margin.
- **FR-011**: Reports MUST compute hourly sales using a business timezone parameter or stored business timezone.
- **FR-012**: Reports MUST limit Top Products to top 10 by default while supporting sorting by quantity, revenue, and contribution margin.
- **FR-013**: Reports MUST mark unsupported metrics as pending data capture instead of displaying fabricated values.

### Key Entities

- **Administrator Session**: Tracks the active auth token and authentication state of the admin.
- **Employee Access Card**: Represents a user profile in the system. Attributes: `id` (UUID), `name` (string), `pin` (4-digit string), `role` (waiter/cashier/kitchen).
- **Server Status**: State of the backend server. Attributes: `apiConnected` (boolean), `databaseConnected` (boolean), `databaseType` (PostgreSQL or local JSON).
- **Sales Dashboard Summary**: Aggregated restaurant KPIs for a date range. Attributes: `grossSales`, `discounts`, `taxes`, `netSales`, `collectedSales`, `ordersCount`, `itemsCount`, `averageCheck`, `contributionMargin`, `paymentMix`, `reconciliation`.
- **Product Performance Row**: Menu item ranking. Attributes: `productId`, `name`, `sku`, `quantitySold`, `grossSales`, `netSales`, `estimatedCogs`, `contributionMargin`, `marginPercent`.
- **Operational Metric Status**: Metadata for metrics that require additional data capture. Attributes: `metric`, `status` (`available` or `needs_data`), `missingFields`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Load time of the employee roster from a healthy backend must be under 1.5 seconds.
- **SC-002**: 100% of invalid inputs (non-numeric, short PINs, missing names) are blocked on the client side without executing an API request.
- **SC-003**: Access revocation propagates to the backend database within 1.0 second under normal network latency.
- **SC-004**: Network disconnects are detected and displayed as an alert banner in less than 3 seconds.
- **SC-005**: Admin token is stored securely in local app storage to persist session across application restarts (unless logged out).
- **SC-006**: For any sales dashboard response, `salesByBranch.totalSales` MUST equal the selected total-sales KPI within MXN 0.01.
- **SC-007**: Product revenue totals MUST either reconcile to order/payment totals within MXN 0.01 or return a non-zero `reconciliation.exceptionsCount` with detail rows.
- **SC-008**: Hourly sales buckets MUST match `America/Mexico_City` local business hours for the requested range.

## Reports Intelligence Roadmap

### Metrics Available With Current Data

- Gross sales, discounts, taxes, net order sales, and order count from `orders`.
- Collected sales and payment mix from `payments`.
- Average check size from collected or net order sales divided by closed paid orders.
- Menu item velocity and contribution margin from `order_items.price`, `order_items.quantity`, and `products.cost`.
- Branch and waiter/cashier sales rankings from `orders`, `branches`, and `users`.
- Hourly sales using order/payment timestamps after timezone normalization.
- Kitchen ticket speed from `kitchen_tickets.createdAt`, `startedAt`, `readyAt`, and `servedAt`.
- Inventory on hand, stock value, below-minimum stock, and Kardex from stock and inventory movement tables.

### Metrics Requiring Data Capture

- Net sales by channel requires an order `channel` field and delivery/third-party commission fields.
- Labor cost percentage requires shift-level payroll or hourly rate records by employee and role.
- PPA / covers requires guest count per order, not only `assignedGuest` on individual items.
- RevPASH requires seat capacity by branch/table and occupied-seat-hour tracking.
- Average dining duration requires seated/opened/billing/closed timestamps on orders or table sessions.
- Actual vs theoretical food-cost variance requires recipe depletion snapshots, purchase costs, and physical count adjustments by period.

### Reporting TODOs

- TODO: Redesign `/api/reports/sales-dashboard` response around reconciled summary sections: `financial`, `operations`, `menu`, `staff`, `inventory`, and `reconciliation`.
- TODO: Use payments as the primary collected-sales basis and return order-total vs payment-total exceptions.
- TODO: Remove inactive-product filtering from historical item sales or include historical product names so old sales do not disappear when a product is deactivated.
- TODO: Add timezone-aware date bucketing. Default to `America/Mexico_City` until business timezone is stored.
- TODO: Add report UI cards for Gross Sales, Net Sales, Collected Sales, Discounts, Taxes, Average Check, Contribution Margin, Payment Mix, Item Velocity, and Reconciliation Exceptions.
- TODO: Add a "Needs data capture" panel for Prime Cost, Labor Cost %, PPA, RevPASH, Dining Duration, and Actual vs Theoretical Food Cost Variance.
- TODO: Add backend tests with a fixture containing paid orders, zero-total closed orders, inactive products, multiple payment methods, and Mexico-time hourly boundaries.

## Catalog Bulk Import Classification Rules

In catalog bulk imports, all uploaded products are classified as **Insumos** (Ingredients/Supplies) by default to prevent raw materials from cluttering the sales menu. 

- **Default Classification**: 
  - `isSellable` is set to `false` (cannot be sold directly at the POS checkout).
  - `isIngredient` is set to `true` (available for inventory tracking and recipes).
- **Venta Override ("Para Venta" column)**: 
  - To classify an item as a finished product for sale, the Excel/CSV sheet must contain a column named **`Para Venta`** (or **`Venta`** / **`Es Venta`**).
  - If the cell value is explicitly set to `SI`, `S`, `YES`, `Y`, `TRUE`, or `1` (case-insensitive), the item is created with:
    - `isSellable = true`
    - `isIngredient = false`

## Assumptions

- The sync backend (`apps/sync_api`) is already running and exposes the endpoints `/api/auth/admin`, `/api/users`, and `/api/auth/login`.
- The application will be packaged as a cross-platform desktop application using Tauri.
- The administrator's system has a screen size of at least 1024x768 (desktop optimized layout).
