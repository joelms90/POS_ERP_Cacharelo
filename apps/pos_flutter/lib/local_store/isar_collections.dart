import '../domain/device_and_auth.dart';
import '../domain/local_transaction.dart';
import '../domain/printing.dart';
import '../domain/sync_operation.dart';

class LocalStoreSnapshot {
  LocalStoreSnapshot({
    List<LocalTransaction>? transactions,
    List<SyncOperation>? syncOperations,
    List<PrintJob>? printJobs,
    List<PrinterDevice>? printers,
    POSDevice? device,
    List<CachedUserSession>? sessions,
  })  : transactions = transactions ?? <LocalTransaction>[],
        syncOperations = syncOperations ?? <SyncOperation>[],
        printJobs = printJobs ?? <PrintJob>[],
        printers = printers ?? <PrinterDevice>[],
        sessions = sessions ?? <CachedUserSession>[],
        device = device;

  final List<LocalTransaction> transactions;
  final List<SyncOperation> syncOperations;
  final List<PrintJob> printJobs;
  final List<PrinterDevice> printers;
  final List<CachedUserSession> sessions;
  POSDevice? device;
}

class InMemoryLocalStore {
  final LocalStoreSnapshot snapshot = LocalStoreSnapshot();

  void clear() {
    snapshot.transactions.clear();
    snapshot.syncOperations.clear();
    snapshot.printJobs.clear();
    snapshot.printers.clear();
    snapshot.sessions.clear();
    snapshot.device = null;
  }
}

