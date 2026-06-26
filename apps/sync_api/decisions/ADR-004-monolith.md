# ADR-004: Modular Monolith Architecture Pattern

## Status
Accepted

## Context
The POS system contains 30+ functional modules (Auth, Inventory, POS workflow, Catalog, Synch, etc.). Microservices introduce high development overhead, complex networking, local testing complexity, and transaction synchronization challenges, which is unsustainable for a team of 1–2 developers. A generic spaghetti monolith, however, becomes hard to maintain and refactor.

## Decision
We adopt a **Modular Monolith** architecture structure. All modules are deployed in a single codebase/runtime (NestJS), but maintain strict boundary separation.

## Rationale
1. **Developer Productivity**: A single project folder, single database connection, and simple local execution using `docker compose`.
2. **Modular Boundaries**: Features are grouped by domain folders (e.g. `users`, `inventory`, `sync`). Modules must only share data via explicit service dependency injection or local events. Direct cross-database access of foreign tables is discouraged.
3. **Prepared for Future Microservices**: If a specific module (e.g. Synchronization or Reports) needs to scale independently in the future, it can be extracted into its own service easily due to strict directory decoupling.

## Consequences
* Circular dependencies between NestJS modules are strictly forbidden.
* Domain modules must define clear interfaces for interaction.
