enum TransactionType { sale, refund, inventoryAdjustment, shiftClose }

enum SyncState { pending, syncing, synced, failed, conflict }

enum PaymentMethod { cash, cardExternalReference, cardOnlineAuthorization }

class MoneyTotals {
  const MoneyTotals({
    required this.subtotal,
    required this.tax,
    required this.discount,
    required this.finalAmount,
    this.currency = 'MXN',
  });

  final int subtotal;
  final int tax;
  final int discount;
  final int finalAmount;
  final String currency;

  void validate() {
    if (finalAmount < 0) {
      throw ArgumentError('finalAmount must be non-negative');
    }
  }

  Map<String, Object?> toJson() => {
        'subtotal': subtotal,
        'tax': tax,
        'discount': discount,
        'finalAmount': finalAmount,
        'currency': currency,
      };
}

class PaymentSummary {
  const PaymentSummary({
    required this.method,
    required this.amount,
    this.externalReference,
  });

  final PaymentMethod method;
  final int amount;
  final String? externalReference;

  Map<String, Object?> toJson() => {
        'method': method.name,
        'amount': amount,
        if (externalReference != null) 'externalReference': externalReference,
      };
}

class SaleLineItem {
  const SaleLineItem({
    required this.sku,
    required this.name,
    required this.quantity,
    required this.unitPrice,
  });

  final String sku;
  final String name;
  final num quantity;
  final int unitPrice;

  Map<String, Object?> toJson() => {
        'sku': sku,
        'name': name,
        'quantity': quantity,
        'unitPrice': unitPrice,
      };
}

class LocalTransaction {
  const LocalTransaction({
    required this.id,
    required this.deviceId,
    required this.branchId,
    required this.transactionType,
    required this.items,
    required this.totals,
    required this.paymentSummary,
    required this.localVersion,
    required this.createdAtLocal,
    required this.updatedAtLocal,
    required this.syncState,
    this.cloudReceiptId,
  });

  final String id;
  final String deviceId;
  final String branchId;
  final TransactionType transactionType;
  final List<SaleLineItem> items;
  final MoneyTotals totals;
  final PaymentSummary paymentSummary;
  final int localVersion;
  final DateTime createdAtLocal;
  final DateTime updatedAtLocal;
  final SyncState syncState;
  final String? cloudReceiptId;

  void validate() {
    totals.validate();
    if (syncState == SyncState.synced && cloudReceiptId == null) {
      throw StateError('synced transactions require a cloudReceiptId');
    }
  }

  LocalTransaction copyWith({
    SyncState? syncState,
    String? cloudReceiptId,
    DateTime? updatedAtLocal,
  }) {
    return LocalTransaction(
      id: id,
      deviceId: deviceId,
      branchId: branchId,
      transactionType: transactionType,
      items: items,
      totals: totals,
      paymentSummary: paymentSummary,
      localVersion: localVersion,
      createdAtLocal: createdAtLocal,
      updatedAtLocal: updatedAtLocal ?? this.updatedAtLocal,
      syncState: syncState ?? this.syncState,
      cloudReceiptId: cloudReceiptId ?? this.cloudReceiptId,
    );
  }

  Map<String, Object?> toJson() => {
        'id': id,
        'deviceId': deviceId,
        'branchId': branchId,
        'transactionType': transactionType.name,
        'items': items.map((item) => item.toJson()).toList(growable: false),
        'totals': totals.toJson(),
        'paymentSummary': paymentSummary.toJson(),
        'localVersion': localVersion,
        'createdAtLocal': createdAtLocal.toUtc().toIso8601String(),
        'updatedAtLocal': updatedAtLocal.toUtc().toIso8601String(),
        'syncState': syncState.name,
        if (cloudReceiptId != null) 'cloudReceiptId': cloudReceiptId,
      };
}

