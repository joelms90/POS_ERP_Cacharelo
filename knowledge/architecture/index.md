# 📐 Core System Architecture

This section documents the foundational architectures, communication channels, state management models, and data synchronization paradigms of the POS-ERP monorepo.

---

## 🏛️ Architecture Topics

| Document | Focus Area | Key Concepts |
| :--- | :--- | :--- |
| [Monorepo Overview](monorepo-overview.md) | Ecosystem Structure | App boundaries, shared assets, runtime environments, and independent deployability. |
| [Stock Ledger Architecture](inventory-ledger.md) | Inventory Source of Truth | Append-only ledger, delta accounting, read cache reconciliation, and transit warehouses. |
| [Offline-First Sync](offline-first-sync.md) | Client Synchronization | Drift SQLite on Flutter, WebSockets gateway, incremental checkpoints, and conflict resolution. |
| [KDS Routing](kds-routing.md) | Kitchen Display Pipeline | Category station targeting, real-time ticket emission, and live state progression. |
| [MCP Server](mcp-server.md) | AI Agent Tooling | Model Context Protocol integration, stdio JSON-RPC, tools catalog, and agent safety boundaries. |

---

## 🧭 Architectural Principles

1. **Decoupled Clients, Unified Authority**: The NestJS API acts as the single source of truth for business logic and database writes. Clients may perform optimistic UI updates and local persistence, but server verification is definitive.
2. **Resilience to Network Drops**: Branch floor staff must be able to continue taking orders, printing kitchen orders, and issuing guest bills even during complete ISP connectivity failures.
3. **Audit Trail Over In-Place Mutation**: Physical goods and money cannot simply be altered in place; they must be traced via auditable historical events (`stock_ledger`, `change_log`, `cash_shifts`, `cash_transactions`).
