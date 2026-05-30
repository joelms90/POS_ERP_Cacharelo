import 'package:flutter_test/flutter_test.dart';
import 'package:pos_erp_offline_pos/auth/offline_auth_service.dart';
import 'package:pos_erp_offline_pos/local_store/isar_collections.dart';

void main() {
  test('cached cashier can unlock offline with PIN', () async {
    final store = InMemoryLocalStore();
    final auth = OfflineAuthService(store);

    await auth.cacheSession(userId: 'cashier-1', roleIds: {'cashier'}, pin: '1234');

    final session = await auth.unlockWithPin(
      userId: 'cashier-1',
      pin: '1234',
      permission: 'cashier',
    );

    expect(session.userId, 'cashier-1');
  });
}

