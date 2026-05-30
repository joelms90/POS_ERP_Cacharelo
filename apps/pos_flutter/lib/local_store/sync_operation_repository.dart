import '../domain/sync_operation.dart';
import 'isar_collections.dart';

class SyncOperationRepository {
  SyncOperationRepository(this.store);

  final InMemoryLocalStore store;

  Future<void> enqueue(SyncOperation operation) async {
    final index = store.snapshot.syncOperations.indexWhere((item) => item.id == operation.id);
    if (index == -1) {
      store.snapshot.syncOperations.add(operation);
    } else {
      store.snapshot.syncOperations[index] = operation;
    }
  }

  Future<List<SyncOperation>> due(DateTime now) async {
    return store.snapshot.syncOperations
        .where((item) =>
            (item.state == SyncOperationState.pending || item.state == SyncOperationState.failed) &&
            !item.nextAttemptAt.isAfter(now))
        .toList(growable: false);
  }
}

