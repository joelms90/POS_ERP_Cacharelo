# Offline Sync Runbook

## Symptoms

- Sales remain in `pending` or `failed` sync state after internet returns.
- A device shows conflict state for inventory or duplicate UUID.
- Tickets fail to print after a sale is confirmed.

## Immediate Checks

1. Confirm the POS device still has its persisted `deviceId`.
2. Confirm cashier session is cached and unlock succeeds with PIN or biometric verification.
3. Confirm pending `SyncOperation` records retain the original transaction UUID as
   idempotency key.
4. Confirm AWS Lambda can reach PostgreSQL through the RDS Proxy endpoint.
5. Confirm `ConflictRecord` entries exist for inventory or payload hash conflicts.

## Recovery

- Retry sync operations with the same idempotency key; do not generate a new transaction UUID.
- For `inventory_conflict`, preserve the sale and create or resolve the inventory adjustment.
- For failed print jobs, retry or reprint the original `PrintJob`; do not create a duplicate
  transaction.
- For expired cached roles, reconnect and re-authenticate before allowing more offline sales.

## Escalation Data

Collect transaction UUID, deviceId, branchId, sync state, payload hash, latest error code and
cloud receipt or conflict ID.

