---
type: "table"
title: "Users, Roles & Device Authentication Tables"
description: "Relational schema definitions for users, multi-role arrays, tablet hardware binding, and refresh tokens."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "schema"
  - "users"
  - "roles"
  - "auth"
  - "devices"
  - "tables"
sources:
  - "specs/010-multi-role-users/spec.md"
  - "specs/013-unify-roles/spec.md"
  - "apps/sync_api/src/database/schema.ts"
---

# Users, Roles & Device Authentication Tables

These tables control operator identities, PIN authentication, multi-role capability bundles, and hardware terminal registration.

---

## 1. `users`

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO (PK) | User identifier. |
| `business_id` | `uuid` | YES (FK) | Reference to `businesses.id` (null for superadmins). |
| `branch_id` | `uuid` | YES (FK) | Default home branch assignment (`branches.id`). |
| `name` | `varchar(100)`| NO | Operator display name. |
| `email` | `varchar(255)`| YES (Unique)| Email for admin web login. |
| `password_hash` | `varchar(255)`| YES | Bcrypt hash for web admin credentials. |
| `pin` | `varchar(255)`| NO | Hashed 4-6 digit quick PIN for POS tablet access. |
| `role` | `varchar(20)` | NO | Legacy primary role string. |
| `roles` | `jsonb` | NO (Default: `[]`)| Array of canonical operational role strings. |

### Canonical Roles in `roles`:
`owner`, `branch_operator`, `warehouse_purchasing_operator`, `waiter`, `cashier`, `kitchen`.

---

## 2. `devices` (Hardware Terminal Registry)

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO (PK) | Device identifier. |
| `device_uuid` | `varchar(255)`| NO (Unique)| Unique persistent hardware UUID. |
| `branch_id` | `uuid` | NO (FK) | Branch where the hardware device is stationed. |
| `name` | `varchar(100)`| NO | Terminal label (e.g. "Tablet Barra 1", "Caja Principal"). |
| `role` | `varchar(20)` | NO | Primary terminal profile (`ordering`, `kds`, `cashier`). |
| `is_active` | `boolean` | NO | Allowed to synchronize and authenticate. |
| `last_sync_at` | `timestamptz` | YES | Timestamp of last synchronization cycle. |

---

## 3. `admin_business_access`

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO (PK) | Access record identifier. |
| `user_id` | `uuid` | NO (FK) | Reference to `users.id`. |
| `business_id` | `uuid` | NO (FK) | Reference to `businesses.id`. |
| `role` | `varchar(20)` | NO | Management role (`owner`, `inventory_admin`). |
