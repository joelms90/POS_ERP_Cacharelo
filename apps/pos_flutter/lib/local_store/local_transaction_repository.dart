import '../domain/local_transaction.dart';
import 'isar_collections.dart';

class LocalTransactionRepository {
  LocalTransactionRepository(this.store);

  final InMemoryLocalStore store;

  Future<void> put(LocalTransaction transaction) async {
    transaction.validate();
    final index = store.snapshot.transactions.indexWhere((item) => item.id == transaction.id);
    if (index == -1) {
      store.snapshot.transactions.add(transaction);
    } else {
      store.snapshot.transactions[index] = transaction;
    }
  }

  Future<LocalTransaction?> findById(String id) async {
    return store.snapshot.transactions.where((item) => item.id == id).firstOrNull;
  }

  Future<List<LocalTransaction>> pendingSync() async {
    return store.snapshot.transactions
        .where((item) => item.syncState == SyncState.pending || item.syncState == SyncState.failed)
        .toList(growable: false);
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

