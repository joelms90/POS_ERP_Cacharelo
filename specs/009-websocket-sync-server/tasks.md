# Tasks: WebSocket Sync Server

**Input**: Design documents from `/specs/009-websocket-sync-server/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), checklists/requirements.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic dependencies

- [ ] T001 Install NestJS WebSockets packages: Run `pnpm add @nestjs/websockets @nestjs/platform-ws ws` and `pnpm add -D @types/ws` in `apps/sync_api`
- [ ] T002 Add Flutter WebSockets package: Add `web_socket_channel: ^3.0.1` dependency to `apps/pos_flutter/pubspec.yaml` and run `flutter pub get`
- [ ] T003 Configure linting rules for gateway and ws protocols in both projects

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema, gateway foundation, and authorization guards

**⚠️ CRITICAL**: Foundational tasks must be completed before starting any user story implementations.

- [ ] T004 Define Drizzle model: Declare the `changeLog` table in `apps/sync_api/src/database/schema.ts` as a new isolated table. Run `pnpm run db:migrate` or generate the migration.
- [ ] T005 Create JWT validation guard: Implement a WebSocket authentication helper in `apps/sync_api/src/modules/sync/guards/ws-jwt.guard.ts` using the existing `JwtService` without modifying current auth filters.
- [ ] T006 Implement Base WebSocket Gateway: Create `apps/sync_api/src/modules/sync/sync.gateway.ts` utilizing `@WebSocketGateway({ path: '/sync' })`. Register it in `apps/sync_api/src/modules/sync/sync.module.ts` and handle JWT-based authentication in `handleConnection()`.
- [ ] T007 Implement Flutter connection manager: Create `apps/pos_flutter/lib/ui/common/sync_socket_service.dart` with state tracking, event emitters, and handshake config.

**Checkpoint**: Foundation ready - local socket handshake can connect and authenticate successfully.

---

## Phase 3: User Story 1 - Real-Time Order Dispatch (Priority: P1) 🎯 MVP

**Goal**: Deliver instant order broadcasts from Cajero/Mesero to Cocina (KDS).

**Independent Test**: Connect Mesero and Cocina terminals on the same local network, send a mock order update, and verify it updates the Cocina screen in < 800ms.

- [ ] T008 [US1] Create ChangeLog recording helper: Modify backend `apps/sync_api/src/modules/sync/sync.service.ts` to insert entries into `changeLog` inside the transaction blocks of `push()`. Do NOT alter the existing REST response structure or DTO validation schema.
- [ ] T009 [US1] Implement WebSocket Broadcast handler: Add sucursal room segmentation logic in `sync.gateway.ts` (e.g., segmenting by `branchId`) and implement message forwarding so all devices in the branch receive the `{ tipo: "cambio" }` packet.
- [ ] T010 [US1] Implement live KDS receiver: Update Flutter KDS controller in `apps/pos_flutter/lib/ui/common/app_state.dart` to subscribe to WebSocket change streams and update active order state instantly.
- [ ] T011 [US1] Implement live order push client: Update Flutter client in `app_state.dart` to send a `{ tipo: "push", ... }` packet when an order is created, handle the server `ack` response, and update state to `synced`.
- [ ] T012 [US1] Verify broadcast test: Create a mock testing sequence simulating waiter transaction submission and KDS display state update.

**Checkpoint**: User Story 1 works. Table changes and new orders propagate immediately across terminals in real-time.

---

## Phase 4: User Story 2 - Offline Continuity & Reconnection (Priority: P2)

**Goal**: Re-establish socket connections automatically and sync missed events via `change_log`.

**Independent Test**: Kill server, write orders offline, restart server, verify automatic reconnection, caught up remote events, and pushed offline items.

- [ ] T013 [US2] Implement backoff reconnect loop: Add exponential backoff logic (1s, 3s, 10s, 15s) in `sync_socket_service.dart` to handle connection drops.
- [ ] T014 [US2] Implement resync server handler: In `sync.gateway.ts`, catch the `{ tipo: "resync", desde: timestamp }` packet and query `changeLog` WHERE `branchId` = branch and `versionAt` > desde, returning updates in a `{ tipo: "cambios" }` response.
- [ ] T015 [US2] Implement local conflict resolver: Add Last-Write-Wins logic in `app_state.dart` when reconciling delta changes, comparing `updatedAt` timestamps before modifying secure storage data.
- [ ] T016 [US2] Push offline queue: Implement the auto-trigger that sends pending local transactions in `_pendingSaleSyncJobs` sequentially upon socket re-connection.

**Checkpoint**: User Story 2 works. Sockets reconnect automatically and sync updates cleanly in both directions without duplicates.

---

## Phase 5: User Story 3 - Production Compatibility & Fallback (Priority: P3)

**Goal**: Ensure legacy REST devices continue working without modification, and provide an automated REST fallback for new devices if WebSockets fail.

**Independent Test**: Perform automated validation tests on existing REST endpoints (`POST /sync/push`, `POST /sync/pull`) during WebSocket gateway rollout to prove zero degradation in production.

- [ ] T017 [US3] Add REST endpoints regression test: Write integration tests in `apps/sync_api/test/` verifying that REST push and pull operations continue working exactly as before with zero changes to their DTO validations.
- [ ] T018 [US3] Implement connection timeout fallback: In `sync_socket_service.dart`, if the WebSocket fails to connect after 30 seconds, transition the global connection state to `degradedRest`.
- [ ] T019 [US3] Setup REST background polling timer: In `app_state.dart`, if state is `degradedRest`, initiate a 15-second polling timer using the existing `POST /sync/push` and `POST /sync/pull` endpoints.
- [ ] T020 [US3] Implement auto-recovery to WebSockets: Keep attempting a silent socket handshake in the background during REST fallback, and restore full WebSocket mode once successful.

**Checkpoint**: User Story 3 works. Firewalled devices switch back and forth from WebSockets to REST polling transparently, and legacy REST devices continue running without any software updates.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Production readiness, cleanups, and indicators

- [ ] T021 Implement change_log purge Cron Job: Create a NestJS cron task to clean entries in `changeLog` older than 7 days.
- [ ] T022 Add visual connection indicator: Create `apps/pos_flutter/lib/ui/widgets/connection_indicator.dart` showing a subtle badge (Green = Sockets Connected, Yellow = REST Fallback, Red = Offline) in the top bar of ordering/cashier screens.
- [ ] T023 Document e2-micro PM2 & Nginx VM setup: Write deployment scripts and Nginx configuration templates for SSL wss reverse proxying in `apps/sync_api/infra/`.

---

## Dependencies & Execution Order

1. **Phase 1 Setup**: MUST run first to install dependencies in NestJS and Flutter.
2. **Phase 2 Foundational**: Generates migrations and sets up the server gateway.
3. **Phase 3 (US1)**: Must be completed to deliver the primary value of real-time restaurant synchronization.
4. **Phase 4 & 5**: Can run in parallel after Phase 3 is completed.
5. **Phase 6**: Final cleanup, indicators, and VM documentation.
