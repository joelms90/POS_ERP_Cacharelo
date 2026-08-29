# Waiter Order Sync And Ready Notification Investigation

Date: 2026-08-05

## Scope

Investigate these waiter reports before implementation:

- Some orders disappear when waiters take several tables.
- Waiters sometimes miss order-ready notifications.
- Dishes ready for pickup are not persistent in `Pedidos listos para entregar`.

This document is a root-cause analysis and implementation proposal. No code changes are included here.

## Findings

### 1. Orders can appear to disappear after polling

Current Flutter behavior:

- `submitOrder()` immediately updates local table state and marks every submitted item as `isSent=true`.
- It then starts `_pushOpenOrderToCloud(...)` with `unawaited(...)`.
- `_pushOpenOrderToCloud()` logs failures but does not keep a durable retry job for open orders/items/kitchen-send.
- Later, `syncActiveOrders()` polls `/orders/active` and replaces local table items with the server copy.
- If the cloud create/add/send failed or was delayed, polling can overwrite the optimistic local table with stale/missing server state.

Relevant code:

- `lib/ui/common/app_state.dart`
  - `submitOrder(...)`
  - `_pushOpenOrderToCloud(...)`
  - `syncActiveOrders(...)`

Production evidence:

- Cloud Run logs show repeated `/api/sync/pull` 500s on 2026-08-05 around `21:57:35Z`.
- Detailed error: PostgreSQL connection exhaustion:
  - `remaining connection slots are reserved for non-replication superuser connections`
- That means polling was failing under load, which can make devices diverge and then reconcile unpredictably.

Backend connection risk:

- `apps/sync_api/src/database/connection.ts` uses `new Pool({ connectionString })` with default pool settings.
- `make backend-deploy-fast` deploys Cloud Run with `--max-instances 10`.
- Cloud Run Terraform state shows container concurrency `80`.
- With default `pg` pool behavior per instance, many tablets polling at once can exhaust Cloud SQL connections.

Root cause:

The waiter app treats cloud order submission as fire-and-forget but treats server polling as authoritative. When the server write or poll fails under load, local optimistic orders can be overwritten by stale server state.

### 2. Ready notifications are easy to miss

Current Flutter behavior:

- Ready notifications are only in memory: `List<String> readyNotifications = []`.
- `syncKitchenOrders()` compares old in-memory status vs new status.
- It adds a notification only when a ticket changes to `ready` during that sync.
- If the waiter device was offline, restarted, logged out, or missed the transition, the item can appear in `kitchenOrders` as already `ready` without generating a notification.
- The toast is visual only. There is no sound/vibration.

Relevant code:

- `lib/ui/common/app_state.dart`
  - `syncKitchenOrders()`
  - `readyNotifications`
  - `clearNotification(...)`
- `lib/ui/waiter/waiter_ordering_screen.dart`
  - `CustomToast`
  - `_buildReadyOrdersHeaderButton(...)`

Root cause:

Notifications are transition-based and volatile. There is no durable "unacknowledged ready ticket" model, and no device alert channel such as vibration/sound.

### 3. `Pedidos listos para entregar` is not persistent

Current Flutter behavior:

- The ready list is derived from current kitchen state:
  - `kitchenOrders.where((o) => o.status == 'ready')`
- It is not stored separately.
- Backend `/kitchen/active` returns only tickets with statuses:
  - `pending`
  - `preparing`
  - `ready`
- Once a ticket is marked `served`, it disappears from `/kitchen/active`.

Relevant code:

- `lib/ui/waiter/waiter_ordering_screen.dart`
  - `_showReadyOrdersDialog(...)`
- `apps/sync_api/src/modules/kitchen/repositories/kitchen.repository.ts`
  - `findActiveTicketsByBranch(...)`

Root cause:

The UI has no durable waiter-facing pickup queue. It is only a filtered view of current kitchen tickets. If sync misses, replaces, or removes a ticket, the waiter list changes immediately.

### 4. Kitchen WebSocket connectivity appears unstable

Production logs show repeated kitchen WebSocket disconnect/reconnect cycles for branch `91ce10b2-94c1-45e0-baf3-9485eae01fbf` on 2026-08-05 and 2026-08-06.

This is not necessarily the primary bug, but it increases reliance on REST fallback polling. Since REST polling is currently hitting DB connection exhaustion, the system has two weak paths at the same time.

## Proposed Fix

### Phase 1: Stop polling/server writes from losing waiter-visible orders

Backend:

- Configure the PostgreSQL pool explicitly:
  - low `max` per Cloud Run instance, for example `max: 3` to `5`
  - `idleTimeoutMillis`
  - `connectionTimeoutMillis`
