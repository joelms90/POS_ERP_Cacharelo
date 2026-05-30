import '../domain/sync_operation.dart';

class SyncConflictHandler {
  SyncOperation applyResponse(SyncOperation operation, int statusCode, Map<String, Object?> body) {
    if (statusCode == 202) {
      return operation.markAccepted();
    }
    if (statusCode == 409) {
      return operation.markConflict(body['reason']?.toString() ?? 'conflict');
    }
    return operation.markFailed(
      body['code']?.toString() ?? 'sync_failed',
      DateTime.now().toUtc().add(const Duration(minutes: 1)),
    );
  }
}

