# Waiter Order Sync Long-Term Fix Specs

Date: 2026-08-05

## Purpose

This document is an implementation handoff for agents with no prior context.

The target problems are:

1. Waiter orders sometimes appear to disappear when several tables are being handled.
2. Waiters sometimes miss notifications that dishes are ready.
3. `Pedidos listos para entregar` is not persistent enough for operations.
4. Backend polling/sync can overload Cloud SQL during outages or busy service.

Related investigation:

- `waiter_order_sync_notifications_investigation.md`

## Current Architecture Summary

Repos/apps involved:

- Flutter POS APK:
  - `/Users/joelmorales/web/POS-ERP/apps/pos_flutter`
- Backend sync API:
  - `/Users/joelmorales/web/POS-ERP/apps/sync_api`

Important Flutter files:

- `lib/ui/common/app_state.dart`
  - `submitOrder(...)`
  - `_pushOpenOrderToCloud(...)`
  - `syncActiveOrders(...)`
  - `syncKitchenOrders(...)`
  - `syncTableStates(...)`
  - `_startFallbackPolling(...)`
  - `readyNotifications`
- `lib/ui/waiter/waiter_ordering_screen.dart`
  - waiter order UI
  - `CustomToast`
  - `Pedidos Listos para Entregar`
- `lib/ui/common/sync_socket_service.dart`
  - WebSocket sync client

Important backend files:

- `src/database/connection.ts`
- `src/modules/sync/sync.service.ts`
- `src/modules/sync/sync.gateway.ts`
- `src/modules/orders/orders.controller.ts`
- `src/modules/orders/orders.service.ts`
- `src/modules/orders/repositories/orders.repository.ts`
- `src/modules/kitchen/kitchen.controller.ts`
- `src/modules/kitchen/kitchen.service.ts`
- `src/modules/kitchen/repositories/kitchen.repository.ts`
- `src/database/schema.ts`

Current behavior:

- WebSocket is primary sync.
- REST fallback polling is every 30 seconds while WebSocket is disconnected.
- Waiter fallback polling runs:
  - `syncActiveOrders()`
  - `syncTableStates()`
  - `syncKitchenOrders()`
- `submitOrder()` updates local state immediately, then calls `_pushOpenOrderToCloud(...)` with `unawaited(...)`.
- If backend submission fails, local order is not durably queued for retry.
- `syncActiveOrders()` treats server active orders as authoritative and can overwrite local optimistic table items.
- `readyNotifications` is in-memory only.
- `Pedidos listos para entregar` is derived from `kitchenOrders.where(status == 'ready')`.

Production evidence:

- Cloud Run logs on 2026-08-05 showed repeated `/api/sync/pull` 500s.
- Detailed error: PostgreSQL connection exhaustion, `remaining connection slots are reserved for non-replication superuser connections`.
- This supports the theory that polling under load can fail and contribute to stale/overwritten tablet state.

## Compatibility Requirements

All backend changes must be backward compatible with existing APKs.

Old APKs must continue working with:

- `/orders`
- `/orders/:id/items`
- `/orders/active`
- `/kitchen/active`
- `/kitchen/orders/:orderId/send`
- `/kitchen/tickets/:id/status`
- `/sync/pull`

New APKs may use new endpoints/fields, but old APKs must not break.

No destructive production data changes unless explicitly approved.

## Phase 1 Spec: Backend Sync Stability

### Goal

Reduce DB connection pressure and make sync/polling failures less likely without changing waiter workflows.

### Backend Changes

#### 1. Configure PostgreSQL Pool

File:

- `apps/sync_api/src/database/connection.ts`

Current:

```ts
export const pool = new Pool({
  connectionString,
});
```

Change to explicit limits:

```ts
export const pool = new Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX ?? 5),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? 5000),
});
```

Recommended production env:

- `PG_POOL_MAX=3` or `5`
- `PG_IDLE_TIMEOUT_MS=30000`
- `PG_CONNECTION_TIMEOUT_MS=5000`

Acceptance criteria:

