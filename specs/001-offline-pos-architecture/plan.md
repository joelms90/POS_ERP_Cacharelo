# Implementation Plan: Offline-First POS Architecture

**Branch**: `001-offline-pos-architecture` | **Date**: 2026-05-19 | **Spec**: `specs/001-offline-pos-architecture/spec.md`

**Input**: Feature specification from `/specs/001-offline-pos-architecture/spec.md`

## Summary

Establish the offline-first POS architecture for a food business using a shared Flutter
codebase for Windows 10 and Android, Isar Database for local authoritative transactions with
UUID v4 identifiers, ESC/POS thermal printing across platform transports, and AWS Lambda APIs
connected to AWS RDS PostgreSQL through RDS Proxy for cloud synchronization and reporting.

## Technical Context

**Language/Version**: Flutter/Dart 3.x for client; TypeScript on Node.js 22.x for AWS Lambda;
SQL migrations for PostgreSQL

**Primary Dependencies**: Flutter, Isar Database, uuid v4 generation, platform printer
plugins/adapters, ESC/POS encoder, AWS Lambda, AWS RDS Proxy, PostgreSQL

**Storage**: Isar collections for local transactions, sync queue, print jobs and printer
configuration; PostgreSQL tables for accepted transactions, sync receipts, conflicts and
audit metadata

**Testing**: Flutter unit/widget/integration tests, Dart tests for domain/sync logic, Lambda
unit and contract tests, PostgreSQL migration tests, offline/reconnect integration tests

**Target Platform**: Windows 10 Flutter desktop POS, Android Flutter POS, AWS Lambda backend,
AWS RDS PostgreSQL via AWS RDS Proxy

**Project Type**: Mobile/desktop POS client plus serverless cloud sync API

**Performance Goals**: Complete local sale commit in under 2 seconds without internet; keep
sync and print work off the UI thread; process pending sync queue without blocking POS use

**Constraints**: Offline-first, Isar write before user-facing success, UUID v4 idempotency,
ESC/POS printing, USB on Windows, Bluetooth/network on Android, Lambda database access only
through RDS Proxy, no network dependency for critical POS flows

**Scale/Scope**: Initial architecture for one or more registers/devices per business branch,
food-service transaction volume, and reconnect batches of pending offline operations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Offline continuity**: PASS. Sales and printing commit locally through Isar and ESC/POS
  adapters without requiring internet.
- **Local authority**: PASS. User-facing success is backed by Isar writes using UUID v4,
  versions, timestamps and sync state.
- **Sync contract**: PASS. Contracts define idempotency keys, retry behavior, conflict states,
  cloud receipts and duplicate handling.
- **Cloud role**: PASS. AWS Lambda/Postgres consolidate synchronized operations through RDS
  Proxy and are not required for local sale completion.
- **Verification**: PASS. Quickstart and design artifacts require offline, reconnection,
  idempotency, printer transport and migration compatibility checks.

## Project Structure

### Documentation (this feature)

```text
specs/001-offline-pos-architecture/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── sync-api.openapi.yaml
│   └── printer-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── pos_flutter/
│   ├── lib/
│   │   ├── domain/
│   │   ├── local_store/
│   │   ├── sync/
│   │   ├── printing/
│   │   └── platform/
│   │       ├── android/
│   │       └── windows/
│   ├── test/
│   └── integration_test/
└── sync_api/
    ├── src/
    │   ├── handlers/
    │   ├── services/
    │   ├── persistence/
    │   └── contracts/
    ├── migrations/
    └── test/

packages/
└── shared_contracts/
    ├── schemas/
    └── test/
```

**Structure Decision**: Use a Flutter app for shared Windows/Android POS behavior, a
serverless sync API package for AWS Lambda, and a shared contracts package for schemas used by
client, API and tests. Platform-specific printer code stays behind adapters under the Flutter
app.

## Complexity Tracking

No constitution violations. The split between Flutter client, Lambda API and shared contracts
is required by the target platforms and cloud architecture.

## Phase 0: Research Summary

See `specs/001-offline-pos-architecture/research.md`.

## Phase 1: Design Summary

See `specs/001-offline-pos-architecture/data-model.md`,
`specs/001-offline-pos-architecture/contracts/` and
`specs/001-offline-pos-architecture/quickstart.md`.

## Post-Design Constitution Check

- **Offline continuity**: PASS. Data model requires local transaction commit and print job
  persistence before sync.
- **Local authority**: PASS. Isar entities include UUID v4, local version, timestamps and
  sync state.
- **Sync contract**: PASS. OpenAPI contract specifies idempotent submission, receipts,
  conflict responses and retry-safe semantics.
- **Cloud role**: PASS. RDS Proxy is part of the backend contract; local operation remains
  independent of Lambda/Postgres availability.
- **Verification**: PASS. Quickstart includes offline sale, restart recovery, reconnect sync,
  duplicate replay and printer adapter checks.
