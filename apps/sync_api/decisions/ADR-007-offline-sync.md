# ADR-007: Bidirectional Offline Synchronization Strategy

## Status
Accepted

## Context
POS clients must function seamlessly during internet outages. Waiters, kitchen staff, and cashiers must log tickets, change table states, and process checkouts locally. When connection is restored, the client must sync changes with the cloud database.

## Decision
We implement a **Bidirectional Synchronization Protocol** based on:
1. **Change Tracking**: Tables include a `version` (integer) and `updated_at` (timestamp) column.
2. **Push-Pull-Acknowledge Flow**:
   - **Pull**: Clients fetch updates since their last sync checkpoint (checkpoint is stored on the server as client device record).
   - **Push**: Clients upload local changes containing client-generated UUIDs, client timestamps, and local operations.
   - **Conflict Handling**: Resolves using **Last-Write-Wins (LWW)** with server-side validation. Certain critical states (like shift opening/cash drawers) require transactional locks.
3. **Idempotency**: Clients include an idempotency key (often the transaction UUID) on all push events to prevent duplicate uploads during network retries.

## Rationale
* Simple to implement for 1-2 developers compared to complex CRDTs (Conflict-free Replicated Data Types).
* Minimizes data payload by only transmitting changes since the device's last checkpoint.
* Ensures database consistency through server-side validations (e.g. preventing checkout of a table that is already closed in the cloud).

## Consequences
* Every synchable table must maintain a modification audit trail (`updated_at` / `version`).
* Clients must store the synchronization checkpoint sequence ID locally.
