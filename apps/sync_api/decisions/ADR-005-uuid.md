# ADR-005: Primary Key UUID v4 / v7 Strategy

## Status
Accepted

## Context
In an offline-first system, clients (tablets, handhelds) need to create records (e.g. new orders, sales, customer logs) while disconnected from the server. If the backend uses autoincrementing integer IDs (e.g. `SERIAL` in PostgreSQL), clients cannot generate IDs locally without risk of duplication, resulting in complex mapping tables and conflicts during synchronization.

## Decision
We adopt **UUIDs** as the primary key format for all database tables. Specifically:
* Clients and server can generate standard **UUID v4** (random) or **UUID v7** (time-ordered, sequential) IDs.
* Database primary key columns are defined as the native `uuid` type in PostgreSQL.

## Rationale
1. **Offline Autonomy**: Tablets can assign unique, non-overlapping IDs locally and upload records immediately without server confirmation.
2. **Security**: Obfuscates record counts and patterns (preventing competitors from guessing order volumes via serial ID patterns).
3. **UUID v7 Performance**: Unlike UUID v4, which is fully random and results in B-tree index fragmentation, UUID v7 is chronological, ensuring sorted insertion patterns and high indexing performance.

## Consequences
* Primary key database indexes take slightly more memory space than standard integer types.
* Client code must include a UUID generation library.
