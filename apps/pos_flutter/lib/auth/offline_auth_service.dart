import 'dart:convert';

import 'package:crypto/crypto.dart';

import '../domain/device_and_auth.dart';
import '../local_store/isar_collections.dart';

class OfflineAuthService {
  OfflineAuthService(this.store);

  final InMemoryLocalStore store;

  Future<void> cacheSession({
    required String userId,
    required Set<String> roleIds,
    required String pin,
    Duration ttl = const Duration(hours: 12),
  }) async {
    final now = DateTime.now().toUtc();
    store.snapshot.sessions.removeWhere((session) => session.userId == userId);
    store.snapshot.sessions.add(
      CachedUserSession(
        userId: userId,
        roleIds: roleIds,
        pinHash: _hash(pin),
        cachedAt: now,
        expiresAt: now.add(ttl),
      ),
    );
  }

  Future<CachedUserSession> unlockWithPin({
    required String userId,
    required String pin,
    required String permission,
  }) async {
    final session = store.snapshot.sessions.firstWhere(
      (item) => item.userId == userId,
      orElse: () => throw StateError('No cached session for user'),
    );
    if (session.pinHash != _hash(pin)) {
      throw StateError('Invalid offline PIN');
    }
    if (!session.allows(permission)) {
      throw StateError('Cached role does not allow $permission');
    }
    return session;
  }

  String _hash(String pin) => sha256.convert(utf8.encode(pin)).toString();
}

