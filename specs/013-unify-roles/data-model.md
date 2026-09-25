# Data Model: Unified Operational Roles

| Role | Core capabilities |
|---|---|
| `owner` | all capabilities and role administration |
| `branch_operator` | sell, payment, prepare/deliver, requisition, assigned-transfer receipt |
| `warehouse_purchasing_operator` | PO, supplier receipt, requisition decision, transfer dispatch |
| `waiter` | service orders and billing request |
| `cashier` | shifts, payment, discount, payment printing |
| `kitchen` | kitchen ticket status |

**Permission audit event**: actor, active role, business/branch scope, action, target, outcome, timestamp, reason/note.

**Reception discrepancy**: expected and accepted quantity/cost, rejected quantity, note, receiver, timestamp.

**State rules**: self-decision is invalid without an owner reason; mismatches are invalid without notes; receipt only accepts outstanding dispatched quantity.
