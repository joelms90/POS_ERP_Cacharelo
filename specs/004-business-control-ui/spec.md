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

### Edge Cases

- **Connection Drop**: If the network connection to `sync_api` is lost while the administrator is editing user access, the UI must display a connection error alert and disable edit actions rather than silently failing or hanging.
- **PIN Format Violations**: The UI must prevent submitting PINs that are not exactly 4 digits or contain non-numeric characters, notifying the user immediately on the form.
- **Concurrent DB Modifications**: If another administrator modifies the database, the employee list should support manual refresh to sync with the current backend state.
- **Server Database Configuration Errors**: If the backend server fails to connect to PostgreSQL and is using JSON fallback, the UI should display a status warning so the administrator is aware that data is not persisting to the main database.

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

### Key Entities

- **Administrator Session**: Tracks the active auth token and authentication state of the admin.
- **Employee Access Card**: Represents a user profile in the system. Attributes: `id` (UUID), `name` (string), `pin` (4-digit string), `role` (waiter/cashier/kitchen).
- **Server Status**: State of the backend server. Attributes: `apiConnected` (boolean), `databaseConnected` (boolean), `databaseType` (PostgreSQL or local JSON).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Load time of the employee roster from a healthy backend must be under 1.5 seconds.
- **SC-002**: 100% of invalid inputs (non-numeric, short PINs, missing names) are blocked on the client side without executing an API request.
- **SC-003**: Access revocation propagates to the backend database within 1.0 second under normal network latency.
- **SC-004**: Network disconnects are detected and displayed as an alert banner in less than 3 seconds.
- **SC-005**: Admin token is stored securely in local app storage to persist session across application restarts (unless logged out).

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
