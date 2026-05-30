# Tasks: Offline-First POS Architecture

**Input**: Design documents from `/specs/001-offline-pos-architecture/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because the specification defines independent tests and measurable
offline/reconnect/printer success criteria.

**Organization**: Tasks are grouped by user story to keep each story independently
implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on
  incomplete tasks.
- **[Story]**: User story label, used only inside story phases.
- Every task includes concrete file paths.

## Path Conventions

- Flutter POS client: `apps/pos_flutter/`
- AWS Lambda sync API: `apps/sync_api/`
- Shared schemas/contracts: `packages/shared_contracts/`
- Feature documentation: `specs/001-offline-pos-architecture/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the workspace skeleton and baseline tooling for Flutter, Lambda and
shared contracts.

- [X] T001 Create Flutter POS project skeleton in apps/pos_flutter/pubspec.yaml
- [X] T002 Create Flutter source directories in apps/pos_flutter/lib/domain/.gitkeep, apps/pos_flutter/lib/local_store/.gitkeep, apps/pos_flutter/lib/sync/.gitkeep, apps/pos_flutter/lib/printing/.gitkeep, apps/pos_flutter/lib/platform/windows/.gitkeep, apps/pos_flutter/lib/platform/android/.gitkeep
- [X] T003 Create Flutter test directories in apps/pos_flutter/test/.gitkeep and apps/pos_flutter/integration_test/.gitkeep
- [X] T004 Create Lambda TypeScript package skeleton in apps/sync_api/package.json
- [X] T005 Create Lambda source directories in apps/sync_api/src/handlers/.gitkeep, apps/sync_api/src/services/.gitkeep, apps/sync_api/src/persistence/.gitkeep, apps/sync_api/src/contracts/.gitkeep
- [X] T006 Create migration and backend test directories in apps/sync_api/migrations/.gitkeep and apps/sync_api/test/.gitkeep
- [X] T007 Create shared contracts package skeleton in packages/shared_contracts/package.json
- [X] T008 [P] Copy OpenAPI sync contract into packages/shared_contracts/schemas/sync-api.openapi.yaml from specs/001-offline-pos-architecture/contracts/sync-api.openapi.yaml
- [X] T009 [P] Copy printer contract into packages/shared_contracts/schemas/printer-contract.md from specs/001-offline-pos-architecture/contracts/printer-contract.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared domain, persistence, identity, auth and backend foundations that
all user stories need.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T010 Configure Flutter dependencies for Isar, UUID, secure local storage, biometrics/PIN support and test tooling in apps/pos_flutter/pubspec.yaml
- [X] T011 Configure TypeScript, test tooling, OpenAPI validation and PostgreSQL client dependencies in apps/sync_api/package.json
- [X] T012 [P] Define shared transaction JSON schema in packages/shared_contracts/schemas/transaction-sync-request.schema.json
- [X] T013 [P] Define shared sync receipt JSON schema in packages/shared_contracts/schemas/sync-receipt.schema.json
- [X] T014 [P] Define shared conflict response JSON schema in packages/shared_contracts/schemas/conflict-response.schema.json
- [X] T015 Create LocalTransaction domain entity with UUID v4, totals, payment summary, deviceId and sync state in apps/pos_flutter/lib/domain/local_transaction.dart
- [X] T016 Create SyncOperation domain entity with idempotency key, payload hash, retry metadata and state in apps/pos_flutter/lib/domain/sync_operation.dart
- [X] T017 Create PrintJob and PrinterDevice domain entities with ESC/POS payload and transport metadata in apps/pos_flutter/lib/domain/printing.dart
- [X] T018 Create POSDevice and cached user session domain entities in apps/pos_flutter/lib/domain/device_and_auth.dart
- [X] T019 Implement Isar collection mappings and indexes for transactions, sync operations, print jobs, printers, device and auth sessions in apps/pos_flutter/lib/local_store/isar_collections.dart
- [X] T020 Implement Isar database bootstrap and migration entrypoint in apps/pos_flutter/lib/local_store/isar_database.dart
- [X] T021 Implement stable UUID v4 and canonical payload hash utilities in apps/pos_flutter/lib/domain/identity.dart
- [X] T022 Implement one-time online device registration client interface and local deviceId persistence in apps/pos_flutter/lib/device/device_registration_service.dart
- [X] T023 Implement cached roles plus PIN/biometric offline unlock service in apps/pos_flutter/lib/auth/offline_auth_service.dart
- [X] T024 Create PostgreSQL migration for cloud_transactions, sync_receipts, conflict_records and registered_devices tables in apps/sync_api/migrations/001_offline_sync_baseline.sql
- [X] T025 Implement RDS Proxy PostgreSQL connection factory in apps/sync_api/src/persistence/db.ts
- [X] T026 Implement structured audit logger for sync, conflicts and printer-related cloud events in apps/sync_api/src/services/auditLogger.ts

