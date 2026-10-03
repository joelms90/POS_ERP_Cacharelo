# Knowledge Base Change Log

Chronological audit log of modifications, additions, and updates to the POS-ERP Open Knowledge Format (OKF) bundle.

---

## 2026-09-25

### Initialized POS-ERP Open Knowledge Format (OKF v0.2) Bundle
- **Author**: Antigravity AI Agent
- **Description**: Created the canonical machine-readable knowledge bundle covering system architecture, applications, business rules (BR-*), relational data models, operational workflows, and DevOps runbooks.
- **Added Domains**:
  - `knowledge/architecture/`: Monorepo architecture, immutable stock ledger, offline synchronization protocol, KDS station routing, and Model Context Protocol (MCP) server.
  - `knowledge/apps/`: Deep architectural guides for `sync_api`, `business_control_tauri`, `pos_flutter`, and `mcp_server`.
  - `knowledge/business-rules/`: Authoritative catalog of business rules for inventory (`BR-INV-*`), purchasing (`BR-PO-*`, `BR-REQ-*`), kitchen routing (`BR-KDS-*`), unified roles (`BR-ROLE-*`), order audit (`BR-ORD-*`), and transfers (`BR-TRN-*`), alongside business glossary.
  - `knowledge/data-models/`: Relational schema definitions for `stock_ledger`, `products` & catalog, `orders`, `stock_transfers` & `branch_requisitions`, and `users` multi-role permissions.
  - `knowledge/workflows/`: Step-by-step guides for branch operator daily routines, stock replenishment & transit, procurement, and order lifecycle.
  - `knowledge/operations/`: Cloud Run / Firebase deployment runbooks and local development / verification testing.
  - `scripts/validate-okf.mjs`: Automated CLI validator for OKF v0.2 bundle conformance and link integrity.
