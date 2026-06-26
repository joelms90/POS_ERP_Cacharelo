# ADR-002: Adoption of Drizzle ORM for Database Access

## Status
Accepted

## Context
A major requirement for the POS backend is high-performance relational database access with clear, predictable SQL execution. ORMs like TypeORM or Sequelize abstract database queries heavily, leading to "ORMs magic" performance issues, complex joins, and unpredictable SQL execution. Conversely, raw query builders like Knex (used in the prototype) require manual schema updates and lack complete compile-time type safety.

## Decision
We will use **Drizzle ORM** for database interaction, schema definitions, and migration generation.

## Rationale
1. **Explicit SQL, Type-Safe**: Drizzle is "SQL-like" by design. It does not hide SQL queries behind magic APIs; instead, it provides type safety while staying close to actual SQL syntax.
2. **First-Class TypeScript Support**: Drizzle infers TypeScript interfaces directly from the database schema definitions, eliminating duplicate type definitions.
3. **Migration CLI (drizzle-kit)**: Automatically generates SQL migrations by comparing schema code files with existing migrations.
4. **Lightweight & High Performance**: Drizzle has near-zero runtime overhead compared to heavy ORMs.

## Consequences
* SQL features are declared in TypeScript schema files.
* Complex queries can be written in native-like SQL syntax while keeping full type safety.
