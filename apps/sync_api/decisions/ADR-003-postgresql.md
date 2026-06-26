# ADR-003: Selection of PostgreSQL as the Source of Truth

## Status
Accepted

## Context
The POS system requires a robust, transactional (ACID) database that can serve as the central source of truth. It must handle complex relational structures (inventory, recipes, sales shifts) and provide strong consistency, json querying capabilities, and seamless support for future scalability.

## Decision
We select **PostgreSQL** (version 15 or 16) as our core database engine.

## Rationale
1. **ACID Transactions**: Required for processing complex sales checkouts and inventory movements concurrently without race conditions.
2. **Rich Querying Features**: PostgreSQL supports CTEs, window functions, and JSONB formats, which are highly useful for nested recipes and syncing metadata.
3. **Maturity & Support**: Integrates perfectly with Node.js, Drizzle ORM, and cloud hosting engines (e.g. Google Cloud SQL).
4. **Partitioning & Tenancy**: Native support for table partitioning, which is critical for scaling to 100+ branches and millions of audit logs in the future.

## Consequences
* Database is relational and uses Drizzle for schema definitions.
* Local development relies on Dockerized PostgreSQL.
