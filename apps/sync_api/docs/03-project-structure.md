# 03: Project Structure & Directory Conventions

To maintain consistency for a small team, the NestJS backend must follow strict folder and file naming rules.

---

## 1. Project Directory Layout

```text
apps/sync_api/
├── src/
│   ├── app.module.ts            # Root application module
│   ├── main.ts                  # Application entry point
│   ├── common/                  # Shared utilities, filters, guards, and decorators
│   │   ├── decorators/          # Custom NestJS decorators (e.g. @GetUser)
│   │   ├── filters/             # Global error exception filters
│   │   ├── guards/              # JWT and Role guards
│   │   └── interceptors/        # Logging and performance interceptors
│   ├── database/                # Drizzle setup, schema index, and connection pooling
│   │   ├── connection.ts        # Database connection client
│   │   └── schema.ts            # Database schema registry
│   └── modules/                 # Functional business features (Modular Monolith)
│       ├── auth/                # Authentication module
│       ├── inventory/           # Inventory module
│       │   ├── inventory.module.ts
│       │   ├── inventory.controller.ts
│       │   ├── inventory.service.ts
│       │   ├── dto/             # Data Transfer Objects
│       │   │   ├── create-movement.dto.ts
│       │   │   └── update-movement.dto.ts
│       │   ├── entities/        # Drizzle table schemas specific to this module
│       │   │   └── movements.schema.ts
│       │   └── repositories/    # Database queries and operations
│       │       └── movements.repository.ts
│       └── users/               # Users module
```

---

## 2. Naming Conventions

*   **Directories**: Always `kebab-case` (e.g. `cash-registers`, `inventory-movements`).
*   **Files**: Always `kebab-case` with functional suffixes:
    *   Controllers: `name.controller.ts`
    *   Services: `name.service.ts`
    *   Modules: `name.module.ts`
    *   DTOs: `action-name.dto.ts` (e.g., `create-user.dto.ts`)
    *   Schemas: `name.schema.ts` (e.g., `users.schema.ts`)
    *   Repositories: `name.repository.ts`
*   **Classes**: Always `PascalCase` (e.g., `InventoryController`, `CreateMovementDto`).
*   **Methods / Variables**: Always `camelCase` (e.g., `checkoutTable()`, `cashDrawerAmount`).

---

## 3. Layer Responsibilities

1.  **Controller Layer**:
    *   Handles HTTP routing and input validation via DTO classes using `class-validator`.
    *   Maps query parameters and forwards payloads to the Service layer.
2.  **Service Layer**:
    *   Houses core business rules and processes.
    *   Coordinates multiple database calls or events (e.g. finalizes an order and then triggers recipe stock depletion).
3.  **Repository Layer**:
    *   Encapsulates all Drizzle ORM operations, database joins, and transaction boundaries.
    *   Keeps database access code isolated from services for easier mocking in tests.
4.  **Entity (Schema) Layer**:
    *   Defines database table structures, foreign keys, indexes, and type mappings.
