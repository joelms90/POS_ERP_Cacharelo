# DB Query Procedures

Quick-reference for querying the production database. All connection info is in the Makefile.

## Connection Info (Production)

| Field | Value |
|-------|-------|
| Host | `127.0.0.1` (via Cloud SQL Proxy) |
| Port | `5433` |
| Database | `pos_db` |
| Username | `pos_user` |
| Password | `pos-secure-db-pass-2026!` |
| Proxy command | `cloud-sql-proxy fresh-sensor-497515-d3:us-central1:pos-db-instance --port 5433` |

## Query Tickets Cobrados Hoy

```bash
# Local dev DB
make db-tickets-hoy BRANCH=<branch-uuid>

# Production DB (auto-starts cloud-sql-proxy)
make db-tickets-hoy-prod BRANCH=<branch-uuid>
```

Default branch if `BRANCH` is omitted: `c4f07384-d113-4a0e-a555-e5b12824bf04` (Sucursal Empanadas)

### Known Branch UUIDs (from seed data)

| Branch | UUID |
|--------|------|
| Cacharelo Centro | `c4f07384-d113-4a0e-a555-e5b12824bf02` |
| Sucursal Empanadas | `c4f07384-d113-4a0e-a555-e5b12824bf04` |
| Sucursal Hamburguesas | `c4f07384-d113-4a0e-a555-e5b12824bf06` |
| Sucursal Tortas | `c4f07384-d113-4a0e-a555-e5b12824bf08` |

### Script location

`apps/sync_api/src/database/query-tickets-hoy.ts`

### Adding new queries

1. Create a new `.ts` file in `apps/sync_api/src/database/` using the `pg.Pool` pattern
2. Add an npm script in `apps/sync_api/package.json`
3. Add a Makefile target wrapping it (with proxy support if needed for production)

### Direct SQL via DBeaver

```bash
make db-proxy  # starts proxy on port 5433, prints DBeaver connection info
```
Then connect DBeaver to `127.0.0.1:5433 / pos_db / pos_user / pos-secure-db-pass-2026!`
