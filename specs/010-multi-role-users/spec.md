# Feature Specification: Multi-Role User Support

**Feature Branch**: `010-multi-role-users`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "plan how big of a change will be that each user supports multi role, and for the flutter app when entering they need to choose the rol they are entering."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - PIN Login with Role Selection Modal in Flutter (Priority: P1)

As a multi-role POS operator (e.g. waiter and cashier), when I input my PIN on the terminal keypad, I need the app to prompt me to choose my desired session role so that I can operate in the correct layout (waiter vs cashier dashboard) with the corresponding permissions.

**Why this priority**: Crucial entry gate for operators. If a user cannot choose their role at login, they cannot use the POS with their different functions.

**Independent Test**: Log in with a user configured with multiple roles (e.g. `['waiter', 'cashier']`). A modal dialog should appear showing "Select your role for this session" with options "Waiter" and "Cashier". Selecting "Cashier" loads the Cashier Dashboard; selecting "Waiter" loads the Waiter Ordering Screen.

**Acceptance Scenarios**:

1. **Given** a user has only one role, **When** they type their PIN, **Then** they bypass the role selection dialog and land directly on their corresponding layout.
2. **Given** a user has multiple roles, **When** they type their PIN, **Then** the keypad clears, and a modal role selector is shown. Selecting a role completes the login, initializes the WebSocket passing `role=<chosen_role>`, and loads the corresponding dashboard.
3. **Given** a user has multiple roles, **When** they are on the role selection modal and click "Cancel", **Then** they are returned to the PIN keypad screen.

---

### User Story 2 - Multi-Role Operator Administration in Business Control (Priority: P2)

As a restaurant owner, when managing operators in the Business Control portal, I need to assign multiple roles to a single operator using checkboxes so that their credentials work for all their jobs.

**Why this priority**: Required to configure multi-role users in the database; without this, admins cannot assign multiple roles to staff.

**Independent Test**: Open the operator creation form in Business Control, fill in details, select both "Mesero" and "Cajero" checkboxes, and save. The operators table should display both badges next to the user.

**Acceptance Scenarios**:

1. **Given** an admin is editing an operator, **When** they check/uncheck roles and save, **Then** the database updates user roles to the selected list.
2. **Given** an admin saves a user with no roles selected, **When** they attempt to save, **Then** the validation prevents saving and requires at least one role.

---

### User Story 3 - Database & Auth API Changes for Role Lists (Priority: P3)

As a developer, I need the database schema and authentication API to support user roles stored as a collection, and the signed JWT payload to encode the assigned roles.

**Why this priority**: The backend foundation that enables the frontend and admin panels to evaluate and transmit multi-role permissions.

**Independent Test**: Call `POST /api/auth/tablet-login` with a valid PIN. The returned JSON and the decoded JWT token should contain the `roles` field containing the array of strings (e.g., `["waiter", "cashier"]`).

**Acceptance Scenarios**:

1. **Given** a login request is processed, **When** the PIN matches, **Then** the server encodes the user's role collection in the JWT under `roles`.
2. **Given** a REST request is sent to a cashier-only endpoint (e.g., `/cash-shifts`), **When** the guard checks the JWT, **Then** it allows access if `roles.includes('cashier')` is true.

---

## Edge Cases

- **Offline PIN Login**: If the terminal is offline, it reads operator credentials cached locally in Secure Storage. The local cache must store the array of roles, and the offline login flow must present the same role selection dialog and set the selected role in `AppState`.
- **Deleting/Revoking a Role**: If an admin revokes the "cashier" role from a user while they are active in a cashier session, the next API request or WebSocket heartbeat will detect the mismatch and prompt the user to log out or select a valid role.

## Requirements

### Functional Requirements

- **FR-001**: The database schema MUST support storing multiple roles per user.
- **FR-002**: The `tablet-login` response and JWT token MUST contain all assigned roles.
- **FR-003**: The Flutter app MUST display a role selection popup after a successful PIN entry if the user is authorized for multiple roles.
- **FR-004**: The selected role MUST be passed to the WebSocket server as a query parameter (`role=...`) during handshake.
- **FR-005**: The Business Control operator form MUST allow checking multiple roles.
- **FR-006**: API routes guarded by roles MUST validate that the JWT contains the required role in its collection.

### Key Entities

- **User**: Represents a POS operator. Attributes: `id`, `name`, `pin`, `roles` (list of strings).

## Success Criteria

### Measurable Outcomes

- **SC-001**: Role selection dialog loads and renders in under 50ms after PIN validation.
- **SC-002**: A single operator can successfully perform waiter and cashier tasks on different terminals concurrently using the same PIN.
- **SC-003**: Revoking a role in Business Control propagates to the database and is validated on the next token refresh.
