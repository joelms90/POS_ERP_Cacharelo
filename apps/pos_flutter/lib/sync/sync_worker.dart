import '../local_store/sync_operation_repository.dart';
import 'sync_api_client.dart';
import 'sync_conflict_handler.dart';

class SyncWorker {
  SyncWorker({
    required this.operations,
    required this.client,
    SyncConflictHandler? conflictHandler,
  }) : conflictHandler = conflictHandler ?? SyncConflictHandler();

  final SyncOperationRepository operations;
  final SyncApiClient client;
  final SyncConflictHandler conflictHandler;

  Future<int> runDue(DateTime now) async {
    final due = await operations.due(now);
    var processed = 0;
    for (final operation in due) {
      final inFlight = operation.markInFlight();
      await operations.enqueue(inFlight);
      final response = await client.submit(inFlight);
      await operations.enqueue(
        conflictHandler.applyResponse(inFlight, response.statusCode, response.body),
      );
      processed++;
    }
    return processed;
  }
}

