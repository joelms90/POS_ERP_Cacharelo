---
type: "app"
title: "NestJS Backend Sync API"
description: "Architecture, directory structure, module breakdown, and database access layer for apps/sync_api."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "backend"
  - "nestjs"
  - "drizzle"
  - "postgresql"
  - "apps"
sources:
  - "apps/sync_api/package.json"
  - "apps/sync_api/src/database/schema.ts"
  - "apps/sync_api/src/app.module.ts"
---

# NestJS Backend Sync API

The **Sync API** (`apps/sync_api`) is the central backend engine for the entire POS-ERP ecosystem. It exposes RESTful APIs, WebSocket gateways, and controls database migrations.

---

## 1. Tech Stack & Key Libraries

- **Framework**: NestJS 10 (TypeScript)
- **Database**: PostgreSQL 15+ (Cloud SQL in production, local `pos_dev` in development)
- **ORM & Migrations**: Drizzle ORM (`drizzle-orm`, `drizzle-kit`)
- **Authentication**: Passport JWT + bcrypt PIN hashing
- **WebSockets**: Socket.io (`@nestjs/websockets`, `@nestjs/platform-socket.io`)
- **Deployment**: Google Cloud Run (`pos-sync-api`)

---

## 2. Directory Structure

```text
apps/sync_api/
├── src/
│   ├── database/
│   │   ├── schema.ts            # Drizzle table schemas and relationships
│   │   └── database.module.ts   # Postgres connection pool provider
│   ├── modules/
│   │   ├── auth/                # Login, PIN verification, JWT issuance, roles guard
│   │   ├── inventory/           # LedgerService, alerts, thresholds, transfers, receipts
│   │   ├── orders/              # Order lifecycle, items, cancellations, billing
│   │   ├── kitchen/             # KDS ticket emission, station resolution
│   │   ├── requisitions/        # Branch replenishment requests and approval logic
│   │   ├── purchase-orders/     # Supplier purchase orders and receipts
│   │   ├── sync/                # Push/pull incremental synchronization engine
│   │   ├── printing/            # Print station registry and print job queue
│   │   └── users/               # Multi-role user administration
│   └── scripts/                 # Idempotent DB migration and backfill scripts
```

---

## 3. Key Commands

```bash
# Start local development server with hot-reload (port 3001)
cd apps/sync_api && npm run start:dev

# Run automated tests
cd apps/sync_api && npm test

# Build production bundle
cd apps/sync_api && npm run build

# Deploy to Cloud Run
make backend-deploy-fast
```
