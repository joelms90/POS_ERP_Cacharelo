import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:bcrypt/bcrypt.dart';

class SecureStorageService {
  final FlutterSecureStorage _secureStorage;
  SharedPreferences? _prefs;
  bool _useSharedPreferences = false;
  late final Future<void> _initFuture;

  static const String _dbKeyName = 'isar_db_encryption_key';
  static const String _saltKeyName = 'local_pin_salt';
  static const String _usersCacheKey = 'cached_offline_users';
  static const String _pendingSaleSyncJobsKey = 'pending_sale_sync_jobs';
  static const String _pendingOrderSyncJobsKey = 'pending_order_sync_jobs';
  static const String _readyPickupOrdersKey = 'ready_pickup_orders';
  static const String _ticketFiscalConfigKey = 'ticket_fiscal_config';
  static const String _pendingRequisitionsKey = 'pending_requisitions_list';
  static const String _cachedIngredientsKey = 'cached_ingredients_list';
  static const String _cachedWarehousesKey = 'cached_warehouses_list';
  static const String _cachedMenuKey = 'cached_menu_list';
  static const String _localStationIdKey = 'local_station_id';
  static const String _lastPrintStationIdKey = 'last_print_station_id';
  static const String _receiveRemotePrintJobsKey = 'receive_remote_print_jobs';

  SecureStorageService({FlutterSecureStorage? secureStorage})
      : _secureStorage = secureStorage ?? const FlutterSecureStorage() {
    _initFuture = _initializeStorage();
  }

  Future<void> _initializeStorage() async {
    // On macOS desktop, try to use secure storage first, but fall back to SharedPreferences if keychain fails
    if (!kIsWeb &&
        (Platform.isMacOS || Platform.isWindows || Platform.isLinux)) {
      try {
        // Test if secure storage is accessible
        await _secureStorage.read(key: 'test_key');
        _useSharedPreferences = false;
      } catch (e) {
        // Keychain access failed, use SharedPreferences
        debugPrint(
            'Keychain access failed on desktop, using SharedPreferences: $e');
        _useSharedPreferences = true;
        _prefs = await SharedPreferences.getInstance();
      }
    }
  }

  Future<String?> _read(String key) async {
    await _initFuture;
    if (_useSharedPreferences) {
      if (_prefs == null) {
        _prefs = await SharedPreferences.getInstance();
      }
      return _prefs!.getString(key);
    }
    try {
      return await _secureStorage.read(key: key);
    } catch (e) {
      debugPrint(
          'Secure storage read failed for $key, falling back to SharedPreferences: $e');
      _useSharedPreferences = true;
      _prefs ??= await SharedPreferences.getInstance();
      return _prefs!.getString(key);
    }
  }

  Future<void> _write(String key, String value) async {
    await _initFuture;
    if (_useSharedPreferences) {
      if (_prefs == null) {
        _prefs = await SharedPreferences.getInstance();
      }
      await _prefs!.setString(key, value);
      return;
    }
    try {
      await _secureStorage.write(key: key, value: value);
    } catch (e) {
      debugPrint(
          'Secure storage write failed for $key, falling back to SharedPreferences: $e');
      _useSharedPreferences = true;
      _prefs ??= await SharedPreferences.getInstance();
      await _prefs!.setString(key, value);
    }
  }

  Future<void> _delete(String key) async {
    await _initFuture;
    if (_useSharedPreferences) {
      if (_prefs == null) {
        _prefs = await SharedPreferences.getInstance();
      }
      await _prefs!.remove(key);
      return;
    }
    try {
      await _secureStorage.delete(key: key);
    } catch (e) {
      debugPrint(
          'Secure storage delete failed for $key, falling back to SharedPreferences: $e');
      _useSharedPreferences = true;
      _prefs ??= await SharedPreferences.getInstance();
      await _prefs!.remove(key);
    }
  }

  // Retrieve or generate a 32-byte key for database encryption
  Future<Uint8List> getOrCreateDatabaseKey() async {
    final keyHex = await _read(_dbKeyName);
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
    await _write(_dbKeyName, hexString);
    return keyBytes;
  }

  // Helper: Get or create a unique salt for PIN hashing
  Future<String> _getOrCreateSalt() async {
    var salt = await _read(_saltKeyName);
    if (salt == null) {
      final random = Random.secure();
      final saltBytes = List<int>.generate(16, (_) => random.nextInt(256));
      salt = base64Encode(saltBytes);
      await _write(_saltKeyName, salt);
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
    String? id,
    required String name,
    required String pin,
    required String role,
    List<String>? roles,
    String? businessId,
    String? branchId,
  }) async {
    final hashedPin = await hashPin(pin);
    final normalizedRoles = _normalizeRoles(roles, role);
    final usersJson = await _read(_usersCacheKey);
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

    users.add({
      'id': id,
      'name': name,
      'pinHash': hashedPin,
      'role': normalizedRoles.first,
      'roles': normalizedRoles,
      'businessId': businessId,
      'branchId': branchId,
    });

    await _write(_usersCacheKey, jsonEncode(users));
  }

