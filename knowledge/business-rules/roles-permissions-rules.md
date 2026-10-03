---
type: "rule"
title: "Operational Roles & Permissions Rules"
description: "Authoritative business rules for operational role catalogs, branch scoping, authorization boundaries, and self-approval restrictions."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "roles"
  - "permissions"
  - "auth"
  - "security"
  - "business-rules"
sources:
  - "specs/013-unify-roles/spec.md"
  - "apps/sync_api/src/modules/auth/"
  - "apps/sync_api/src/modules/requisitions/"
  - "apps/sync_api/src/database/schema.ts"
---

# Operational Roles & Permissions Rules

These rules establish the canonical roles and security constraints governing access to API endpoints, admin functions, and Flutter POS operations.

---

## Canonical Operational Roles

The system recognizes six canonical operational roles stored in `users.roles`:

1. `owner`: Business tenant administrator with global authority across all branches, catalogs, users, financial reporting, and overrides.
2. `branch_operator`: Branch manager/supervisor (replaces legacy `encargado` and `responsable`). Oversees branch floor operations, creates branch requisitions, signs for inbound stock transfers, submits daily cash/card sales summaries, and performs audited order cancellations.
3. `warehouse_purchasing_operator`: Warehouse and procurement manager. Reviews and approves branch requisitions, issues purchase orders, manages inventory receipts, and dispatches inter-warehouse/branch transfers.
4. `waiter`: Floor service operator. Manages table layouts, opens guest accounts, enters food/drink items, sends orders to KDS, and requests pre-bills.
5. `cashier`: Cash drawer and billing operator. Opens/closes cashier shifts (Corte X, Corte Z), receives cash/card payments, settles orders, and prints fiscal receipts.
6. `kitchen`: Preparation screen operator. Displays and interacts with KDS tickets on kitchen or bar displays.

---

## BR-ROLE-001 — Role alias normalization

- **Statement**: Legacy roles `encargado` and `responsable` normalize automatically to `branch_operator` in authentication tokens and authorization checks.
- **Owner**: Security & System Administration.
- **Authority**: `apps/sync_api/src/modules/auth/guards/roles.guard.ts` and auth normalization helpers.
- **Consequence**: Existing operator accounts preserve full backward compatibility during and after migration.
- **Verification**: Auth service unit tests verifying role array normalization.

---

## BR-ROLE-002 — Tablet sessions bind operators to terminal branch

- **Statement**: Tablet login (`auth/login-tablet`) binds a shared operator user to the specific branch requested by the hardware terminal. The resulting JWT embeds this branch binding.
- **Owner**: POS Operations.
- **Authority**: `apps/sync_api/src/modules/auth/controllers/auth.controller.ts`.
- **Consequence**: Operators cannot inadvertently submit orders, requisitions, or shift cuts on a branch different from their physical work location.
- **Verification**: Tablet authentication token verification tests asserting `branchId` claims in the JWT payload.

---

## BR-ROLE-003 — Prohibition of requisition self-approval

- **Statement**: An operator is strictly prohibited from approving, rejecting, or dispatching their own branch requisition (`created_by === current_user_id`).
- **Owner**: Audit & Financial Compliance.
- **Authority**: `apps/sync_api/src/modules/requisitions/services/requisitions.service.ts`.
- **Consequence**: Two distinct operators must participate in any inventory dispatch cycle: one requesting replenishment, and one approving/fulfilling from the warehouse.
- **Verification**: Service-level unit tests asserting `ForbiddenException` when a user attempts to approve their own requisition.

---

## BR-ROLE-004 — Server authorization is authoritative

- **Statement**: All permission boundaries are strictly enforced server-side on API endpoints. Client interfaces (Flutter POS and React Dashboard) hide or disable unauthorized buttons for UX purposes, but client checks do not constitute security.
- **Owner**: Engineering Architecture.
- **Authority**: NestJS Guards and Services.
- **Consequence**: Direct HTTP requests tampering with forbidden actions are rejected with 401 Unauthorized or 403 Forbidden.
- **Verification**: Automated integration tests sending forged requests without required role claims.
