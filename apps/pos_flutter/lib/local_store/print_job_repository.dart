import '../domain/printing.dart';
import 'isar_collections.dart';

class PrintJobRepository {
  PrintJobRepository(this.store);

  final InMemoryLocalStore store;

  Future<void> put(PrintJob job) async {
    final index = store.snapshot.printJobs.indexWhere((item) => item.id == job.id);
    if (index == -1) {
      store.snapshot.printJobs.add(job);
    } else {
      store.snapshot.printJobs[index] = job;
    }
  }

  Future<List<PrintJob>> failedForTransaction(String transactionId) async {
    return store.snapshot.printJobs
        .where((item) => item.transactionId == transactionId && item.state == PrintJobState.failed)
        .toList(growable: false);
  }
}