- Cloud Run instances cannot each open unbounded/default DB connections.
- Backend build passes.
- Existing endpoints still work.

#### 2. Reduce Cloud Run Connection Multiplication

Deploy config currently uses `--max-instances 10`.

Options:

- Keep max instances but enforce small pool.
- Consider reducing max instances to `5` if Cloud SQL still exhausts connections.
- Consider setting Cloud Run concurrency lower only if request latency stays acceptable.

Acceptance criteria:

- Document chosen values in Makefile/deploy command or environment settings.
- Verify Cloud Run revision has env vars set.

#### 3. Optimize `/sync/pull`

File:

- `apps/sync_api/src/modules/sync/sync.service.ts`

Current risk:

- `/sync/pull` queries many global tables by timestamp.
- It also runs a broad self-healing update for `Para Llevar` tables on every pull.

Change:

- Scope queries by branch/business where practical.
- Do not run broad self-healing on every pull.
- Move self-healing to one of:
  - scheduled job
  - manual maintenance endpoint
  - rate-limited branch-scoped query

Minimum acceptable first implementation:

- Guard self-healing so it runs at most once every 1-5 minutes per process.
- Make it branch-scoped using `pullSyncDto.branchId`.

Better implementation:

- Remove self-healing from `/sync/pull`.
- Add scheduled backend task that runs safely with limited frequency.

Acceptance criteria:

- `/sync/pull` does less work per tablet request.
- No change to response shape.
- Existing APKs continue to parse response.

#### 4. Backend Operational Logs

Add structured logs for:

- order create failure
- add order items failure
- kitchen send failure
- sync pull failure

Include:

- branchId
- tableId when available
- orderId when available
- endpoint/action
- error message

Do not log:

- JWT
- PIN
- full payment card/reference data

### Tests

Backend:

- `npm run build`
- Add/update tests for any sync service behavior changed.
- Smoke test:
  - `GET /api/health`
  - `POST /api/sync/pull`
  - `GET /api/orders/active?branchId=...`

### Deployment

Use root Makefile:

- `make backend-deploy-fast`

### Rollback

Rollback Cloud Run to previous revision if:

- `/api/health` fails
- login/order active/kitchen active endpoints fail
- DB errors increase

## Phase 2 Spec: Durable Waiter Pending Order Sync

### Goal

Prevent waiter orders/items from disappearing when backend writes or polling fail.

### Problem To Solve

Today:

1. Waiter confirms order.
2. Flutter updates local table immediately.
3. Flutter sends to backend with `unawaited(_pushOpenOrderToCloud(...))`.
4. If backend request fails, there is no durable retry job.
5. Later `syncActiveOrders()` replaces local table items with server items.
6. If server does not have the new order/items, the local order can appear to disappear.

### Backend Changes

#### 1. Add Client Idempotency Fields

Add idempotency so Flutter retries cannot duplicate orders/items.

Recommended schema additions:

Orders:

- `client_uuid text nullable unique`

Order items:

- `client_uuid text nullable unique`

Alternative:

- unique composite keys:
  - `orders(branch_id, client_uuid)`
  - `order_items(order_id, client_uuid)`

Migration requirements:

- Idempotent migration using `IF NOT EXISTS`.
- Do not rewrite existing rows.

#### 2. Accept Client UUIDs

DTOs:

- `CreateOrderDto`
  - optional `clientUuid`
- `AddOrderItemsDto.items[]`
  - optional `clientUuid`

Repository:

- On create order:
  - If `clientUuid` exists and row already exists, return existing order with items.
  - Else create normally.
- On add items:
  - Insert items idempotently by `clientUuid`.
  - If some item UUIDs already exist, do not duplicate them.
  - Return current order state/new item result clearly.

Acceptance criteria:

- Retrying the same create request returns one order, not duplicates.
- Retrying add-items with the same item UUIDs does not duplicate items.

#### 3. Idempotent Kitchen Send

Current endpoint:

- `POST /kitchen/orders/:orderId/send`

Current risk:

- It creates station tickets for unsent items and marks items sent.
- Need to ensure retry is safe.

Expected behavior:

