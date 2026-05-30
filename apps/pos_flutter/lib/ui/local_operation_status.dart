import '../domain/local_transaction.dart';
import '../domain/printing.dart';

class LocalOperationStatus {
  const LocalOperationStatus({
    required this.syncState,
    required this.printJobState,
  });

  final SyncState syncState;
  final PrintJobState printJobState;

  String get label {
    final sync = switch (syncState) {
      SyncState.pending => 'Pending sync',
      SyncState.syncing => 'Syncing',
      SyncState.synced => 'Synced',
      SyncState.failed => 'Sync failed',
      SyncState.conflict => 'Sync conflict',
    };
    final print = switch (printJobState) {
      PrintJobState.queued => 'Print queued',
      PrintJobState.printing => 'Printing',
      PrintJobState.printed => 'Printed',
      PrintJobState.failed => 'Print failed',
    };
    return '$sync / $print';
  }
}

