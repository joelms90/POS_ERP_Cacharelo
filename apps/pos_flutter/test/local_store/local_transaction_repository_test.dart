import 'package:flutter_test/flutter_test.dart';
import 'package:pos_erp_offline_pos/domain/identity.dart';
import 'package:pos_erp_offline_pos/domain/local_transaction.dart';
import 'package:pos_erp_offline_pos/local_store/isar_collections.dart';
import 'package:pos_erp_offline_pos/local_store/local_transaction_repository.dart';

void main() {
  test('local transaction uses uuid v4 and persists before sync', () async {
    final repository = LocalTransactionRepository(InMemoryLocalStore());
    final now = DateTime.utc(2026, 5, 19);
    final transaction = LocalTransaction(
      id: newUuidV4(),
      deviceId: newUuidV4(),
      branchId: 'branch-1',
      transactionType: TransactionType.sale,
      items: const [SaleLineItem(sku: 'emp-1', name: 'Empanada', quantity: 1, unitPrice: 2500)],
      totals: const MoneyTotals(subtotal: 2500, tax: 0, discount: 0, finalAmount: 2500),
      paymentSummary: const PaymentSummary(method: PaymentMethod.cash, amount: 2500),
      localVersion: 1,
      createdAtLocal: now,
      updatedAtLocal: now,
      syncState: SyncState.pending,
    );

    await repository.put(transaction);

    expect(looksLikeUuidV4(transaction.id), isTrue);
    expect((await repository.pendingSync()).single.id, transaction.id);
  });
}