- Retrying kitchen send for already sent items is safe.
- If new unsent items exist, it creates/updates needed tickets.
- If none exist, returns success with `No new items to send to kitchen`.

### Flutter Changes

#### 1. Add Pending Order Job Model

Location suggestion:

- Add classes in `lib/ui/common/app_state.dart` first, or split into a small service file later.

Model:

```dart
enum PendingOrderJobType {
  createOrder,
  addItems,
  sendToKitchen,
}

class PendingOrderSyncJob {
  final String id;
  final PendingOrderJobType type;
  final String branchId;
  final String tableRemoteId;
  final String? orderId;
  final List<OrderItem> items;
  final DateTime createdAt;
  final int attemptCount;
  final String? lastError;
}
```

Persist jobs in local/secure storage. If secure storage is not ideal for larger payloads, use existing app-local storage patterns or add a small local persistence service.

#### 2. Change `submitOrder()`

Current:

- marks items sent
- calls `_pushOpenOrderToCloud(...)` unawaited

New:

- Generate stable client UUID for the order if this is a new order.
- Generate stable client UUID per submitted item.
- Add items locally with sync state:
  - `pendingSync`
  - `synced`
  - `failedSync`
- Persist a pending job before or at the same time local UI changes.
- Start retry worker.
- Do not remove local pending items if backend call fails.

Need to extend `OrderItem` or local metadata:

- `syncState`
- `clientUuid`
- maybe `serverItemId`

Acceptance criteria:

- App restart after confirm preserves pending order/items.
- Pending items remain visible after `syncActiveOrders()`.

#### 3. Retry Worker

Add retry mechanism:

- Retry immediately once.
- Then backoff:
  - 5s
  - 15s
  - 30s
  - 60s max
- Retry on:
  - app startup after login
  - manual sync
  - WebSocket reconnect
  - fallback polling cycle

Do not spin aggressively while offline.

#### 4. Merge-Safe `syncActiveOrders()`

Current:

- Replaces local table items with `_itemsFromCloud(order['items'])`.
- Clears items from tables no longer active server-side.

New:

- Build server items.
- Build local pending items for same table.
- Merge:
  - server synced items
  - local pending/failed items not yet confirmed
- Do not clear a table if it has local pending jobs/items.
- If server order confirms matching `clientUuid`, mark pending item as synced and remove job.

Acceptance criteria:

- Pending local items survive server poll with missing order.
- Once server confirms, no duplicate line appears.
- If order closes/paid, pending jobs are either completed or explicitly failed with visible UI.

#### 5. UI Feedback

Add visible status:

- Table badge:
  - `Sincronizando`
  - `Error sync`
- Cart line status:
  - small icon or text for pending/failed
- Manual retry button on failed sync.

Acceptance criteria:

- Waiter knows order is not lost.
- Manager can understand if a table has pending sync.

### Tests

Flutter:

- Confirm order while mocked backend create fails.
- Run `syncActiveOrders()` with empty server response.
- Assert table still shows pending items.
- Then mock backend success.
- Assert items become synced and no duplicates.

Backend:

- idempotent create retry returns same order.
- idempotent add-items retry does not duplicate rows.
- kitchen send retry is safe.

### Deployment

Order:

1. Backend migration + backend deploy.
2. APK rollout branch by branch.

Old APK compatibility:

- Old APK does not send `clientUuid`; backend should keep old behavior.

## Phase 3 Spec: Durable Ready-To-Deliver Queue

### Goal

Make `Pedidos listos para entregar` persistent and reliable even if WebSocket/polling transition is missed.

### Backend Changes

#### 1. Add Table

Recommended table: `waiter_ready_notifications`

Fields:

- `id uuid primary key default_random`
- `branch_id uuid not null references branches(id)`
- `ticket_id uuid not null references kitchen_tickets(id)`
- `order_id uuid not null references orders(id)`
- `table_id uuid not null references branch_tables(id)`
- `table_label varchar`
- `station varchar`
- `status varchar not null default 'unread'`
  - `unread`
  - `seen`
  - `served`
