enum SyncOperationType { upsertTransaction, voidTransaction, inventoryAdjustment }

enum SyncOperationState { pending, inFlight, accepted, failed, conflict }

class SyncOperation {
  const SyncOperation({
    required this.id,
    required this.transactionId,
    required this.operationType,
    required this.payload,
    required this.payloadHash,
    required this.idempotencyKey,
    required this.attemptCount,
    required this.nextAttemptAt,
    required this.state,
    this.lastErrorCode,
  });

  final String id;
  final String transactionId;
  final SyncOperationType operationType;
  final Map<String, Object?> payload;
  final String payloadHash;
  final String idempotencyKey;
  final int attemptCount;
  final DateTime nextAttemptAt;
  final String? lastErrorCode;
  final SyncOperationState state;

  SyncOperation markInFlight() => copyWith(
        state: SyncOperationState.inFlight,
        attemptCount: attemptCount + 1,
      );

  SyncOperation markAccepted() => copyWith(state: SyncOperationState.accepted);

  SyncOperation markFailed(String code, DateTime nextAttempt) => copyWith(
        state: SyncOperationState.failed,
        lastErrorCode: code,
        nextAttemptAt: nextAttempt,
      );

  SyncOperation markConflict(String code) => copyWith(
        state: SyncOperationState.conflict,
        lastErrorCode: code,
      );

  SyncOperation copyWith({
    int? attemptCount,
    DateTime? nextAttemptAt,
    String? lastErrorCode,
    SyncOperationState? state,
  }) {
    return SyncOperation(
      id: id,
      transactionId: transactionId,
      operationType: operationType,
      payload: payload,
      payloadHash: payloadHash,
      idempotencyKey: idempotencyKey,
      attemptCount: attemptCount ?? this.attemptCount,
      nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
      lastErrorCode: lastErrorCode ?? this.lastErrorCode,
      state: state ?? this.state,
    );
  }
}

