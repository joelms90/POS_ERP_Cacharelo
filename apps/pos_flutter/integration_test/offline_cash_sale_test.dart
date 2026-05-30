import 'package:flutter_test/flutter_test.dart';
import 'package:pos_erp_offline_pos/auth/offline_auth_service.dart';
import 'package:pos_erp_offline_pos/domain/local_transaction.dart';
import 'package:pos_erp_offline_pos/domain/offline_sale_service.dart';
import 'package:pos_erp_offline_pos/local_store/isar_collections.dart';
import 'package:pos_erp_offline_pos/local_store/local_transaction_repository.dart';
import 'package:pos_erp_offline_pos/local_store/print_job_repository.dart';
import 'package:pos_erp_offline_pos/local_store/sync_operation_repository.dart';

void main() {
  test('cash sale commits locally while offline', () async {
    final store = InMemoryLocalStore();
    final auth = OfflineAuthService(store);
    await auth.cacheSession(userId: 'cashier', roleIds: {'cashier'}, pin: '1234');
    final service = OfflineSaleService(
      auth: auth,
      transactions: LocalTransactionRepository(store),
      syncOperations: SyncOperationRepository(store),
      printJobs: PrintJobRepository(store),
    );

    final result = await service.completeCashSale(
      const OfflineSaleRequest(
        userId: 'cashier',
        pin: '1234',
        deviceId: 'device-1',
        branchId: 'branch-1',
        items: [SaleLineItem(sku: 'coffee', name: 'Coffee', quantity: 1, unitPrice: 3000)],
        totals: MoneyTotals(subtotal: 3000, tax: 0, discount: 0, finalAmount: 3000),
        paymentSummary: PaymentSummary(method: PaymentMethod.cash, amount: 3000),
        printerDeviceId: 'printer-1',
        escposPayload: [27, 64],
      ),
    );

    expect(result.transaction.syncState, SyncState.pending);
    expect(store.snapshot.syncOperations, hasLength(1));
    expect(store.snapshot.printJobs, hasLength(1));
  });
}