- `ready_at timestamp with time zone not null`
- `seen_at timestamp with time zone null`
- `served_at timestamp with time zone null`
- `created_at timestamp with time zone default now`
- `updated_at timestamp with time zone default now`

Constraints:

- unique `ticket_id`
- index `branch_id, status`
- index `ready_at`

#### 2. Create Notification On Kitchen Ready

File:

- `src/modules/kitchen/kitchen.service.ts`
- `src/modules/kitchen/repositories/kitchen.repository.ts`

When `updateTicketStatus(id, 'ready')` succeeds:

- Find branch/order/table/station details.
- Upsert `waiter_ready_notifications` for ticket.
- Broadcast `waiterReadyNotifications` change over WebSocket.

Do not create duplicate notifications if kitchen taps ready twice.

#### 3. New Endpoints

New module suggestion:

- `src/modules/waiter-notifications`

Endpoints:

- `GET /waiter/ready-notifications?branchId=...`
  - returns `unread` and optionally `seen`
  - default active statuses: `unread`, `seen`
- `PATCH /waiter/ready-notifications/:id/seen`
- `PATCH /waiter/ready-notifications/:id/served`

Response shape:

```json
{
  "id": "...",
  "ticketId": "...",
  "orderId": "...",
  "tableId": "...",
  "tableLabel": "Mesa 3",
  "station": "cocina",
  "status": "unread",
  "readyAt": "..."
}
```

Acceptance criteria:

- Ready ticket creates one active notification.
- Notification remains until waiter marks served.
- App restart can reload active notifications.

### Flutter Changes

#### 1. Add Ready Notification Model

Model:

```dart
class ReadyPickupNotification {
  final String id;
  final String ticketId;
  final String orderId;
  final String tableId;
  final String tableLabel;
  final String station;
  final String status;
  final DateTime readyAt;
}
```

State:

- `List<ReadyPickupNotification> readyPickupNotifications`

Persist locally for offline display.

#### 2. Add Sync Method

Add:

- `syncReadyPickupNotifications()`

Call from:

- waiter login sync
- WebSocket change `waiterReadyNotifications`
- fallback polling for waiter
- manual sync

#### 3. Change Waiter UI

Current:

- `readyOrders = kitchenOrders.where((o) => o.status == 'ready')`

New:

- Use `readyPickupNotifications` as the source of truth.
- Keep the list visible until backend served ack succeeds.
- If offline and served is tapped:
  - queue served ack locally
  - show pending served state
  - remove only after backend confirms or keep a pending badge.

#### 4. Notification Trigger

When a new notification appears with status `unread`:

- add visual toast
- trigger sound/vibration in Phase 4
- mark `seen` when displayed or when dialog is opened, depending on desired UX.

Acceptance criteria:

- Missing WebSocket transition does not lose ready pickup item.
- Restarting the waiter app reloads ready items.
- Served item disappears after backend confirmation.

### Tests

Backend:

- ready status creates notification.
- second ready update does not duplicate.
- served endpoint updates notification.

Flutter:

- sync ready notifications populates list.
- list survives app restart.
- served ack removes only after success.

## Phase 4 Spec: Sound And Vibration

### Goal

Make new ready notifications harder to miss.

### Flutter Changes

#### 1. Dependencies

Candidate packages:

- `vibration`
- `audioplayers`

Existing:

- `permission_handler` already exists.

Android manifest:

- Add `android.permission.VIBRATE` if required.

#### 2. Alert Service

Add a small service:

- tracks alerted notification IDs
- vibrates/sounds for new unread notifications
- throttles repeat alerts
- respects device setting

Recommended defaults:

- vibration on
- sound on if not disruptive, otherwise configurable
- repeat every 60 seconds for unread items, max 3 repeats

#### 3. Settings

Add device settings:

- ready notification sound enabled
- ready notification vibration enabled

Persist settings locally.

Acceptance criteria:

- New unread ready notification vibrates/sounds once.
- Same notification does not alert repeatedly without throttle.
- User can disable sound.

## Phase 5 Spec: Rollout

### Backend First

Deploy backend phases before APK changes:

