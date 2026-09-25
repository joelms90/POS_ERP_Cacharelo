# Authorization Contract

The server derives roles from the authenticated session; clients cannot submit arbitrary permission claims.

| Action | Allowed roles | Required validation |
|---|---|---|
| Create requisition | branch operator, warehouse/purchasing operator, owner | branch scope |
| Decide requisition | warehouse/purchasing operator, owner | not creator; owner override reason |
| Create/send or receive PO | warehouse/purchasing operator, owner | business scope; mismatch note |
| Dispatch transfer | warehouse/purchasing operator, owner | not requester |
| Receive transfer | branch operator, warehouse/purchasing operator, owner | destination scope; mismatch note |
| Sell/payment | branch operator, cashier, owner | branch/shift scope |
