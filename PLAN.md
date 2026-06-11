# Living Roadmap (PLAN.md)

This roadmap tracks the high-level phases and tasks of the **Offline-First POS Architecture** project. Checkboxes represent implementation states verified via tests and lint checks.

---

## 🗺️ Phases Roadmap

### Phase 1: Setup (Shared Infrastructure)
- [x] **T001** Create Flutter POS project skeleton (`apps/pos_flutter/pubspec.yaml`)
- [x] **T002** Create Flutter source directories structure
- [x] **T003** Create Flutter test directories structure
- [x] **T004** Create Lambda TypeScript package skeleton (`apps/sync_api/package.json`)
- [x] **T005** Create Lambda source directories structure
- [x] **T006** Create migration and backend test directories structure
- [x] **T007** Create shared contracts package skeleton (`packages/shared_contracts/package.json`)
- [x] **T008** Copy OpenAPI sync contract to shared contracts schema
- [x] **T009** Copy printer contract to shared contracts schema

### Phase 2: Foundational (Blocking Prerequisites)
- [x] **T010** Configure Flutter dependencies (Isar, UUID, secure storage, biometrics)
- [x] **T011** Configure TypeScript, test tooling, and PostgreSQL client dependencies
- [x] **T012** Define shared transaction JSON schema
- [x] **T013** Define shared sync receipt JSON schema
- [x] **T014** Define shared conflict response JSON schema
- [x] **T015** Create `LocalTransaction` domain entity (UUID v4, totals, sync state)
- [x] **T016** Create `SyncOperation` domain entity (idempotency key, hash, retry state)
- [x] **T017** Create `PrintJob` and `PrinterDevice` domain entities
- [x] **T018** Create `POSDevice` and cached user session domain entities
- [x] **T019** Implement Isar collection mappings and indexes
- [x] **T020** Implement Isar database bootstrap and migration entrypoint
- [x] **T021** Implement stable UUID v4 and canonical payload hash utilities
- [x] **T022** Implement one-time online device registration client interface
- [x] **T023** Implement cached roles plus PIN/biometric offline unlock service
- [x] **T024** Create PostgreSQL migration (`001_offline_sync_baseline.sql`)
- [x] **T025** Implement RDS Proxy PostgreSQL connection factory
- [x] **T026** Implement structured audit logger for sync and printer events

### Phase 3: User Story 1 - Operar POS Sin Internet (Priority: P1) MVP
- [x] **T027** Add offline cash sale integration test
- [x] **T028** Add offline PIN/biometric role unlock test
- [x] **T029** Add local transaction UUID v4 and Isar commit unit test
- [x] **T030** Add print failure does not roll back sale test
- [x] **T031** Implement `LocalTransactionRepository` (Isar write before user success)
- [x] **T032** Implement `SyncOperationRepository` (enqueue pending operations)
- [x] **T033** Implement `PrintJobRepository` (durable printer queue)
- [x] **T034** Implement cash-only offline payment policy and external card reference guard
- [x] **T035** Implement offline sale service (roles, transaction, sync, and print queues)
- [x] **T036** Implement minimal POS sale screen flow for offline cash sales
- [x] **T037** Implement local sale status indicators (pending sync, failed print states)
- [x] **T038** Wire offline sale flow into Flutter application entrypoint

### Phase 4: User Story 2 - Sincronizar Al Reconectar (Priority: P2)
- [x] **T039** Add OpenAPI contract test for `POST /v1/sync/transactions`
- [x] **T040** Add OpenAPI contract test for `GET /v1/sync/receipts/{transactionId}`
- [x] **T041** Add Lambda idempotent duplicate replay test
- [x] **T042** Add Flutter reconnect sync worker integration test
- [x] **T043** Add inventory conflict sync test
- [x] **T044** Implement `TransactionSyncService` (idempotency and hash checks)
- [x] **T045** Implement `ConflictService` (payload mismatch and stock conflicts)
- [x] **T046** Implement `submitTransaction` Lambda handler
- [x] **T047** Implement `getSyncReceipt` Lambda handler
- [x] **T048** Implement PostgreSQL repository for cloud transactions and receipts
- [x] **T049** Implement PostgreSQL repository for conflict records
- [x] **T050** Implement Flutter `SyncApiClient` using `Idempotency-Key` header
- [x] **T051** Implement reconnect `SyncWorker` with retry scheduling and Isar transitions
- [x] **T052** Implement client-side conflict state handling
- [x] **T053** Update shared OpenAPI validation exports in sync API

### Phase 5: User Story 3 - Imprimir En Windows Y Android (Priority: P3)
- [x] **T054** Add ESC/POS formatter golden byte test
- [x] **T055** Add Windows USB printer adapter test
- [x] **T056** Add Android Bluetooth printer adapter test
- [x] **T057** Add Android network printer adapter test
- [x] **T058** Implement shared ESC/POS formatter from printer contract
- [x] **T059** Implement printer capability model and validation
- [x] **T060** Implement Windows USB printer adapter
- [x] **T061** Implement Android Bluetooth printer adapter
- [x] **T062** Implement Android network printer adapter
- [x] **T063** Implement printer adapter selection service
- [x] **T064** Implement printer configuration repository in Isar
- [x] **T065** Implement printer configuration settings screen UI
- [x] **T066** Implement print job retry and reprint service linked to transaction

### Phase 6: Polish & Cross-Cutting Concerns
- [x] **T067** Update quickstart validation steps
- [x] **T068** Update data model with `POSDevice` and cached auth/session entities
- [x] **T069** Update sync OpenAPI schema with registered device and auth audit fields
- [x] **T070** Add offline recovery and sync troubleshooting runbook
- [x] **T071** Add RDS Proxy deployment notes and required env variables
- [x] **T072** Run Flutter analyzer and tests for `apps/pos_flutter`
- [x] **T073** Run Lambda TypeScript tests and contract tests for `apps/sync_api`
- [x] **T074** Run PostgreSQL migration validation for `apps/sync_api/migrations/`
- [ ] **T075** Validate quickstart end-to-end and record results

---

## 📈 Next Milestones
1. **Milestone 1**: Complete static analysis and local testing for Flutter (`T072`).
2. **Milestone 2**: Validate PostgreSQL DB baseline migrations (`T074`).
3. **Milestone 3**: Run end-to-end validation of offline-to-online sync flow (`T075`).