**Checkpoint**: Shared data, identity, auth, local persistence and cloud persistence are ready.

---

## Phase 3: User Story 1 - Operar POS Sin Internet (Priority: P1) MVP

**Goal**: Cashier can unlock locally, complete a cash sale offline, persist it in Isar with
UUID v4 and continue even if printing fails.

**Independent Test**: Disable internet, unlock with cached credentials, complete a cash sale,
verify Isar contains LocalTransaction and SyncOperation, and verify a printer failure leaves a
failed PrintJob without rolling back the sale.

### Tests for User Story 1

- [X] T027 [P] [US1] Add offline cash sale integration test in apps/pos_flutter/integration_test/offline_cash_sale_test.dart
- [X] T028 [P] [US1] Add offline PIN/biometric role unlock test in apps/pos_flutter/test/auth/offline_auth_service_test.dart
- [X] T029 [P] [US1] Add local transaction UUID v4 and Isar commit unit test in apps/pos_flutter/test/local_store/local_transaction_repository_test.dart
- [X] T030 [P] [US1] Add print failure does not roll back sale test in apps/pos_flutter/test/printing/print_job_failure_test.dart

### Implementation for User Story 1

- [X] T031 [US1] Implement LocalTransactionRepository that writes LocalTransaction before success in apps/pos_flutter/lib/local_store/local_transaction_repository.dart
- [X] T032 [US1] Implement SyncOperationRepository that enqueues pending operations with transaction UUID idempotency key in apps/pos_flutter/lib/local_store/sync_operation_repository.dart
- [X] T033 [US1] Implement PrintJobRepository that persists queued and failed print jobs in apps/pos_flutter/lib/local_store/print_job_repository.dart
- [X] T034 [US1] Implement cash-only offline payment policy and external card reference guard in apps/pos_flutter/lib/domain/payment_policy.dart
- [X] T035 [US1] Implement offline sale application service that validates cached role, writes transaction, queues sync and queues print in apps/pos_flutter/lib/domain/offline_sale_service.dart
- [X] T036 [US1] Implement minimal POS sale screen flow for offline cash sale confirmation in apps/pos_flutter/lib/ui/offline_sale_screen.dart
- [X] T037 [US1] Implement local sale status indicators for pending sync and failed print state in apps/pos_flutter/lib/ui/local_operation_status.dart
- [X] T038 [US1] Wire offline sale flow into Flutter app entrypoint in apps/pos_flutter/lib/main.dart

**Checkpoint**: User Story 1 works offline as a complete MVP.

---

## Phase 4: User Story 2 - Sincronizar Al Reconectar (Priority: P2)

**Goal**: Pending local operations sync to AWS Lambda/PostgreSQL idempotently after reconnect,
including duplicate replay and inventory conflict handling.

**Independent Test**: Create offline sales, restore internet, run sync, verify one
CloudTransaction per UUID, duplicate replay returns the original receipt, and stale stock
creates an auditable adjustment or conflict.

### Tests for User Story 2

- [X] T039 [P] [US2] Add OpenAPI contract test for POST /v1/sync/transactions in apps/sync_api/test/contract/submitTransaction.contract.test.ts
- [X] T040 [P] [US2] Add OpenAPI contract test for GET /v1/sync/receipts/{transactionId} in apps/sync_api/test/contract/getSyncReceipt.contract.test.ts
- [X] T041 [P] [US2] Add Lambda idempotent duplicate replay test in apps/sync_api/test/services/transactionSyncService.test.ts
- [X] T042 [P] [US2] Add Flutter reconnect sync worker integration test in apps/pos_flutter/integration_test/reconnect_sync_test.dart
- [X] T043 [P] [US2] Add inventory conflict sync test in apps/sync_api/test/services/inventoryConflict.test.ts

### Implementation for User Story 2

