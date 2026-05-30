import 'package:flutter_test/flutter_test.dart';
import 'package:pos_erp_offline_pos/domain/local_transaction.dart';
import 'package:pos_erp_offline_pos/printing/escpos_formatter.dart';

void main() {
  test('formatter emits ESC/POS init and cut commands', () {
    final now = DateTime.utc(2026, 5, 19);
    final transaction = LocalTransaction(
      id: '00000000-0000-4000-8000-000000000000',
      deviceId: 'device-1',
      branchId: 'branch-1',
      transactionType: TransactionType.sale,
      items: const [SaleLineItem(sku: 'burger', name: 'Burger', quantity: 1, unitPrice: 9000)],
      totals: const MoneyTotals(subtotal: 9000, tax: 0, discount: 0, finalAmount: 9000),
      paymentSummary: const PaymentSummary(method: PaymentMethod.cash, amount: 9000),
      localVersion: 1,
      createdAtLocal: now,
      updatedAtLocal: now,
      syncState: SyncState.pending,
    );

    final bytes = const EscposFormatter().receipt(transaction);

    expect(bytes.take(2), [27, 64]);
    expect(bytes.takeLast(3), [29, 86, 0]);
  });
}

extension _Last<T> on List<T> {
  Iterable<T> takeLast(int count) => skip(length - count);
}