1. DB pool/sync pull stability.
2. Idempotency fields/endpoints.
3. Ready notification endpoints.

Old APKs must continue to work.

Commands:

- `make backend-migrate` if schema changes exist.
- `make backend-deploy-fast`

### APK Rollout

Roll sucursal by sucursal.

Pilot branch:

- Choose one branch where operations can be observed closely.

Pilot checks:

- Waiter opens several tables quickly.
- Kill/restart app after sending order.
- Turn Wi-Fi off/on.
- Kitchen marks tickets ready.
- Waiter sees persistent pickup list.
- No duplicate kitchen tickets.
- No duplicate order items.
- Cashier can still charge correctly.

Rollback:

- Keep previous APK available.
- Backend remains backward compatible, so reverting APK should be possible.

### Monitoring

During pilot:

- Cloud Run 5xx count.
- `/api/sync/pull` latency and errors.
- DB connection exhaustion errors.
- duplicate order/item complaints.
- missed ready notification complaints.

## Recommended Implementation Sequence

1. Phase 1 backend pool and sync pull mitigation. Implemented and deployed in Cloud Run revision `pos-sync-api-00109-d9b`.
2. Backend idempotency migration for orders/order items. Implemented, migrated, and deployed in Cloud Run revision `pos-sync-api-00110-jmm`.
3. Flutter pending order queue and merge-safe `syncActiveOrders()`. Implemented locally in `lib/ui/common/app_state.dart` and `lib/services/secure_storage_service.dart`; APK rollout still pending.
4. Backend durable ready notifications. Not implemented yet; current implementation persists ready pickups locally in the APK.
5. Flutter persistent ready pickup list. Implemented locally in `lib/ui/common/app_state.dart`, `lib/services/secure_storage_service.dart`, and `lib/ui/waiter/waiter_ordering_screen.dart`; APK rollout still pending.
6. Sound/vibration. Implemented locally with Flutter `SystemSound.play(SystemSoundType.alert)` and `HapticFeedback.vibrate()`; APK rollout still pending.
7. Branch-by-branch APK rollout.

## Current Implementation Notes

- `OrderItem` now carries optional `clientUuid` and `syncState`.
- Waiter `submitOrder()` persists a pending open-order job before retrying the backend.
- Pending open-order jobs are stored under `pending_order_sync_jobs`.
- `syncActiveOrders()` now merges cloud items with local pending/failed waiter items instead of replacing the table blindly.
- The REST fallback polling interval is now 30 seconds.
- The existing backend kitchen send path is idempotent for already-sent order items, so order job retry should not duplicate kitchen tickets after items are marked sent.
- Ready kitchen tickets are copied into a persisted local `readyPickupOrders` list under `ready_pickup_orders`.
- Waiter `Pedidos Listos para Entregar` now reads the persisted pickup list, so ready items do not disappear just because a later kitchen poll misses them.
- Ready pickup alerts sound/vibrate once per ticket while the app is running and do not alert again for tickets restored from local storage after restart.
- Marking a ready ticket as `served` removes it from the persisted pickup list.

Validation run:

- `dart analyze lib/ui/common/app_state.dart lib/services/secure_storage_service.dart test/waiter_billing_flow_test.dart` passes with info-level existing style lints.
- `flutter test test/waiter_screen_test.dart --concurrency=1` passes, including a persistent ready pickup dialog test.
- `flutter test test/waiter_billing_flow_test.dart --concurrency=1` currently fails on existing 26-column receipt truncation expectations, not on the waiter order queue change.

## Non-Goals

- Do not fix by increasing polling frequency.
- Do not make tablets poll every few seconds.
- Do not remove WebSocket; keep WebSocket as fast path.
- Do not make ready notifications only local; they must be recoverable after restart.

## Approval Needed Before Implementation

Confirm:

1. Should ready notifications be branch-wide for all waiters, or only for the waiter who owns the order?
2. Should `seen` happen when toast appears, or only when waiter opens `Pedidos listos`?
3. Should sound be enabled by default?
4. Pilot branch for first APK rollout.
