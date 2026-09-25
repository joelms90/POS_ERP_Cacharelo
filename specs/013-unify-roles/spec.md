# Feature Specification: Unified Operational Roles

**Feature Branch**: `013-unify-roles`  
**Created**: 2026-09-24  
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - Run a small branch independently (Priority: P1)

An Operador Integral de Sucursal can sell at the counter, collect payment, prepare and hand over orders, request stock, and receive a dispatched transfer for their assigned branch.

**Independent Test**: A user with only this role completes a counter sale, advances its preparation and delivery, submits a requisition, and records a partial transfer reception with a discrepancy note.

**Acceptance Scenarios**:

1. Given an assigned branch, when the operator sells and collects payment, then the sale is attributed to that operator and branch.
2. Given an approved inbound transfer, when the operator records quantities actually received, then only accepted quantities enter branch stock and every discrepancy requires a note.
3. Given the operator creates a requisition, when it is submitted, then it awaits another authorized user; the creator cannot approve it.

### User Story 2 - Purchase, receive, and fulfill stock (Priority: P1)

An Operador de Almacén y Compras can manage supplier purchase orders, record supplier receptions and discrepancies, approve branch requisitions, and dispatch stock transfers.

**Independent Test**: A user creates a purchase order, records partial supplier delivery with a note, approves another branch's requisition, and dispatches its transfer.

**Acceptance Scenarios**:

1. Given supplier products, when the operator creates or sends a purchase order, then it is auditable with the operator as actor.
2. Given a delivery, when quantities or costs differ from the order, then the operator records the actual values and a mandatory discrepancy note before accepting the receipt.
3. Given a requisition created by another user, when the operator approves it, then a transfer can be prepared and dispatched; the same actor cannot approve their own requisition.

### User Story 3 - Administer consistent access (Priority: P2)

An Owner assigns standardized role bundles, and every app shows only actions authorized for the active role.

**Independent Test**: Assigning each role results in the same capabilities being permitted by the dashboard, POS client, and server.

**Acceptance Scenarios**:

1. Given a user with more than one operational role, when signing into a POS terminal, then they select one active role for that session.
2. Given an unauthorized request, when the action is attempted through any client, then it is denied and no stock, payment, or workflow state changes.

### Business Rules

- An active role is required for every operational action and the actor is recorded in the audit trail.
- `branch_operator` may sell, collect payment, prepare and deliver orders, create requisitions, and receive transfers only for its assigned branch.
- `branch_operator` cannot approve, reject, or dispatch its own requisition; create purchase orders; alter product costs; or make warehouse adjustments.
- `warehouse_purchasing_operator` may create and send purchase orders, receive supplier deliveries, record returns/discrepancies, approve requisitions created by another user, and prepare/dispatch transfers.
- Any receipt with an ordered-versus-actual quantity or cost mismatch requires a non-empty note. Only accepted quantity changes stock.
- No user may approve their own requisition. Owner override requires a reason and audit record.
- `owner` has all capabilities and may manage role assignments, but financial/inventory override actions remain auditable.
- Specialized `waiter`, `cashier`, and `kitchen` roles remain limited bundles for larger locations.

### Edge Cases

- Offline branch operators may create requisitions; those remain pending until synchronized and cannot be approved locally.
- A transfer cannot be received twice. A partial reception leaves the remaining quantity traceable.
- A user whose legacy role has no unified mapping is denied operational access until an Owner assigns a supported role.

## Requirements

- **FR-001**: The system MUST use one canonical catalog for `owner`, `branch_operator`, `warehouse_purchasing_operator`, `waiter`, `cashier`, and `kitchen`.
- **FR-002**: The system MUST evaluate permissions on the server for purchases, receipts, requisition decisions, transfer dispatch/reception, stock adjustments, and role administration.
- **FR-003**: The system MUST render only the actions permitted to the active role in both the dashboard and Flutter POS.
- **FR-004**: The system MUST support multiple roles per user and an explicit active role in POS sessions.
- **FR-005**: The system MUST prevent self-approval of a requisition, including via direct requests.
- **FR-006**: The system MUST require and retain discrepancy notes for nonmatching supplier or transfer receptions.
- **FR-007**: The system MUST retain actor, timestamp, role, action, reason/note, and outcome for privileged inventory and purchasing actions.
- **FR-008**: The system MUST map legacy `encargado` and `responsable` users to `branch_operator` without removing their access unexpectedly.

## Key Entities

- **Role bundle**: A named set of operational permissions.
- **Active role session**: The selected permitted role used by a POS operator during a session.
- **Inventory discrepancy**: The accepted/rejected actual quantity and explanatory note for a receipt.
- **Permission audit event**: A durable record of a privileged action and its actor.

## Success Criteria

- **SC-001**: A branch operator completes a sale, requisition, and transfer reception without an Owner intervention in under five minutes per workflow.
- **SC-002**: 100% of direct unauthorized action attempts are rejected without changing inventory or workflow state.
- **SC-003**: 100% of receipt mismatches retain a note and actor identity.
- **SC-004**: An Owner can assign a role bundle and see matching available actions on both clients on the next sign-in.

## Assumptions

- A branch operator receives transfers from a warehouse; direct supplier purchase-order receipts are handled by the warehouse and purchasing operator.
- The owner is the exception authority and every use of it requires a reason.