- Consider reducing Cloud Run max instances or concurrency until Cloud SQL capacity is right-sized.
- Optimize `/sync/pull`:
  - remove broad global table pulls for unrelated branches where possible
  - avoid the self-healing `UPDATE branch_tables ...` on every pull
  - move self-healing to a scheduled/background process or make it branch-scoped and rate-limited
- Add structured logs for:
  - order create
  - order add items
  - kitchen send
  - failed push/active poll

Flutter:

- Replace fire-and-forget open-order submission with a durable pending queue:
  - `pendingOrderSyncJobs`
  - job type: `createOrder`, `addItems`, `sendKitchen`
  - persisted in secure/local storage
  - retry with backoff until acknowledged
- Do not mark new order items as permanently synced until server confirms.
- When `syncActiveOrders()` receives server data, merge carefully:
  - keep local pending items visible
  - show sync status on table/order if pending or failed
  - never clear local pending items just because the server does not have them yet

Expected behavior after Phase 1:

- A waiter can take multiple tables quickly.
- If the network/API is slow, the UI keeps the order visible as "pendiente de sincronizar".
- Polling cannot erase local pending items.

### Phase 2: Make ready pickup alerts durable

Backend:

- Add a durable waiter notification/ack model, or extend kitchen tickets with waiter acknowledgment fields.
- Recommended minimal table:
  - `waiter_ready_notifications`
  - `id`
  - `branch_id`
  - `ticket_id`
  - `order_id`
  - `table_id`
  - `table_label`
  - `station`
  - `status`: `unread`, `seen`, `served`
  - `ready_at`
  - `seen_at`
  - `served_at`
  - `created_at`
- When kitchen ticket status becomes `ready`, create/upsert a notification.
- Expose endpoints:
  - `GET /waiter/ready-notifications?branchId=...`
  - `PATCH /waiter/ready-notifications/:id/seen`
  - `PATCH /waiter/ready-notifications/:id/served`

Flutter:

- Add persisted `readyPickupNotifications` in `AppState`.
- Poll/sync ready notifications independently of visual toast.
- `Pedidos listos para entregar` should read from this durable list, not only from `kitchenOrders`.
- Only remove an item from the waiter pickup list after waiter taps `ENTREGADO` and backend confirms.

Expected behavior after Phase 2:

- If a waiter misses the instant toast, the ready dish remains in the pickup list.
- Restarting the app still shows unserved ready dishes.
- WebSocket loss does not lose ready alerts.

### Phase 3: Sound and vibration

Flutter:

- Add a small alert service:
  - vibrate on new unacknowledged ready notification
  - optional sound on Android
  - throttle repeated alerts per ticket
- Existing dependencies include `permission_handler`, but there is no current sound/vibration implementation.
- Add Android permission if needed:
  - `android.permission.VIBRATE`
- Candidate packages:
  - `vibration`
  - `audioplayers`

Behavior:

- Alert when a new ready notification enters unread state.
- Repeat gently if still unread after a configurable time, for example every 60 seconds, with a max repeat count.
- Provide a setting to disable sound, keep vibration enabled by default if allowed.

## Implementation Order

1. Backend DB pool and `/sync/pull` protection.
2. Flutter pending open-order queue and merge strategy.
3. Backend durable waiter-ready notification model.
4. Flutter persistent pickup list.
5. Sound/vibration alert service.
6. Add tests and deploy in two pieces:
   - backend first
   - APK/admin/frontend after backend is live

## Tests To Add

Backend:

- `/sync/pull` does not run broad self-healing work for every request.
- kitchen `ready` status creates durable waiter notification.
- marking served removes notification from active waiter pickup list.
- repeated ready updates are idempotent.

Flutter:

- failed order create keeps local pending items visible after `syncActiveOrders()`.
- later server confirmation merges pending items without duplicates.
- ready notification persists across `syncKitchenOrders()` calls.
- ready notification survives app restart via local storage.
- tapping `ENTREGADO` waits for backend success before removing the row.

## Open Questions For Approval

- Should ready notifications be branch-wide for all waiters, or assigned to the waiter who owns the order?
- Should sound be always on, or configurable per device?
- Should `Pedidos listos para entregar` show only ready items, or also recently served items for a short audit window?
- For pending order sync failures, should the waiter see a blocking red banner or a table-level sync badge?

## Recommendation

Do not fix this only with faster polling. Polling more often will increase DB pressure and make the connection-exhaustion problem worse.

The durable fix is:

- reduce DB connection pressure,
- make waiter order submission retryable and merge-safe,
- make ready pickup notifications durable and acknowledged.
