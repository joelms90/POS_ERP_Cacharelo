import 'package:flutter_test/flutter_test.dart';
import 'package:pos_erp_offline_pos/domain/sync_operation.dart';
import 'package:pos_erp_offline_pos/local_store/isar_collections.dart';
import 'package:pos_erp_offline_pos/local_store/sync_operation_repository.dart';
import 'package:pos_erp_offline_pos/sync/sync_api_client.dart';
import 'package:pos_erp_offline_pos/sync/sync_conflict_handler.dart';

void main() {
  test('accepted sync response marks operation accepted', () {
    final operation = SyncOperation(
      id: 'op-1',
      transactionId: 'tx-1',
      operationType: SyncOperationType.upsertTransaction,
      payload: const {'transactionId': 'tx-1'},
      payloadHash: 'hash',
      idempotencyKey: 'tx-1',
      attemptCount: 0,
      nextAttemptAt: DateTime.utc(2026, 5, 19),
      state: SyncOperationState.pending,
    );

    final updated = SyncConflictHandler().applyResponse(operation, 202, const {});

    expect(updated.state, SyncOperationState.accepted);
    expect(SyncOperationRepository(InMemoryLocalStore()), isNotNull);
    expect(SyncApiResponse(statusCode: 202, body: const {}).statusCode, 202);
  });
}

