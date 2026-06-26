# 04: Database Design & Core Columns Schema

This document details the relational database standards, index strategies, and core columns inherited by all tables in the POS system.

---

## 1. General Database Policies

*   **Extensions**: The database uses standard PostgreSQL extensions:
    *   `uuid-ossp` or `pgcrypto` (for server-side UUID v4 generation).
*   **Keys**:
    *   Primary Keys MUST be of type `uuid` (UUID v4 or UUID v7) for offline safety.
    *   Foreign Keys MUST explicitly use `on delete restrict` to preserve audit records, except for cascade deletions on child tables (e.g. `order_items` deleted when an unsubmitted `order` is discarded).
*   **Case Sensitivity**: Table names and column names must be `snake_case` and lowercase.

---

## 2. Core Audit Columns (Base Fields)

Every database table MUST include the following fields to support synchronization, auditing, and soft deletes:

| Column | PostgreSQL Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | No | `uuid_generate_v4()` | Unique primary key identifier. |
| `created_at` | `timestamp with time zone` | No | `now()` | Date and time the record was created. |
| `updated_at` | `timestamp with time zone` | No | `now()` | Date and time the record was last modified. |
| `deleted_at` | `timestamp with time zone` | Yes | `NULL` | Soft delete audit timestamp. |
| `version` | `integer` | No | `1` | Incremental counter for optimistic locking and sync conflict resolution. |

---

## 3. Audit Logging & Soft Delete Strategy

*   **Soft Deletes**:
    *   Instead of executing `DELETE` SQL commands, columns are marked by setting `deleted_at = now()`.
    *   Queries in repositories must filter out soft-deleted items by default: `where(isNull(table.deletedAt))`.
    *   This preserves sales figures, audit details, and history reports while hiding deleted menu items or users from the operational UI.
*   **Optimistic Concurrency Control (OCC)**:
    *   When updating critical entities (like order balances, shifts, or stock levels), the database update must evaluate versioning:
      ```sql
      UPDATE tables SET state = 'occupied', version = version + 1 WHERE id = :id AND version = :version;
      ```
    *   If no rows are updated, it indicates a sync or edit conflict, throwing a `409 Conflict` exception to the client.
