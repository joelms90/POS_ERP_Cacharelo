# Modules: Administration & Access Control

This document specifies the purpose, responsibilities, schema details, and endpoint contracts for the core admin modules.

---

## 1. Authentication Module

### Purpose
Manages user sessions, device binding, and token issuance for POS clients and administration web panels.

### Responsibilities
*   Authenticates credentials (PIN code for local tablets, email/password for web admins).
*   Issues short-lived JWT Access Tokens and long-lived Refresh Tokens.
*   Validates device registry keys before allowing synchronization.

### Business Rules
*   Waiters and Cashiers login via a 4-digit PIN specific to their active Branch.
*   Access tokens expire in 15 minutes; refresh tokens expire in 7 days.
*   Tokens are bound to a specific `device_id` to prevent session hijacking.

### Endpoints
*   `POST /auth/login` (Standard credentials login)
*   `POST /auth/tablet-login` (PIN + Branch ID + Device UUID login)
*   `POST /auth/refresh` (Rotates JWT access token)
*   `POST /auth/logout` (Invalidates refresh token session)

### Database Tables
*   `refresh_tokens` (Stores hashed active refresh tokens bound to device UUIDs)

---

## 2. Users Module

### Purpose
Maintains user directory profiles and links operators to specific business roles.

### Responsibilities
*   Manages employee profiles (Waiters, Chefs, Cashiers, Administrators).
*   Tracks PIN hash updates and email credentials.

### Business Rules
*   Every employee must have a unique login PIN within their Business.
*   Waiters/Cashiers must be assigned to at least one active physical Branch.

### Endpoints
*   `GET /users` (Search/filter operators)
*   `POST /users` (Create employee)
*   `PATCH /users/:id` (Update profile/PIN details)
*   `DELETE /users/:id` (Soft delete operator)

### Database Tables
*   `users` (Core user profile, email/password hash, PIN hash, status, tenant IDs)

---

## 3. Roles & Permissions Module

### Purpose
Enforces Role-Based Access Control (RBAC) across all REST endpoints and client screens.

### Responsibilities
*   Defines permission strings (e.g. `order:create`, `shift:close`, `inventory:adjust`).
*   Binds user profiles to roles (e.g., `waiter`, `cashier`, `kitchen_manager`).

### Business Rules
*   Waiters cannot modify submitted order line items after they are sent to the kitchen without supervisor permission override.
*   Only cashiers and managers can open/close cash shifts and record cash-out transactions.

### Database Tables
*   `roles` (Role labels linked to Business tenants)
*   `permissions` (Functional permission strings)
*   `role_permissions` (Many-to-many relationship mapping permissions to roles)

---

## 4. Devices Module

### Purpose
Registers and authorizes client tablets, handheld terminals, and kitchen displays.

### Responsibilities
*   Binds a physical terminal UUID to a specific Branch and active Business.
*   Tracks client connection state and last active sync timestamp.

### Business Rules
*   Only registered and active devices are authorized to run the `sync` database endpoints.
*   Each device must be named (e.g., "Mesa 1 Tablet", "Kitchen Display Bar") for auditing logs.

### Database Tables
*   `devices` (Unique hardware UUID, branch ID, business ID, description, active status, last_sync_at)

---

## 5. Configuration Module

### Purpose
Maintains system settings, business tax overrides, and workflow preferences.

### Responsibilities
*   Stores global variables (e.g., currency, default tax rates, active printer mappings).

### Database Tables
*   `configurations` (Key-value settings stored per business or branch)

---

## 6. Audit Module

### Purpose
Logs all write operations, overrides, checkouts, and configuration changes for compliance.

### Responsibilities
*   Saves full request metadata (UserID, DeviceID, IP address, Payload).

### Database Tables
*   `audit_logs` (Stores event timestamp, module, action, previous state, new state, user reference)
