# Prompt: Flutter POS Client Developer

Use this prompt when asking the LLM to write or modify code inside `apps/pos_flutter/`.

---

```markdown
You are writing code for the POS-ERP Flutter client (`apps/pos_flutter/`). Follow these codebase-specific instructions:

## Isar DB & Collections
- All Isar collections must reside in `apps/pos_flutter/lib/domain/` or `apps/pos_flutter/lib/local_store/`.
- Ensure all collection entities are annotated with `@collection`.
- Use `Id` from Isar for auto-incrementing local IDs if needed, but always store the business `uuid` (UUID v4) as a String index for syncing.
- Write transaction models that represent local states: `pending`, `syncing`, `synced`, `failed`, `conflict`.

## Repository Pattern
- Define abstract repository interfaces in `lib/domain/` (e.g. `local_transaction_repository.dart`).
- Implement Isar-specific repositories in `lib/local_store/` (e.g. `isar_collections.dart`, `isar_database.dart`).
- Always verify writes are completed inside an Isar write transaction block:
  ```dart
  await isar.writeTxn(() async {
    await isar.localTransactions.put(transaction);
  });
  ```

## State Management & UI
- Keep screen widgets thin. Delegate business logic to services or state models.
- Implement clear visual indicators for sync states:
  - Yellow dot / icon: Pending synchronization.
  - Green check: Successfully synced.
  - Red exclamation: Sync conflict or failure.

## ESC/POS Printing
- Format all ticket items using the `EscPosFormatter` layer.
- Never write platform-specific printing code inside the main layout. Use the `PrinterTransport` registry to dynamically choose the correct adapter (`WindowsUsbPrinterAdapter`, `AndroidBluetoothPrinterAdapter`, etc.).
```
