import '../auth/offline_auth_service.dart';
import '../local_store/local_transaction_repository.dart';
import '../local_store/print_job_repository.dart';
import '../local_store/sync_operation_repository.dart';
import 'identity.dart';
import 'local_transaction.dart';
import 'payment_policy.dart';
import 'printing.dart';
import 'sync_operation.dart';

class OfflineSaleRequest {
  const OfflineSaleRequest({
    required this.userId,
    required this.pin,
    required this.deviceId,
    required this.branchId,
    required this.items,
    required this.totals,
    required this.paymentSummary,
    required this.printerDeviceId,
    required this.escposPayload,
  });

  final String userId;
  final String pin;
  final String deviceId;
  final String branchId;
  final List<SaleLineItem> items;
  final MoneyTotals totals;
  final PaymentSummary paymentSummary;
  final String printerDeviceId;
  final List<int> escposPayload;
}

class OfflineSaleResult {
  const OfflineSaleResult({
    required this.transaction,
    required this.syncOperation,
    required this.printJob,
  });

  final LocalTransaction transaction;
  final SyncOperation syncOperation;
  final PrintJob printJob;
}

class OfflineSaleService {
  OfflineSaleService({
    required this.auth,
    required this.transactions,
    required this.syncOperations,
    required this.printJobs,
    this.paymentPolicy = const PaymentPolicy(),
  });

  final OfflineAuthService auth;
  final LocalTransactionRepository transactions;
  final SyncOperationRepository syncOperations;
  final PrintJobRepository printJobs;
  final PaymentPolicy paymentPolicy;

  Future<OfflineSaleResult> completeCashSale(OfflineSaleRequest request) async {
    await auth.unlockWithPin(
      userId: request.userId,
      pin: request.pin,
      permission: 'cashier',
    );
    paymentPolicy.validateOffline(request.paymentSummary);

    final now = DateTime.now().toUtc();
    final transaction = LocalTransaction(
      id: newUuidV4(),
      deviceId: request.deviceId,
      branchId: request.branchId,
      transactionType: TransactionType.sale,
      items: request.items,
      totals: request.totals,
      paymentSummary: request.paymentSummary,
      localVersion: 1,
      createdAtLocal: now,
      updatedAtLocal: now,
      syncState: SyncState.pending,
    );
    await transactions.put(transaction);

    final payload = transaction.toJson();
    final payloadHash = canonicalPayloadHash(payload);
    final operation = SyncOperation(
      id: newUuidV4(),
      transactionId: transaction.id,
      operationType: SyncOperationType.upsertTransaction,
      payload: payload,
      payloadHash: payloadHash,
      idempotencyKey: transaction.id,
      attemptCount: 0,
      nextAttemptAt: now,
      state: SyncOperationState.pending,
    );
    await syncOperations.enqueue(operation);

    final printJob = PrintJob(
      id: newUuidV4(),
      transactionId: transaction.id,
      printerDeviceId: request.printerDeviceId,
      jobType: PrintJobType.receipt,
      escposPayload: request.escposPayload,
      state: PrintJobState.queued,
      attemptCount: 0,
    );
    await printJobs.put(printJob);

    return OfflineSaleResult(
      transaction: transaction,
      syncOperation: operation,
      printJob: printJob,
    );
  }
}

