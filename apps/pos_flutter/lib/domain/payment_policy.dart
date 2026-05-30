import 'local_transaction.dart';

class PaymentPolicy {
  const PaymentPolicy();

  void validateOffline(PaymentSummary payment) {
    switch (payment.method) {
      case PaymentMethod.cash:
        return;
      case PaymentMethod.cardExternalReference:
        if (payment.externalReference == null || payment.externalReference!.isEmpty) {
          throw ArgumentError('Offline card references require an external reference');
        }
        return;
      case PaymentMethod.cardOnlineAuthorization:
        throw StateError('Online authorization is required for this card payment');
    }
  }
}
