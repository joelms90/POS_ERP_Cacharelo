# Implementation Plan: Multi-Role User Support

**Branch**: `010-multi-role-users` | **Date**: 2026-07-11 | **Spec**: [spec.md](file:///Users/joelmorales/web/POS-ERP/specs/010-multi-role-users/spec.md)

**Input**: Feature specification from `/specs/010-multi-role-users/spec.md`

## Summary

Implement multi-role user configurations across the system:
1. **Database & API**: Modify `users.role` to support multiple roles, update signed JWT payload to return the list under `roles`, and update endpoint guards.
2. **Admin Portal**: Transition single-role dropdown inside user forms to Checkboxes for multiple selections, rendering Badges for user roles.
3. **POS Terminal (Flutter)**: Intercept successful PIN entries. If a user is authorized for multiple roles, present a selection dialog to let them choose their active role for the session, which is then used to initialize WebSockets and dashboards.

---

## Technical Context

**Language/Version**:
- Client: Flutter 3.19+ / Dart 3.3+ (Web/Android)
- Admin Portal: React 18 / TypeScript / Tauri (Desktop)
- Backend: NestJS / TypeScript / Node.js 20

**Primary Dependencies**:
- Frontend: `flutter` SDK, `ListenableBuilder`
- Backend: `@nestjs/jwt`, `drizzle-orm`, `pg` (PostgreSQL)

**Storage**:
- PostgreSQL: `users` table schema migration to handle roles representation (Option: JSONB array or comma-separated varchar).
- Secure Storage: Flutter client caches offline user roles as a deserialized JSON array list.

**Testing**:
- Unit Tests: Verify `UserRole` parser splits and maps role collections, test Flutter role selector screen widgets.
- Integration Tests: Test login auth requests return token with roles array, check role checks on REST endpoint access guards.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Offline continuity**: PASS. Cached user objects in Secure Storage cache their roles collection. Offline logins execute identical role selection logic using local caches.
- **Local authority**: PASS. The terminal validates role selections, sets `currentUserRole` locally, and connects query parameter WS headers directly.
- **Sync contract**: PASS. Operator edits in Business Control serialize roles correctly and update DB user versions, triggering sync.

---

## Project Structure

### Documentation

```text
specs/010-multi-role-users/
├── spec.md              # Feature specification
└── plan.md              # This implementation plan
```

### Source Code

```text
apps/
├── pos_flutter/
│   └── lib/
│       ├── services/
│       │   └── secure_storage_service.dart   # Cached users serialization
│       └── ui/
│           ├── common/
│           │   └── app_state.dart            # WebSocket setup, sync role
│           └── login_screen.dart             # Keypad PIN and role modal dialog
├── sync_api/
│   └── src/
│       ├── database/
│       │   └── schema.ts                     # Users DB table schema
│       └── modules/
│           ├── auth/
│           │   └── auth.service.ts           # Tablet login and JWT roles signing
│           └── users/
│               └── repositories/             # Drizzle users select
└── business_control_tauri/
    └── src/
        ├── components/
        │   ├── organisms/
        │   │   ├── UserForm.tsx              # Multiple roles checkbox form
        │   │   └── UsersGrid.tsx             # Roles display badges
        │   └── pages/
        │       └── PosSimulatorPage.tsx      # Active waiter filtering logic
```

---

## Detailed Tasks

### Phase 1: Database & Backend Changes
- **DB Migration**: Add support for a roles list representation (JSONB or split varchar) in Drizzle schema.
- **JWT Update**: Modify `generateAuthTokens()` to sign JWT payloads with a list of roles (`roles: string[]`).
- **Guards Audit**: Update NestJS `RolesGuard` to check if `payload.roles` contains the endpoint's required role.

### Phase 2: Business Control Portal Changes
- **User Form**: Replace single role dropdown with Checkboxes (`waiter`, `cashier`, `kitchen`).
- **Users Table**: Map user role badges to represent all user capabilities.
- **POS Simulator**: Change checks from `user.role === 'waiter'` to `user.roles.includes('waiter')`.

### Phase 3: Flutter Client Changes
- **Local Storage**: Serialize and save user roles in local secure storage.
- **Keypad Interceptor**: Add a Role Selection Modal popup in `login_screen.dart` if validation returns multiple roles.
- **Session Init**: Pass selected role query parameter (`role=...`) during WebSocket connect.
