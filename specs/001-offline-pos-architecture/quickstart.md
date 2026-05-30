# Quickstart: Offline-First POS Architecture Validation

## Prerequisites

- Flutter SDK with Windows desktop and Android targets enabled.
- A Windows 10 test device or VM with a USB thermal printer path available.
- An Android device or emulator for app tests; physical device required for Bluetooth printer
  validation.
- AWS test environment with Lambda, RDS PostgreSQL and RDS Proxy configured.
- Local test PostgreSQL or disposable RDS database for migration validation.

## 1. Validate Local Offline Sale

1. Start the Flutter POS app on Windows or Android.
2. Register the device online once and verify a stable `deviceId` is persisted locally.
3. Authenticate a cashier online once and cache role permissions.
4. Disable internet on the device.
5. Unlock the POS using local PIN or biometric verification.
6. Create a cash sale with at least one item and one payment summary.
7. Confirm the sale.
8. Verify Isar contains a `LocalTransaction` with UUID v4, persistent `deviceId` and
   `syncState=pending`.
9. Verify no cloud response is required for user-facing success.

## 2. Validate Restart Recovery

1. Create at least one sale while offline.
2. Force close the app.
3. Reopen the app while still offline.
4. Verify the transaction, `SyncOperation`, cached session and `deviceId` remain in Isar.
5. Verify the POS can continue creating new cash sales.

## 3. Validate Reconnection Sync

1. Restore internet.
2. Run the sync worker.
3. Verify Lambda receives the transaction with `Idempotency-Key` equal to the transaction UUID.
4. Verify PostgreSQL stores one `CloudTransaction`.
5. Verify Isar marks the local transaction as `synced` only after a receipt is received.
6. Verify inventory shortages create an auditable adjustment or conflict instead of deleting
   the sale.

## 4. Validate Duplicate Replay

1. Submit the same transaction UUID and payload twice.
2. Verify PostgreSQL still has one transaction row.
3. Verify the API returns an accepted or duplicate receipt without creating a second sale.
4. Submit the same UUID with a different payload hash.
5. Verify the API returns a conflict response and records a `ConflictRecord`.

## 5. Validate Printing

1. Generate one receipt print request from a local transaction.
2. Verify the shared formatter produces ESC/POS bytes.
3. On Windows 10, send the bytes through the USB adapter.
4. On Android, send the bytes through Bluetooth.
5. On Android, send the bytes through network printing.
6. Verify print failures do not roll back the local transaction.

## 6. Validate Offline Payment Guard

1. Disable internet.
2. Complete a cash sale and verify it succeeds locally.
3. Attempt card payment without external terminal reference.
4. Verify the POS blocks local offline card capture.
5. Enter an external terminal reference and verify the sale can be recorded as referenced.

## 7. Validate RDS Proxy Usage

1. Deploy the Lambda sync API in the test environment.
2. Confirm database connections use the RDS Proxy endpoint.
3. Run concurrent sync submissions.
4. Verify Lambda does not open direct per-invocation connections to PostgreSQL.
