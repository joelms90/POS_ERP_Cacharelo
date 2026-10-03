# 🗄️ Relational Data Models & Schemas

This section documents the relational schema definitions, constraints, indices, and data lifecycles managed by Drizzle ORM in PostgreSQL.

---

## 📑 Data Model Index

| Concept / Table | File | Key Entities Covered |
| :--- | :--- | :--- |
| **📦 Stock Ledger** | [Stock Ledger Table](stock-ledger.md) | `stock_ledger`, `stock_levels`, `inventory_movements`, `inventory_alerts` |
| **🏷️ Products & Catalog** | [Products Catalog](products-catalog.md) | `products`, `categories`, `branch_products`, `recipes`, `providers` |
| **🧾 Orders & Sales** | [Orders & Sales](orders-sales.md) | `orders`, `order_items`, `payments`, `cash_shifts`, `kitchen_tickets` |
| **🚚 Transfers & Requisitions** | [Transfers & Requisitions](transfers-requisitions.md) | `stock_transfers`, `stock_transfer_items`, `branch_requisitions`, `purchase_orders` |
| **👥 Users & Multi-Roles** | [Users & Multi-Roles](users-roles.md) | `users`, `admin_business_access`, `devices`, `refresh_tokens` |

---

## 🛡️ Migration & DDL Invariant

All schema definitions live in `apps/sync_api/src/database/schema.ts`. When running production migrations:
- **Never run raw Drizzle migration journals against production** due to pre-existing legacy objects (such as `admin_business_access`).
- **Always execute idempotent migrations** using `make backend-migrate` or standalone tsx scripts (`idempotent-deploy-migrations.ts`).