- [X] T044 [US2] Implement TransactionSyncService with UUID idempotency and payload hash checks in apps/sync_api/src/services/transactionSyncService.ts
- [X] T045 [US2] Implement ConflictService for payload hash mismatch and inventory_conflict records in apps/sync_api/src/services/conflictService.ts
- [X] T046 [US2] Implement submitTransaction Lambda handler in apps/sync_api/src/handlers/submitTransaction.ts
- [X] T047 [US2] Implement getSyncReceipt Lambda handler in apps/sync_api/src/handlers/getSyncReceipt.ts
- [X] T048 [US2] Implement PostgreSQL repository for cloud transactions and receipts in apps/sync_api/src/persistence/transactionRepository.ts
- [X] T049 [US2] Implement PostgreSQL repository for conflict records in apps/sync_api/src/persistence/conflictRepository.ts
- [X] T050 [US2] Implement Flutter SyncApiClient using Idempotency-Key header in apps/pos_flutter/lib/sync/sync_api_client.dart
- [X] T051 [US2] Implement reconnect SyncWorker with retry scheduling and Isar state transitions in apps/pos_flutter/lib/sync/sync_worker.dart
- [X] T052 [US2] Implement client-side conflict state handling for failed/conflict sync responses in apps/pos_flutter/lib/sync/sync_conflict_handler.dart
- [X] T053 [US2] Update shared OpenAPI validation exports in apps/sync_api/src/contracts/syncApi.ts

**Checkpoint**: User Stories 1 and 2 work independently and together.

---

## Phase 5: User Story 3 - Imprimir En Windows Y Android (Priority: P3)

**Goal**: Admin can configure ESC/POS thermal printers and send the same formatted ticket over
Windows USB, Android Bluetooth and Android network transports.

**Independent Test**: Generate one ticket from a local transaction, verify ESC/POS bytes are
transport-neutral, send them through Windows USB, Android Bluetooth and Android network
adapters, and verify failures are retryable PrintJobs.

### Tests for User Story 3

- [X] T054 [P] [US3] Add ESC/POS formatter golden byte test in apps/pos_flutter/test/printing/escpos_formatter_test.dart
- [X] T055 [P] [US3] Add Windows USB printer adapter test in apps/pos_flutter/test/printing/windows_usb_printer_adapter_test.dart
- [X] T056 [P] [US3] Add Android Bluetooth printer adapter test in apps/pos_flutter/test/printing/android_bluetooth_printer_adapter_test.dart
- [X] T057 [P] [US3] Add Android network printer adapter test in apps/pos_flutter/test/printing/android_network_printer_adapter_test.dart

### Implementation for User Story 3

- [X] T058 [US3] Implement shared ESC/POS formatter from printer contract in apps/pos_flutter/lib/printing/escpos_formatter.dart
- [X] T059 [US3] Implement printer capability model and validation in apps/pos_flutter/lib/printing/printer_capabilities.dart
- [X] T060 [US3] Implement Windows USB printer adapter in apps/pos_flutter/lib/platform/windows/windows_usb_printer_adapter.dart
- [X] T061 [US3] Implement Android Bluetooth printer adapter in apps/pos_flutter/lib/platform/android/android_bluetooth_printer_adapter.dart
- [X] T062 [US3] Implement Android network printer adapter in apps/pos_flutter/lib/platform/android/android_network_printer_adapter.dart
- [X] T063 [US3] Implement printer adapter selection service by platform and transport in apps/pos_flutter/lib/printing/printer_transport_registry.dart
- [X] T064 [US3] Implement printer configuration repository using Isar PrinterDevice records in apps/pos_flutter/lib/local_store/printer_device_repository.dart
- [X] T065 [US3] Implement printer configuration screen for USB, Bluetooth and network printers in apps/pos_flutter/lib/ui/printer_settings_screen.dart
- [X] T066 [US3] Implement print job retry and reprint service linked to original transaction in apps/pos_flutter/lib/printing/print_retry_service.dart

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate operational readiness across all stories and update documentation.

- [X] T067 [P] Update quickstart validation steps for auth, payment, inventory and deviceId clarifications in specs/001-offline-pos-architecture/quickstart.md
- [X] T068 [P] Update data model with POSDevice and cached auth/session entities in specs/001-offline-pos-architecture/data-model.md
- [X] T069 [P] Update sync OpenAPI schema with registered device and auth audit fields in specs/001-offline-pos-architecture/contracts/sync-api.openapi.yaml
- [X] T070 Add offline recovery and sync troubleshooting runbook in docs/offline-sync-runbook.md
- [X] T071 Add RDS Proxy deployment notes and required environment variables in apps/sync_api/README.md
- [ ] T072 Run Flutter analyzer and tests for apps/pos_flutter in apps/pos_flutter/pubspec.yaml
- [X] T073 Run Lambda TypeScript tests and contract tests for apps/sync_api in apps/sync_api/package.json
- [ ] T074 Run PostgreSQL migration validation for apps/sync_api/migrations/001_offline_sync_baseline.sql
- [ ] T075 Validate quickstart end-to-end and record results in specs/001-offline-pos-architecture/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational; delivers MVP offline local sale.
- **US2 (Phase 4)**: Depends on Foundational and can use US1-created pending operations for
  end-to-end validation.
