---
type: "architecture"
title: "Offline-First Synchronization Architecture"
description: "Architecture of Flutter local SQLite persistence (Drift), WebSocket sync gateways, version tracking, and bi-directional reconciliation."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "offline-first"
  - "sync"
  - "drift"
  - "websockets"
  - "architecture"
sources:
  - "specs/001-offline-pos-architecture/spec.md"
  - "apps/pos_flutter/lib/services/"
  - "apps/sync_api/src/modules/sync/"
---

# Offline-First Synchronization Architecture

The Flutter POS application (`apps/pos_flutter`) operates on an **offline-first local authority pattern**. A temporary network outage must never interrupt point-of-sale dining operations, kitchen printing, or guest billing.

---

## 1. Local Storage with Drift SQLite

- **Client Database**: The Flutter client embeds a high-performance SQLite engine managed via the Drift ORM.
- **Local Collections**: Tables, active orders, order items, catalog products, categories, offline requisitions, and print queues are persisted locally.
- **Client UUIDs**: Entities created offline generate a cryptographic `clientUuid`. The NestJS backend recognizes client UUIDs to prevent duplicate record insertion during re-sync.

---

## 2. Sync Protocol: Pull & Push Pipeline

```text
┌─────────────────┐                               ┌─────────────────┐
│   Flutter POS   │ ─── Push Pending Operations ──▶│   NestJS API    │
│  (Drift SQLite) │ ◀── Real-time Socket Events ───│ (PostgreSQL DB) │
│                 │ ◀── Incremental Sync Pull ─────│                 │
└─────────────────┘                               └─────────────────┘
```

1. **Incremental Sync Pull (`/api/sync/pull`)**:
   - The client sends its last synchronized timestamp or checkpoint version (`device_sync_checkpoints`).
   - The server queries `change_log` and returns only entities modified after that timestamp.
2. **Push Pending Operations (`/api/sync/push`)**:
   - Transactions recorded offline (new orders, item additions, status updates) are queued in local drift storage.
   - Once online, the client pushes the batch. The server processes operations sequentially in database transactions, assigning definitive IDs and returning reconciliations.
3. **Real-Time Notification via WebSocket**:
   - The server broadcasts live change notifications over Socket.io (e.g. table status changes, KDS ticket updates, stock alert triggers) to keep all concurrent branch terminals synchronized.
