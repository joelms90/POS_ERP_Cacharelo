# Master Plan: WebSocket Sync Scale & Reliability Improvements

This document combines backend horizontal scaling optimizations (using your existing database infrastructure) and client-side reliability improvements (resolving connection dropouts and UI flickering) while maintaining **100% backwards compatibility** with manual sync button behavior on older/legacy Flutter POS clients.

---

## 1. Architecture Overview

To scale the sync engine horizontally across multiple Cloud Run instances without incurring Redis costs, we use PostgreSQL's built-in `LISTEN` / `NOTIFY` protocol as a zero-cost pub/sub broker.

```mermaid
flowchart TD
    subgraph Client Layer (Flutter POS)
        Legacy[Legacy Client: Manual Sync Only] -->|REST HTTP POST| LoadBalancer
        TabletA[Tablet A: Online] <-->|WebSocket w/ Heartbeat| Instance1
        TabletB[Tablet B: Online] <-->|WebSocket w/ Heartbeat| Instance2
    end

    subgraph Server Layer (Cloud Run)
        LoadBalancer[Cloud Run Load Balancer] --> Instance1[NestJS Instance 1]
        LoadBalancer --> Instance2[NestJS Instance 2]
    end

    subgraph Database Layer
        Instance1 <-->|LISTEN / NOTIFY branch_channel| DB[(PostgreSQL Cloud SQL)]
        Instance2 <-->|LISTEN / NOTIFY branch_channel| DB
    end

    style DB fill:#1c72b8,stroke:#fff,stroke-width:2px,color:#fff
    style Legacy fill:#ffaa00,stroke:#fff,stroke-width:1px
```

---

## 2. Legacy Client & Manual Sync Support (Backwards Compatibility)

Some older devices or client versions rely on a manual "Sync" button (HTTP REST endpoints) instead of a WebSocket connection. To ensure they continue to function:
1. **REST Sync Remains Unchanged**: The REST endpoints (`POST /sync/push`, `POST /sync/pull`, etc.) will continue to accept incoming payloads exactly as before.
2. **Manual Sync Path Bypasses WebSocket Backoff**: The manual sync button path in the Flutter client (`syncKitchenOrders()` / `syncActiveOrders()`) will execute directly via immediate HTTP REST requests, completely bypassing any WebSocket exponential backoff or retry limits.
3. **Database Version Guards**: Both REST pushes and WebSocket pushes will be protected by database-level concurrency checks, preventing an older cache write from corrupting newer records.

---

## 3. Backend Scaling Improvements (NestJS & Postgres)

To enable scaling up to 10 instances dynamically on Cloud Run, we will implement PostgreSQL Pub/Sub.

### A. Dynamic Pub/Sub Channels
Instead of listening to a single global channel, NestJS instances will dynamically `LISTEN` only to the channels of branches currently connected to that instance (e.g. `LISTEN branch_channel_<branchId>`).
* **Connection**: When the first tablet of `Branch_X` connects to `Instance_1`, the instance issues `LISTEN branch_channel_Branch_X`.
* **Disconnection**: When the last tablet of `Branch_X` disconnects from `Instance_1`, the instance runs `UNLISTEN branch_channel_Branch_X` to save bandwidth.

### B. Lightweight Notifications
To avoid Postgres's **8KB payload limit** on `NOTIFY` commands, we will never send full entity data over the pub/sub channel.
* **Notification Payload format**:
  ```json
  { "branchId": "uuid", "entity": "kitchenOrders", "entityId": "uuid", "action": "update" }
  ```
* When other instances receive this payload, they forward the lightweight metadata to their local client pools, prompting the targets to fetch only what changed.

### C. Version Guards on Database Upserts
Update Drizzle repository files to include version checking. On conflicts, write updates only if the incoming data version is higher than the current value:
```typescript
.onConflictDoUpdate({
  target: schema.orders.id,
  set: { ... },
  where: sql`excluded.version > orders.version` // Version check prevents rollback corruption
})
```

### D. Throttled Cleanups
Remove background deletes (`cleanOldChangeLogs`) from the operational `push()` transaction. Instead, run a single daily cleanup cron job at 3:00 AM using NestJS `@nestjs/schedule`.

---

## 4. Frontend Connection & Sync Reliability (Flutter POS)

We will implement the improvements outlined in `specs/008-websocket-sync-improvements/SPECIFICATION.md`:

### A. Handshake and Connection Health (Heartbeat)
* **Welcome Handshake**: Client sets its internal connection state to `connected` immediately upon receiving `{ tipo: 'welcome', status: 'connected' }` from the backend gateway, preventing missing initial broadcasts.
* **Ping/Pong Heartbeat**: Client will send a lightweight ping `{"event": "ping"}` every 30 seconds. The backend `SyncGateway` will reply with `{"tipo": "pong"}`. If no pong is received within 5 seconds, the client disconnects and triggers its reconnection sequence.

### B. 3x Exponential Backoff for WebSocket Syncs
When a WebSocket broadcast triggers a sync (such as `syncKitchenOrders()`), any network failures will trigger a 3-attempt retry loop with exponential backoff (2s, 4s, 6s) to handle transient drops, while manual sync button commands execute immediately.

### C. Race Condition Prevention (Flicker Lock)
To prevent the UI from flickering when a client receives a broadcast reflecting its own optimistic update:
1. Maintain a local set of pending updates: `final Set<String> _pendingKitchenStatusUpdates = {}`.
2. When the user changes a status (e.g. marking a dish as ready), add its ID to the set.
3. During a sync, preserve the local optimistic state of any ID in the set.
4. Remove the ID from the set after a 2-second grace period (giving the backend time to commit).