- **US3 (Phase 5)**: Depends on Foundational; can be developed after US1 because sale-created
  PrintJobs make validation realistic.
- **Polish (Phase 6)**: Depends on desired user stories being complete.

### User Story Dependencies

- **US1**: Required MVP and foundation for realistic offline operation.
- **US2**: Integrates with US1 data but sync worker and Lambda can be developed in parallel
  after Phase 2.
- **US3**: Uses PrintJob and PrinterDevice foundation; can proceed in parallel with US2 after
  Phase 2 if hardware adapters are isolated.

### Within Each User Story

- Tests before implementation.
- Local persistence before user-facing success.
- Sync producer/queue before cloud consumer integration.
- Shared formatter before platform printer adapters.
- Story checkpoint before moving to the next priority.

---

## Parallel Opportunities

- T008-T009 can run in parallel after package skeletons exist.
- T012-T014 can run in parallel because schemas are separate files.
- T015-T018 can run in parallel as independent domain entities.
- T024-T026 can run in parallel with Flutter local-store implementation after schemas exist.
- US1 tests T027-T030 can run in parallel.
- US2 tests T039-T043 can run in parallel.
- US3 tests T054-T057 can run in parallel.
- US2 backend tasks T044-T049 can run in parallel with client tasks T050-T052 after contracts
  are stable.
- US3 adapter tasks T060-T062 can run in parallel after formatter T058 is complete.

## Parallel Example: User Story 1

```bash
Task: "Add offline cash sale integration test in apps/pos_flutter/integration_test/offline_cash_sale_test.dart"
Task: "Add offline PIN/biometric role unlock test in apps/pos_flutter/test/auth/offline_auth_service_test.dart"
Task: "Add local transaction UUID v4 and Isar commit unit test in apps/pos_flutter/test/local_store/local_transaction_repository_test.dart"
Task: "Add print failure does not roll back sale test in apps/pos_flutter/test/printing/print_job_failure_test.dart"
```

## Parallel Example: User Story 2

```bash
Task: "Add OpenAPI contract test for POST /v1/sync/transactions in apps/sync_api/test/contract/submitTransaction.contract.test.ts"
Task: "Add Lambda idempotent duplicate replay test in apps/sync_api/test/services/transactionSyncService.test.ts"
Task: "Add Flutter reconnect sync worker integration test in apps/pos_flutter/integration_test/reconnect_sync_test.dart"
Task: "Add inventory conflict sync test in apps/sync_api/test/services/inventoryConflict.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Add ESC/POS formatter golden byte test in apps/pos_flutter/test/printing/escpos_formatter_test.dart"
Task: "Add Windows USB printer adapter test in apps/pos_flutter/test/printing/windows_usb_printer_adapter_test.dart"
Task: "Add Android Bluetooth printer adapter test in apps/pos_flutter/test/printing/android_bluetooth_printer_adapter_test.dart"
Task: "Add Android network printer adapter test in apps/pos_flutter/test/printing/android_network_printer_adapter_test.dart"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate offline sale, local auth, cash-only offline payment, Isar persistence and
   failed print behavior.

### Incremental Delivery

1. Deliver US1 to prove the restaurant can keep selling offline.
2. Add US2 to sync pending local operations and resolve duplicates/conflicts.
3. Add US3 to complete thermal printer support across Windows and Android transports.
4. Finish Phase 6 to harden docs, runbooks and full validation.

### Suggested MVP Scope

US1 is the MVP: local auth, offline cash sale, UUID v4 transaction, Isar persistence,
sync-queue creation and durable print job failure handling.

## Notes

- Every critical POS path must keep working without internet.
- Card payments are not captured offline inside the POS; they require an external terminal
  reference or online authorization.
- Failed printing must never duplicate or roll back a local transaction.
- Inventory conflicts preserve sales and create auditable adjustments or conflict records.
- The plan predates clarification updates; Phase 6 includes documentation refresh tasks for
  POSDevice and auth/payment clarifications.
