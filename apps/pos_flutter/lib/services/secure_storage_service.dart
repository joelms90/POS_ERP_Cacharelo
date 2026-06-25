import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageService {
  final FlutterSecureStorage _secureStorage;
  static const String _dbKeyName = 'isar_db_encryption_key';
  static const String _saltKeyName = 'local_pin_salt';
  static const String _usersCacheKey = 'cached_offline_users';

  SecureStorageService({FlutterSecureStorage? secureStorage})
    : _secureStorage = secureStorage ?? const FlutterSecureStorage();

  // Retrieve or generate a 32-byte key for database encryption
  Future<Uint8List> getOrCreateDatabaseKey() async {
    final keyHex = await _secureStorage.read(key: _dbKeyName);
    if (keyHex != null) {
      return Uint8List.fromList(hexToBytes(keyHex));
    }

    // Generate a secure random 32-byte key
    final random = Random.secure();
    final keyBytes = Uint8List.fromList(
      List<int>.generate(32, (_) => random.nextInt(256)),
    );

    // Save to secure storage in hex format
    final hexString = bytesToHex(keyBytes);
    await _secureStorage.write(key: _dbKeyName, value: hexString);
    return keyBytes;
  }

  // Helper: Get or create a unique salt for PIN hashing
  Future<String> _getOrCreateSalt() async {
    var salt = await _secureStorage.read(key: _saltKeyName);
    if (salt == null) {
      final random = Random.secure();
      final saltBytes = List<int>.generate(16, (_) => random.nextInt(256));
      salt = base64Encode(saltBytes);
      await _secureStorage.write(key: _saltKeyName, value: salt);
    }
    return salt;
  }

  // Hash a PIN using SHA-256 with the unique salt
  Future<String> hashPin(String pin) async {
    final salt = await _getOrCreateSalt();
    final bytesToHash = utf8.encode(pin + salt);
    final digest = sha256.convert(bytesToHash);
    return digest.toString();
  }

  // Cache user details offline securely (encrypting user data or saving in secure storage)
  Future<void> cacheUserOffline({
    required String name,
    required String pin,
    required String role,
  }) async {
    final hashedPin = await hashPin(pin);
    final usersJson = await _secureStorage.read(key: _usersCacheKey);
    List<dynamic> users = [];
    if (usersJson != null) {
      try {
        users = jsonDecode(usersJson);
      } catch (e) {
        users = [];
      }
    }

    // Remove existing user with the same name to avoid duplication
    users.removeWhere((u) => u['name'] == name);

    users.add({'name': name, 'pinHash': hashedPin, 'role': role});

    await _secureStorage.write(key: _usersCacheKey, value: jsonEncode(users));
  }

  // Verify a PIN offline by hashing it and checking it against the secure storage cache
  Future<Map<String, String>?> verifyOfflineCredentials(String pin) async {
    final hashedPin = await hashPin(pin);
    final usersJson = await _secureStorage.read(key: _usersCacheKey);
    if (usersJson == null) return null;

    try {
      final List<dynamic> users = jsonDecode(usersJson);
      for (final user in users) {
        if (user['pinHash'] == hashedPin) {
          return {
            'name': user['name'] as String,
            'role': user['role'] as String,
          };
        }
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  // Clear all cached credentials
  Future<void> clearCachedCredentials() async {
    await _secureStorage.delete(key: _usersCacheKey);
  }

  // Save connected printer info
  Future<void> savePrinter(String mac, String name) async {
    await _secureStorage.write(key: 'connected_printer_mac', value: mac);
    await _secureStorage.write(key: 'connected_printer_name', value: name);
  }

  // Load connected printer info
  Future<Map<String, String>?> getSavedPrinter() async {
    final mac = await _secureStorage.read(key: 'connected_printer_mac');
    final name = await _secureStorage.read(key: 'connected_printer_name');
    if (mac != null && name != null) {
      return {'mac': mac, 'name': name};
    }
    return null;
  }

  // Clear connected printer info
  Future<void> clearSavedPrinter() async {
    await _secureStorage.delete(key: 'connected_printer_mac');
    await _secureStorage.delete(key: 'connected_printer_name');
  }


  // Utility functions for Hex conversions
  static String bytesToHex(Uint8List bytes) {
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  static List<int> hexToBytes(String hex) {
    final bytes = <int>[];
    for (var i = 0; i < hex.length; i += 2) {
      bytes.add(int.parse(hex.substring(i, i + 2), radix: 16));
    }
    return bytes;
  }
}
