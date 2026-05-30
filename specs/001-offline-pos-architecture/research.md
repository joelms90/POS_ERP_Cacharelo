# Research: Offline-First POS Architecture

## Decision: Shared Flutter Client For Windows 10 And Android

**Rationale**: Flutter allows the POS UI, domain logic, Isar repositories, sync queue and
ESC/POS ticket formatting to live in shared Dart code. Platform-specific code is limited to
USB printing on Windows and Bluetooth/network permissions or transports on Android.

**Alternatives considered**: Native Windows and Android apps were rejected because duplicated
business logic would increase sync and offline consistency risk. A web POS was rejected
because local hardware printing and resilient local storage are harder to control.

## Decision: Isar As Local Authoritative Store

**Rationale**: Isar is embedded, fast for local object persistence, supports Flutter targets
and fits the constitution requirement that critical POS actions complete locally. Transactions,
sync operations, printer jobs and device configuration are stored locally before user-facing
success.

**Alternatives considered**: SQLite was considered for portability and SQL familiarity, but
Isar better matches the requested stack and object-oriented Flutter local model. In-memory
queues were rejected because they cannot survive app restarts.

## Decision: UUID v4 For Local Transaction Identity And Idempotency

**Rationale**: UUID v4 can be generated offline with negligible collision risk and works as
the stable idempotency key across Isar, API payloads and PostgreSQL uniqueness constraints.

**Alternatives considered**: Server-generated IDs were rejected because they require network
availability. Sequential local IDs were rejected because they collide across devices unless
scoped carefully.

## Decision: Retryable SyncOperation Queue

**Rationale**: A durable local queue separates POS success from cloud availability. Each
operation records payload hash, attempt count, last error and next retry time. Lambda treats
the transaction UUID as idempotency key and returns a receipt that lets the client mark the
operation synced.

**Alternatives considered**: Direct API calls from UI were rejected because they create a
network dependency. Bulk-only sync was rejected because it delays visibility and complicates
targeted retries.

## Decision: ESC/POS Formatting Layer Plus Platform Transport Adapters

**Rationale**: Ticket layout and ESC/POS command generation should be shared. Transport
adapters send the same bytes over Windows USB, Android Bluetooth or Android network sockets.
This keeps business formatting independent from device permissions and platform APIs.

**Alternatives considered**: Platform-specific ticket formatting was rejected because output
would diverge. Rendering tickets as images was rejected for baseline architecture because it
adds device compatibility and performance risk.

## Decision: AWS Lambda TypeScript Handlers With RDS Proxy To PostgreSQL

**Rationale**: Lambda provides serverless sync endpoints and TypeScript keeps API contracts
close to JSON schemas. RDS Proxy protects PostgreSQL from connection storms caused by Lambda
concurrency. PostgreSQL stores accepted transactions, receipts, conflicts and audit records.

**Alternatives considered**: Direct Lambda-to-PostgreSQL connections were rejected because
connection churn can exhaust the database. A long-running container API was deferred because
the requested backend is Lambda-based.

## Decision: Conflict Handling Is Explicit For Critical Data

**Rationale**: Sales and payments are append-only accepted records; inventory adjustments can
create conflict records when cloud state differs from the local assumption. The system avoids
silent overwrites and keeps audit metadata for support.

**Alternatives considered**: Last-write-wins was rejected for money, inventory and shift
closing because it can hide operational loss.
