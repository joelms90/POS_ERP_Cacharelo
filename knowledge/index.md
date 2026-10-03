---
okf_version: "0.2"
title: "POS-ERP Open Knowledge Catalog"
description: "Canonical Open Knowledge Format (OKF) bundle for POS-ERP Cacharelo repository navigation, system architecture, operational workflows, database schemas, and authoritative business rules."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "pos-erp"
  - "knowledge-bundle"
  - "navigation-guide"
  - "business-rules"
---

# 🧭 POS-ERP Open Knowledge Catalog

Welcome to the **Open Knowledge Format (OKF v0.2)** documentation bundle for the **POS-ERP Cacharelo** monorepo. This directory serves as the unified, machine-readable, and human-navigable knowledge layer for AI agents, developers, and operators.

---

## ⚡ Quick Navigation Matrix

For AI agents and engineers looking for immediate context:

| Domain | What to Read | Key Target Files |
| :--- | :--- | :--- |
| **🏢 Business Rules** | [Business Rules Index](business-rules/index.md) | [Inventory Rules](business-rules/inventory-rules.md)<br>[Purchasing Rules](business-rules/purchasing-rules.md)<br>[KDS Routing](business-rules/kds-routing-rules.md)<br>[Roles & Permissions](business-rules/roles-permissions-rules.md)<br>[Orders & Cancellations](business-rules/orders-cancellation-rules.md)<br>[Transfers](business-rules/transfers-receipt-rules.md) |
| **📐 Core Architecture** | [Architecture Index](architecture/index.md) | [Monorepo Overview](architecture/monorepo-overview.md)<br>[Stock Ledger](architecture/inventory-ledger.md)<br>[Offline Sync](architecture/offline-first-sync.md)<br>[KDS Routing](architecture/kds-routing.md)<br>[MCP Server](architecture/mcp-server.md) |
| **📦 Applications** | [Applications Index](apps/index.md) | [NestJS Sync API](apps/sync_api.md)<br>[Business Control Admin](apps/business-control-tauri.md)<br>[Flutter POS](apps/pos-flutter.md)<br>[MCP Agent Server](apps/mcp-server.md) |
| **🗄️ Data Models & Schemas** | [Data Models Index](data-models/index.md) | [Stock Ledger Table](data-models/stock-ledger.md)<br>[Products & Catalog](data-models/products-catalog.md)<br>[Orders & Sales](data-models/orders-sales.md)<br>[Transfers & Requisitions](data-models/transfers-requisitions.md)<br>[Users & Multi-Roles](data-models/users-roles.md) |
| **🔄 Operational Workflows** | [Workflows Index](workflows/index.md) | [Branch Operator Daily](workflows/branch-operator-daily.md)<br>[Replenishment & Transfers](workflows/replenishment-and-transfers.md)<br>[Procurement to Stock](workflows/procurement-to-stock.md)<br>[Order to Kitchen to Bill](workflows/order-to-kitchen-to-bill.md) |
| **🚀 Operations & DevOps** | [Operations Index](operations/index.md) | [Deployments Runbook](operations/deployment-runbook.md)<br>[Local Dev & Testing](operations/local-dev-and-testing.md) |

---

## 🏛️ System Core Invariants (Non-Negotiable)

1. **Immutable Inventory Source of Truth**: Direct updates to `stock_levels` or `inventory_movements` are prohibited. Every physical stock movement must append an immutable entry to `stock_ledger` via `LedgerService.applyMovement()`.
2. **Authoritative Backend**: The NestJS API (`apps/sync_api`) is the single authority for inventory deduction, order state transitions, role authorizations, and pricing. Frontends (Flutter POS and React Admin) provide optimistic updates and local validation, but never make ultimate state decisions.
3. **Offline Continuity**: The Flutter POS client (`apps/pos_flutter`) operates offline using local SQLite (Drift), local ticket creation, and receipt emission. Reconnections push pending transactions and pull catalog/inventory state.
4. **Idempotent Deployments**: Production database migrations must always run via idempotent DDL scripts (`make backend-migrate`) through the Cloud SQL Proxy to protect legacy metadata.

---

## 📚 Directory Layout

```text
knowledge/
├── index.md                 # This manifest (OKF root declaration)
├── log.md                   # Chronological update log
├── architecture/            # Architectural blueprints & system design
├── apps/                    # Application breakdown & tech stacks
├── business-rules/          # Authoritative business rules (BR-*) & glossary
├── data-models/             # Relational schemas & database entity specs
├── workflows/               # Step-by-step business & operational flows
└── operations/              # DevOps runbooks, testing, and deployment guides
```

---

## 🔍 OKF Conformance

This bundle strictly conforms to the **Open Knowledge Format (OKF) v0.2** specification:
- Every concept document has valid YAML frontmatter with a mandatory `type` property.
- All internal cross-links are verified and navigable.
- Progressive disclosure allows AI agents to scan this root document before loading fine-grained domain concepts.
- Validate anytime with `node scripts/validate-okf.mjs knowledge` or `make okf-validate`.
