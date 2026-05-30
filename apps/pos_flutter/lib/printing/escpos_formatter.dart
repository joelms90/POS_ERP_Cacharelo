import 'dart:convert';

import '../domain/local_transaction.dart';

class EscposFormatter {
  const EscposFormatter();

  List<int> receipt(LocalTransaction transaction) {
    final buffer = <int>[];
    buffer.addAll([0x1B, 0x40]); // Initialize
    buffer.addAll(utf8.encode('POS-ERP\n'));
    buffer.addAll(utf8.encode('TX ${transaction.id}\n'));
    for (final item in transaction.items) {
      buffer.addAll(utf8.encode('${item.quantity} ${item.name} ${item.unitPrice}\n'));
    }
    buffer.addAll(utf8.encode('TOTAL ${transaction.totals.finalAmount}\n'));
    buffer.addAll([0x1D, 0x56, 0x00]); // Full cut
    return buffer;
  }
}

