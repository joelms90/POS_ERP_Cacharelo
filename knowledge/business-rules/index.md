# ⚖️ Business Rules Catalogue

This directory contains declarative, testable constraints and decisions that govern the POS-ERP Cacharelo system. Each rule has a stable ID, an assigned authority, and automated verification criteria.

---

## 📋 Rule Categories

| Domain | Rule Code Prefix | Document Link | Description |
| :--- | :--- | :--- | :--- |
| **📦 Inventory & Ledger** | `BR-INV-*` | [Inventory Rules](inventory-rules.md) | Stock ledger immutability, location requirements, and branch thresholds. |
| **🛒 Purchasing & Replenishment** | `BR-PO-*`, `BR-REQ-*` | [Purchasing Rules](purchasing-rules.md) | Supplier eligibility, cost-based auto-generation, and draft states. |
| **🍳 Kitchen & Bar Routing (KDS)** | `BR-KDS-*` | [KDS Routing Rules](kds-routing-rules.md) | Station assignment, category filtering, and ticket dispatching. |
| **👥 Roles & Permissions** | `BR-ROLE-*` | [Roles & Permissions Rules](roles-permissions-rules.md) | Canonical operational roles, branch binding, and self-approval restrictions. |
| **🧾 Orders & Audit** | `BR-ORD-*` | [Orders & Cancellation Rules](orders-cancellation-rules.md) | Cancellation reasons, server-side audit logs, and table billing. |
| **🚚 Transfers & Inbound Receipts** | `BR-TRN-*` | [Transfers & Receipts Rules](transfers-receipt-rules.md) | Virtual transit warehouse, discrepancy notes, and receiving audits. |
| **📖 Business Glossary** | N/A | [Business Glossary](glossary.md) | Canonical terminology used across frontends, backend, and documentation. |

---

## 🏷️ Rule ID Convention

All business rules use stable domain prefixes:
- `BR-INV-###`: Inventory & Stock Ledger
- `BR-PO-###`: Purchase Orders
- `BR-REQ-###`: Internal Branch Requisitions
- `BR-KDS-###`: Kitchen Display System Routing
- `BR-ROLE-###`: Operational Roles & Authorization
- `BR-ORD-###`: Orders & Fiscal Billing
- `BR-TRN-###`: Stock Transfers & Reception

**Rule ID Invariance**: Rule IDs are never reassigned or recycled. Retired rules remain in the catalogue marked as `deprecated` to preserve historical audit readability.
