# Implementation Plan: WebSocket Sync Server

**Branch**: `009-websocket-sync-server` | **Date**: 2026-07-07 | **Spec**: [spec.md](file:///Users/joelmorales/web/POS-ERP/specs/009-websocket-sync-server/spec.md)

**Input**: Feature specification from `/specs/009-websocket-sync-server/spec.md`

## Summary

Implement a secure, multi-tenant WebSocket synchronization system that coexists with the existing REST endpoints. The system is currently in production, meaning **we must avoid any breaking changes to the REST sync API**. 

To achieve this:
1. **Zero Breaking Changes to REST API**: All current HTTP endpoints (`POST /sync/push`, `POST /sync/pull`, `POST /sync/ack`) will remain completely untouched and active to support legacy tablets.
2. **Unified Write Path**: The new NestJS WebSocket Gateway (using pure `ws` for lightweight execution on the e2-micro VM) will serve as a protocol adapter. Sockets will accept incoming `{ tipo: "push" }` packets, validate them, and forward them directly to the existing `SyncService.push()` business logic.
3. **Change Logging**: A new isolated table `change_log` will be added to Cloud SQL. Inside the transaction layer of `SyncService.push()`, we will append audit entries to `change_log` and fire WebSocket broadcast notifications. This ensures both REST-based writes and socket-based writes log updates and notify active WebSocket clients in real-time.
4. **Adaptive Client-Side Sync**: Newer Flutter clients will attempt WebSocket connections with exponential backoff. If they fail (e.g. behind restricted networks), they will fallback to the exact same REST sync endpoints.

---

## Technical Context

**Language/Version**:
- Backend: Node.js v20+ / NestJS v11.0.1 / TypeScript v5.7.3
- Frontend: Flutter v3.19+ / Dart v3.3+

**Primary Dependencies**:
- Backend: `@nestjs/websockets`, `@nestjs/platform-ws`, `ws` (lightweight WebSocket engine), `drizzle-orm` (existing)
- Frontend: `web_socket_channel` (for stable, platform-independent WebSockets), `http` (existing)

**Storage**:
- Backend DB: Cloud SQL PostgreSQL. New Table: `change_log` (isolated and non-blocking).
- Frontend DB: SecureStorage / SharedPreferences (existing)

**Testing**:
- Backend: Unit tests verifying that introducing the WebSocket module does not affect current REST controller routing, and integration tests confirming that REST push payloads successfully generate socket broadcast alerts.
- Frontend: Offline mock verification tests ensuring connection state transitions.

**Target Platform**:
- Backend: Compute Engine e2-micro VM (Debian/Linux, 1 vCPU, 1 GB RAM).
- Frontend: Android & Windows 10 Landscape Tablets.

**Performance Goals**:
- VM Resource consumption: PM2 memory limit at 800MB; target memory footprint for WebSocket logic under 15MB.
- Message latency: < 500ms broadcast delay across devices on the same sucursal.

**Constraints**:
- Absolute requirement of backward-compatibility for active production devices.
- Direct VPC peering or Cloud SQL Auth Proxy for VM-to-PostgreSQL connection.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Offline continuity**: PASS. The offline queue continues to process normally. Handshake dropouts prompt reconnection retries without disrupting local state or operation.
- **Local authority**: PASS. Local database operations remain the single source of truth; synchronization runs out-of-band.
- **Sync contract**: PASS. Message packets retain identical JSON formatting to ensure a unified schema. Sockets query query-parameters (`token`, `branchId`) for tenant isolation.
- **Cloud role**: PASS. Sockets coordinate live state transitions while Cloud SQL consolidates transactions. Existing REST endpoints are completely unaffected, eliminating deployment risk.
- **Verification**: PASS. We will add regression tests to run existing REST sync integration tests to prove no behavior changed.

---

## Project Structure

### Documentation (this feature)

```text
specs/009-websocket-sync-server/
├── spec.md                       # Feature specification
├── plan.md                       # This plan document
├── checklists/
│   └── requirements.md           # Specification validation checklist
└── tasks.md                      # Actionable, prioritized execution tasks
```

### Source Code Structure

```text
apps/sync_api/src/
├── database/
│   └── schema.ts                 # Add changeLog table definition without modifying other tables
├── modules/
│   └── sync/
│       ├── sync.module.ts        # Register WebSocket gateway and services
│       ├── sync.gateway.ts       # NestJS WebSocket gateway (ws wrapper)
│       └── sync.service.ts       # Modify push() non-destructively to write to changeLog and emit events
│
apps/pos_flutter/lib/
├── ui/
│   ├── common/
│   │   ├── app_state.dart        # Switch dynamically between WebSockets and REST fallback
│   │   └── sync_socket_service.dart # WebSocket wrapper with backoff reconnect logic
│   └── widgets/
│       └── connection_indicator.dart # Status bar component for visual connectivity tracking
```

**Structure Decision**:
Place the `SyncGateway` directly inside `apps/sync_api/src/modules/sync/` alongside the existing `SyncService` and `SyncController`. We will modify the `SyncService` class to record changes to the `change_log` table inside existing SQL write transactions and trigger WebSocket broadcasts. This guarantees that writes through the REST API also notify WebSocket-connected clients.

---

## Implementation Details & Coexistence Architecture

### 1. Database Schema Migration

We will add the new table to `schema.ts` without making any destructive adjustments to existing tables:

```typescript
export const changeLog = pgTable('change_log', {
  id: bigserial('id', { mode: 'string' }).primaryKey(),
  entity: varchar('entity', { length: 50 }).notNull(), // 'orders' | 'orderItems' | 'branchTables'
  entityId: uuid('entity_id').notNull(),
  branchId: uuid('branch_id').references(() => branches.id).notNull(),
  versionAt: timestamp('version_at', { withTimezone: true }).defaultNow().notNull(),
  payload: jsonb('payload').notNull(),
});
```
*Note*: This table is completely isolated. Adding it will not cause locks on operational tables.

### 2. Backward Compatible Write Integration

We will modify the backend `SyncService.push` function (which handles both REST and socket requests) in a non-destructive manner. 
At the end of the transaction:

```typescript
// Inside SyncService.push() transaction block...
// 1. Process orders, orderItems, etc. (existing code)
// 2. Append entries to changeLog for each modified order/table/item:
const changeLogsToInsert = [];
for (const order of pushData.orders) {
  changeLogsToInsert.push({
    entity: 'orders',
    entityId: order.id,
    branchId: order.branchId,
    payload: order,
  });
}
if (changeLogsToInsert.length > 0) {
  await tx.insert(schema.changeLog).values(changeLogsToInsert);
}

// 3. Notify WebSocket Gateway to broadcast updates to the sucursal room:
this.syncGateway.broadcastChange(branchId, {
  tipo: 'cambio',
  changes: changeLogsToInsert
});
```

This guarantees that whether a tablet uses the REST API or the WebSocket connection to submit orders, the change log is updated and all active WebSocket devices at that sucursal are notified in real-time.

### 3. Gateway Architecture

The Gateway acts as a thin delivery adapter:

```typescript
@WebSocketGateway({ path: '/sync' })
export class SyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => SyncService))
    private readonly syncService: SyncService,
  ) {}

  // Parse token, validate sucursal, and assign socket to sucursal-scoped client list
}
```
Use `forwardRef` to prevent circular dependencies between `SyncService` and `SyncGateway`.
