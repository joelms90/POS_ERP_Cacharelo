# Research: Unified Operational Roles

- **Canonical roles**: `owner`, `branch_operator`, `warehouse_purchasing_operator`, `waiter`, `cashier`, `kitchen`.
  - **Rationale**: Covers a one-person branch and warehouse purchasing without ambiguous manager labels.
- **Legacy compatibility**: `encargado` and `responsable` map to `branch_operator`.
  - **Rationale**: Existing PIN users retain access.
- **Authorization boundary**: API authorization is mandatory; UI tabs are not security controls.
- **Separation of duties**: Requester cannot decide or dispatch their own requisition. Owner override requires reason.
- **Mismatch evidence**: Receipt quantity/cost differences require a note and actor identity.
