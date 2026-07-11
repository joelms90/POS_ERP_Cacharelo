import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:pos_flutter/services/secure_storage_service.dart';

class FakeSecureStorage implements FlutterSecureStorage {
  final Map<String, String> _storage = {};

  @override
  Future<String?> read({
    required String key,
    aOptions,
    iOptions,
    lOptions,
    webOptions,
    mOptions,
    wOptions,
  }) async {
    return _storage[key];
  }

  @override
  Future<void> write({
    required String key,
    required String? value,
    aOptions,
    iOptions,
    lOptions,
    webOptions,
    mOptions,
    wOptions,
  }) async {
    if (value == null) {
      _storage.remove(key);
    } else {
      _storage[key] = value;
    }
  }

  @override
  Future<void> delete({
    required String key,
    aOptions,
    iOptions,
    lOptions,
    webOptions,
    mOptions,
    wOptions,
  }) async {
    _storage.remove(key);
  }

  @override
  noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  group('SecureStorageService Tests', () {
    late FakeSecureStorage fakeStorage;
    late SecureStorageService secureStorageService;

    setUp(() {
      fakeStorage = FakeSecureStorage();
      secureStorageService = SecureStorageService(secureStorage: fakeStorage);
    });

    test(
      'getOrCreateDatabaseKey creates a 32-byte key and persists it',
      () async {
        final key1 = await secureStorageService.getOrCreateDatabaseKey();
        expect(key1.length, equals(32));

        // Key should persist and return the same bytes
        final key2 = await secureStorageService.getOrCreateDatabaseKey();
        expect(key2, equals(key1));
      },
    );

    test('hashPin returns consistent salted SHA-256 hash', () async {
      final hash1 = await secureStorageService.hashPin('1111');
      final hash2 = await secureStorageService.hashPin('1111');
      expect(hash1, equals(hash2));

      // Different PIN should result in different hash
      final hash3 = await secureStorageService.hashPin('2222');
      expect(hash1, isNot(equals(hash3)));
    });

    test('cacheUserOffline and verifyOfflineCredentials flow works', () async {
      // Should return null for non-cached PIN
      final credsBefore = await secureStorageService.verifyOfflineCredentials(
        '1234',
      );
      expect(credsBefore, isNull);

      // Cache a user
      await secureStorageService.cacheUserOffline(
        name: 'Carlos (Chef)',
        pin: '1234',
        role: 'kitchen',
      );

      // Verify the credentials offline
      final credsAfter = await secureStorageService.verifyOfflineCredentials(
        '1234',
      );
      expect(credsAfter, isNotNull);
      expect(credsAfter!['name'], equals('Carlos (Chef)'));
      expect(credsAfter['role'], equals('kitchen'));
      expect(credsAfter['roles'], equals(['kitchen']));
    });

    test('clearCachedCredentials clears the cache', () async {
      await secureStorageService.cacheUserOffline(
        name: 'Sofia (Cajero)',
        pin: '2222',
        role: 'cashier',
      );

      final credsBefore = await secureStorageService.verifyOfflineCredentials(
        '2222',
      );
      expect(credsBefore, isNotNull);

      await secureStorageService.clearCachedCredentials();

      final credsAfter = await secureStorageService.verifyOfflineCredentials(
        '2222',
      );
      expect(credsAfter, isNull);
    });
  });
}