  // Overwrite operators cache from dynamic sync
  Future<void> cacheOperatorsOffline(
    List<dynamic> operators, {
    String? businessId,
    String? branchId,
  }) async {
    List<dynamic> users = [];

    for (var op in operators) {
      final String name = op['name'] ?? '';
      final String role = op['role'] ?? '';
      final List<String> roles = _normalizeRoles(op['roles'], role);
      final String pinHash = op['pinHash'] ?? ''; // BCrypt hash from backend
      final String? id = op['id'];

      if (name.isNotEmpty && pinHash.isNotEmpty && roles.isNotEmpty) {
        users.removeWhere((u) => u['name'] == name);
        users.add({
          'id': id,
          'name': name,
          'pinHash': pinHash,
          'role': roles.first,
          'roles': roles,
          'isBcrypt': true,
          'businessId': businessId,
          'branchId': branchId,
        });
      }
    }

    await _write(_usersCacheKey, jsonEncode(users));
  }

  // Verify a PIN offline by hashing it and checking it against the secure storage cache
  Future<Map<String, dynamic>?> verifyOfflineCredentials(
    String pin, {
    String? businessId,
    String? branchId,
  }) async {
    final hashedPin = await hashPin(pin);
    final usersJson = await _read(_usersCacheKey);
    if (usersJson == null) return null;

    try {
      final List<dynamic> users = jsonDecode(usersJson);
      for (final user in users) {
        final bool isBcrypt = user['isBcrypt'] == true;
        final String cachedHash = user['pinHash'] as String;

        bool pinMatches = false;
        if (isBcrypt) {
          try {
            pinMatches = BCrypt.checkpw(pin, cachedHash);
          } catch (e) {
            debugPrint('Bcrypt local check error: $e');
          }
        } else {
          pinMatches = (cachedHash == hashedPin);
        }

        if (pinMatches) {
          final id = user['id'] as String? ?? '';
          if (!_isUuid(id)) {
            continue;
          }
          if (!_matchesScope(user,
              businessId: businessId, branchId: branchId)) {
            continue;
          }
          final roles = _normalizeRoles(user['roles'], user['role'] as String?);
          return {
            'id': id,
            'name': user['name'] as String,
            'role': roles.first,
            'roles': roles,
            'businessId': user['businessId'] as String?,
            'branchId': user['branchId'] as String?,
          };
        }
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  bool _matchesScope(
    dynamic user, {
    String? businessId,
    String? branchId,
  }) {
    if (user is! Map) return false;
    final cachedBusinessId = user['businessId']?.toString();
    final cachedBranchId = user['branchId']?.toString();
    if (_isUuid(businessId) && cachedBusinessId != businessId) return false;
    if (_isUuid(branchId) && cachedBranchId != branchId) return false;
    return true;
  }

  bool _isUuid(String? value) {
    if (value == null) return false;
    return RegExp(
      r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    ).hasMatch(value);
  }

  List<String> _normalizeRoles(dynamic roles, String? fallbackRole) {
    final values = <String>[];
    if (roles is List) {
      values.addAll(
        roles
            .map((role) => role?.toString().trim() ?? '')
            .where((role) => role.isNotEmpty),
      );
    }
    if (values.isEmpty &&
        fallbackRole != null &&
        fallbackRole.trim().isNotEmpty) {
      values.add(fallbackRole.trim());
    }
    return values.toSet().toList();
  }

  // Clear all cached credentials
  Future<void> clearCachedCredentials() async {
    await _delete(_usersCacheKey);
  }

  Future<List<Map<String, dynamic>>> getPendingSaleSyncJobs() async {
    final jobsJson = await _read(_pendingSaleSyncJobsKey);
    if (jobsJson == null || jobsJson.isEmpty) return [];

    try {
      final List<dynamic> decoded = jsonDecode(jobsJson);
      return decoded
          .whereType<Map>()
          .map((job) => Map<String, dynamic>.from(job))
          .toList();
    } catch (e) {
      debugPrint('Error reading pending sale sync jobs: $e');
      return [];
    }
  }

  Future<void> savePendingSaleSyncJobs(List<Map<String, dynamic>> jobs) async {
    await _write(_pendingSaleSyncJobsKey, jsonEncode(jobs));
  }

  Future<List<Map<String, dynamic>>> getPendingOrderSyncJobs() async {
    final jobsJson = await _read(_pendingOrderSyncJobsKey);
    if (jobsJson == null || jobsJson.isEmpty) return [];

    try {
      final List<dynamic> decoded = jsonDecode(jobsJson);
      return decoded
          .whereType<Map>()
          .map((job) => Map<String, dynamic>.from(job))
          .toList();
    } catch (e) {
      debugPrint('Error reading pending order sync jobs: $e');
      return [];
    }
  }

  Future<void> savePendingOrderSyncJobs(List<Map<String, dynamic>> jobs) async {
    await _write(_pendingOrderSyncJobsKey, jsonEncode(jobs));
  }

  Future<List<Map<String, dynamic>>> getReadyPickupOrders() async {
    final raw = await _read(_readyPickupOrdersKey);
    if (raw == null || raw.isEmpty) return [];

    try {
      final List<dynamic> decoded = jsonDecode(raw);
      return decoded
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    } catch (e) {
      debugPrint('Error reading ready pickup orders: $e');
      return [];
    }
  }

  Future<void> saveReadyPickupOrders(List<Map<String, dynamic>> orders) async {
    await _write(_readyPickupOrdersKey, jsonEncode(orders));
  }

  Future<List<Map<String, dynamic>>> getPendingRequisitions() async {
    final raw = await _read(_pendingRequisitionsKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final List<dynamic> decoded = jsonDecode(raw);
      return decoded
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    } catch (e) {
      debugPrint('Error reading pending requisitions: $e');
      return [];
    }
  }

  Future<void> savePendingRequisitions(
      List<Map<String, dynamic>> requisitions) async {
    await _write(_pendingRequisitionsKey, jsonEncode(requisitions));
  }

  // Save connected printer info
  Future<void> savePrinter(String mac, String name) async {
    await _write('connected_printer_mac', mac);
    await _write('connected_printer_name', name);
  }

  // Save connected printer paper width ('58mm' or '80mm')
  Future<void> savePrinterPaperWidth(String paperWidth) async {
    await _write('connected_printer_paper_width', paperWidth);
  }

  // Load connected printer paper width ('58mm' or '80mm')
  Future<String?> getSavedPrinterPaperWidth() async {
    return await _read('connected_printer_paper_width');
  }

  // Load connected printer info
  Future<Map<String, String>?> getSavedPrinter() async {
    final mac = await _read('connected_printer_mac');
    final name = await _read('connected_printer_name');
    if (mac != null && name != null) {
      return {'mac': mac, 'name': name};
    }
    return null;
  }

  // Clear connected printer info
  Future<void> clearSavedPrinter() async {
    await _delete('connected_printer_mac');
    await _delete('connected_printer_name');
    await _delete('connected_printer_paper_width');
  }

  Future<String> getOrCreateLocalStationId() async {
    final existing = await _read(_localStationIdKey);
    if (existing != null && existing.isNotEmpty) {
      return existing;
    }

    final random = Random.secure();
    final suffix = List<int>.generate(8, (_) => random.nextInt(256))
        .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
        .join();
    final stationId =
        'station_${DateTime.now().millisecondsSinceEpoch}_$suffix';
    await _write(_localStationIdKey, stationId);
    return stationId;
  }

  static const _deviceIdKey = 'pos_device_id';

  Future<String> getOrCreateDeviceId() async {
    final existing = await _read(_deviceIdKey);
    if (existing != null && existing.isNotEmpty) {
      return existing;
    }
    final random = Random.secure();
    final suffix = List<int>.generate(6, (_) => random.nextInt(256))
        .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
        .join();
    final deviceId = 'device_${DateTime.now().millisecondsSinceEpoch}_$suffix';
    await _write(_deviceIdKey, deviceId);
    return deviceId;
  }

  Future<void> saveLastPrintStationId(String stationId) async {
    await _write(_lastPrintStationIdKey, stationId);
  }

  Future<String?> getLastPrintStationId() async {
    return _read(_lastPrintStationIdKey);
  }

  Future<void> saveReceiveRemotePrintJobs(bool enabled) async {
    await _write(_receiveRemotePrintJobsKey, enabled ? 'true' : 'false');
  }

  Future<bool> getReceiveRemotePrintJobs() async {
    return (await _read(_receiveRemotePrintJobsKey)) == 'true';
  }

  // Save terminal config
  Future<void> saveTerminalConfig({
    required String businessId,
    required String branchId,
    required String businessName,
    required String branchName,
    required String apiUrl,
  }) async {
    await _write('terminal_business_id', businessId);
    await _write('terminal_branch_id', branchId);
    await _write('terminal_business_name', businessName);
    await _write('terminal_branch_name', branchName);
    await _write('terminal_api_url', apiUrl);
  }

  // Load terminal config
  Future<Map<String, String>?> getTerminalConfig() async {
    final businessId = await _read('terminal_business_id');
    final branchId = await _read('terminal_branch_id');
    final businessName = await _read('terminal_business_name');
    final branchName = await _read('terminal_branch_name');
    final apiUrl = await _read('terminal_api_url');

    if (businessId != null && branchId != null && apiUrl != null) {
      return {
        'businessId': businessId,
        'branchId': branchId,
        'businessName': businessName ?? '',
        'branchName': branchName ?? '',
        'apiUrl': apiUrl,
      };
    }
    return null;
  }

  // Clear terminal config
  Future<void> clearTerminalConfig() async {
    await _delete('terminal_business_id');
    await _delete('terminal_branch_id');
    await _delete('terminal_business_name');
    await _delete('terminal_branch_name');
    await _delete('terminal_api_url');
  }

  Future<void> clearLocalBranchData() async {
    await clearTerminalConfig();
    await clearCachedCredentials();
    await clearJwtToken();
    await clearSavedPrinter();
    await _delete(_pendingSaleSyncJobsKey);
    await _delete(_pendingOrderSyncJobsKey);
    await _delete(_readyPickupOrdersKey);
    await _delete(_ticketFiscalConfigKey);
    await _delete(_pendingRequisitionsKey);
    await _delete(_cachedIngredientsKey);
    await _delete(_cachedWarehousesKey);
    await _delete(_cachedMenuKey);
    await _delete(_localStationIdKey);
    await _delete(_lastPrintStationIdKey);
    await _delete(_receiveRemotePrintJobsKey);
    await _delete('recent_closed_sales_list');
    await _delete('last_table_sync_checkpoint');
  }

  Future<void> saveTicketFiscalConfig(Map<String, dynamic> config) async {
    await _write(_ticketFiscalConfigKey, jsonEncode(config));
  }

  Future<Map<String, dynamic>?> getTicketFiscalConfig() async {
    final configJson = await _read(_ticketFiscalConfigKey);
    if (configJson == null || configJson.isEmpty) return null;

    try {
      final decoded = jsonDecode(configJson);
      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
    } catch (e) {
      debugPrint('Error reading ticket fiscal config: $e');
    }
    return null;
  }

  // Recent closed sales methods
  Future<void> saveRecentClosedSales(List<Map<String, dynamic>> sales) async {
    await _write('recent_closed_sales_list', jsonEncode(sales));
  }

  Future<List<Map<String, dynamic>>> getRecentClosedSales() async {
    final raw = await _read('recent_closed_sales_list');
    if (raw == null) return [];
    try {
      final List<dynamic> decoded = jsonDecode(raw);
      return decoded.map((item) => Map<String, dynamic>.from(item)).toList();
    } catch (e) {
      debugPrint('Error decoding recent closed sales: $e');
      return [];
    }
  }

  // Sync checkpoint methods
  Future<void> saveSyncCheckpoint(String checkpoint) async {
    await _write('last_table_sync_checkpoint', checkpoint);
  }

  Future<String?> getSyncCheckpoint() async {
    return await _read('last_table_sync_checkpoint');
  }

  // JWT Token caching
  Future<void> saveJwtToken(String token) async {
    await _write('jwt_access_token', token);
  }

  Future<String?> getJwtToken() async {
    return await _read('jwt_access_token');
  }

  Future<void> clearJwtToken() async {
    await _delete('jwt_access_token');
  }

  Future<List<Map<String, dynamic>>> getCachedIngredients() async {
    final raw = await _read(_cachedIngredientsKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final List<dynamic> decoded = jsonDecode(raw);
      return decoded.map((item) => Map<String, dynamic>.from(item)).toList();
    } catch (e) {
      debugPrint('Error reading cached ingredients: $e');
      return [];
    }
  }

  Future<void> saveCachedIngredients(List<Map<String, dynamic>> list) async {
    await _write(_cachedIngredientsKey, jsonEncode(list));
  }

  Future<List<Map<String, dynamic>>> getCachedMenu() async {
    final raw = await _read(_cachedMenuKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final List<dynamic> decoded = jsonDecode(raw);
      return decoded.map((item) => Map<String, dynamic>.from(item)).toList();
    } catch (e) {
      debugPrint('Error reading cached menu: $e');
      return [];
    }
  }

  Future<void> saveCachedMenu(List<Map<String, dynamic>> list) async {
    await _write(_cachedMenuKey, jsonEncode(list));
  }

  Future<List<Map<String, dynamic>>> getCachedWarehouses() async {
    final raw = await _read(_cachedWarehousesKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final List<dynamic> decoded = jsonDecode(raw);
      return decoded.map((item) => Map<String, dynamic>.from(item)).toList();
    } catch (e) {
      debugPrint('Error reading cached warehouses: $e');
      return [];
    }
  }

  Future<void> saveCachedWarehouses(List<Map<String, dynamic>> list) async {
    await _write(_cachedWarehousesKey, jsonEncode(list));
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
