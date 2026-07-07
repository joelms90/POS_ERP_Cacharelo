import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';
import 'package:printing/printing.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import '../../services/secure_storage_service.dart';

enum TableState { free, occupied, billing, cleaning }

enum TableShape { circle, square }

enum UserRole { waiter, cashier, kitchen, none }

const double ivaRate = 0.16;
const double ivaFactor = 1 + ivaRate;

class TableModel {
  final int id;
  final String? remoteId;
  final String label;
  TableState state;
  final TableShape shape;
  final String zone;
  final double x; // Percent-based X coordinate
  final double y; // Percent-based Y coordinate
  List<OrderItem> items;
  int guests;
  double discountPercentage;
  List<String>
  guestGenders; // Tracks genders of guests: 'M' (Male), 'F' (Female), 'K' (Kid)

  TableModel({
    required this.id,
    this.remoteId,
    required this.label,
    this.state = TableState.free,
    required this.shape,
    required this.zone,
    required this.x,
    required this.y,
    this.items = const [],
    this.guests = 0,
    this.discountPercentage = 0.0,
    this.guestGenders = const ['M'],
  });

  double get subtotal => double.parse(items.fold<double>(0.0, (sum, item) => sum + double.parse(item.totalPrice.toStringAsFixed(2))).toStringAsFixed(2));
  double get discountAmount => double.parse((subtotal * (discountPercentage / 100.0)).toStringAsFixed(2));
  double get total => double.parse((subtotal - discountAmount).toStringAsFixed(2));
  double get netSubtotal => double.parse((subtotal / ivaFactor).toStringAsFixed(2));
  double get netTotal => double.parse((total / ivaFactor).toStringAsFixed(2));
  double get netDiscountAmount => double.parse((netSubtotal - netTotal).toStringAsFixed(2));
  double get includedTax => double.parse((total - netTotal).toStringAsFixed(2));

  TableModel copyWith({
    String? label,
    TableState? state,
    List<OrderItem>? items,
    int? guests,
    double? discountPercentage,
    List<String>? guestGenders,
  }) {
    return TableModel(
      id: id,
      remoteId: remoteId,
      label: label ?? this.label,
      state: state ?? this.state,
      shape: shape,
      zone: zone,
      x: x,
      y: y,
      items: items ?? List.from(this.items),
      guests: guests ?? this.guests,
      discountPercentage: discountPercentage ?? this.discountPercentage,
      guestGenders: guestGenders ?? List.from(this.guestGenders),
    );
  }
}

class MenuItem {
  final String id;
  final String name;
  final double price;
  final String category;
  final String imagePath;
  final List<String> modifierGroups;

  const MenuItem({
    required this.id,
    required this.name,
    required this.price,
    required this.category,
    this.imagePath = '',
    this.modifierGroups = const [],
  });
}

class OrderItem {
  final MenuItem item;
  int quantity;
  List<String> modifiers;
  String notes;
  String? assignedGuest; // e.g. 'P1'
  bool isSent;

  OrderItem({
    required this.item,
    this.quantity = 1,
    this.modifiers = const [],
    this.notes = '',
    this.assignedGuest,
    this.isSent = false,
  });

  double get totalPrice => double.parse(((item.price + (modifiers.length * 1.5)) * quantity).toStringAsFixed(2));
  double get netTotalPrice => double.parse((totalPrice / ivaFactor).toStringAsFixed(2));

  OrderItem copyWith({
    int? quantity,
    List<String>? modifiers,
    String? notes,
    String? assignedGuest,
    bool? isSent,
  }) {
    return OrderItem(
      item: item,
      quantity: quantity ?? this.quantity,
      modifiers: modifiers ?? List.from(this.modifiers),
      notes: notes ?? this.notes,
      assignedGuest: assignedGuest ?? this.assignedGuest,
      isSent: isSent ?? this.isSent,
    );
  }
}

class KitchenOrder {
  final String id;
  final String tableLabel;
  final List<OrderItem> items;
  final DateTime timestamp;
  String status; // 'pending', 'preparing', 'ready', 'served'

  KitchenOrder({
    required this.id,
    required this.tableLabel,
    required this.items,
    required this.timestamp,
    this.status = 'pending',
  });
}

class PrintJob {
  final String id;
  final String title;
  final String details;
  final String target; // 'Kitchen', 'Bar', 'Cashier'
  String status; // 'queued', 'failed', 'printed'
  final DateTime timestamp;

  PrintJob({
    required this.id,
    required this.title,
    required this.details,
    required this.target,
    this.status = 'queued',
    required this.timestamp,
  });
}

class TicketFiscalConfig {
  final String sellerDisplayName;
  final String legalName;
  final String fiscalId;
  final String branchName;
  final String branchAddress;
  final String? phone;
  final String receiptPrefix;
  final String taxMode;
  final String? footerText;
  final DateTime? syncedAt;

  const TicketFiscalConfig({
    required this.sellerDisplayName,
    required this.legalName,
    required this.fiscalId,
    required this.branchName,
    required this.branchAddress,
    this.phone,
    required this.receiptPrefix,
    required this.taxMode,
    this.footerText,
    this.syncedAt,
  });

  factory TicketFiscalConfig.defaults({
    String? businessName,
    String? branchName,
  }) {
    return TicketFiscalConfig(
      sellerDisplayName: businessName?.isNotEmpty == true
          ? businessName!
          : 'Cafeteria Cacharelo',
      legalName: 'Cafeteria Cacharelo S.A. de C.V.',
      fiscalId: 'CACX010101ABC',
      branchName: branchName?.isNotEmpty == true
          ? branchName!
          : 'Sucursal Demo',
      branchAddress: 'Av. Principal 123, Centro, Mexico',
      phone: '555-1234',
      receiptPrefix: 'CCH',
      taxMode: 'breakdown',
      footerText:
          'Comprobante de compra. IVA incluido en precios al publico.\ncacharelo.com',
    );
  }

  factory TicketFiscalConfig.fromJson(Map<String, dynamic> json) {
    return TicketFiscalConfig(
      sellerDisplayName:
          json['sellerDisplayName']?.toString() ?? 'Cafeteria Cacharelo',
      legalName:
          json['legalName']?.toString() ?? 'Cafeteria Cacharelo S.A. de C.V.',
      fiscalId: json['fiscalId']?.toString() ?? 'CACX010101ABC',
      branchName: json['branchName']?.toString() ?? 'Sucursal Demo',
      branchAddress:
          json['branchAddress']?.toString() ??
          'Av. Principal 123, Centro, Mexico',
      phone: json['phone']?.toString(),
      receiptPrefix: json['receiptPrefix']?.toString() ?? 'CCH',
      taxMode: json['taxMode']?.toString() ?? 'breakdown',
      footerText: json['footerText']?.toString(),
      syncedAt: DateTime.tryParse(json['syncedAt']?.toString() ?? ''),
    );
  }

  Map<String, dynamic> toJson() => {
    'sellerDisplayName': sellerDisplayName,
    'legalName': legalName,
    'fiscalId': fiscalId,
    'branchName': branchName,
    'branchAddress': branchAddress,
    'phone': phone,
    'receiptPrefix': receiptPrefix,
    'taxMode': taxMode,
    'footerText': footerText,
    'syncedAt': syncedAt?.toIso8601String(),
  };
}

class AppState extends ChangeNotifier {
  UserRole currentUserRole = UserRole.none;
  String? currentUserId;
  String currentUserName = "";

  // Tables state
  List<TableModel> tables = [];

  // Kitchen orders
  List<KitchenOrder> kitchenOrders = [];

  // Printer Queue
  List<PrintJob> printJobs = [];

  // Recent closed sales history
  List<Map<String, dynamic>> recentClosedSales = [];


  // Shift controls (Cashier)
  bool isShiftOpen = false;
  double cashDrawerAmount = 0.0;
  double initialFloat = 0.0;

  // Offline & sync states
  bool isOnline = true;
  int pendingSyncCount = 0;
  final List<Map<String, dynamic>> _pendingSaleSyncJobs = [];
  final Map<String, String> _activeOrderIdsByTableRemoteId = {};

  // Notification queue (for alerts on waiter screen)
  List<String> readyNotifications = [];

  // Active table selected in Waiter / Cashier views
  TableModel? selectedTable;

  // Terminal Configuration States
  String? terminalBusinessId;
  String? terminalBranchId;
  String? terminalBusinessName;
  String? terminalBranchName;
  String? terminalApiUrl;
  bool isTerminalConfigured = false;
  Map<String, Map<String, dynamic>> roomConfigs = {};
  TicketFiscalConfig ticketFiscalConfig = TicketFiscalConfig.defaults();

  // Bluetooth printer connection state
  String? connectedPrinterMac;
  String? connectedPrinterName;
  bool isConnectingPrinter = false;
  Future<void>? initializationFuture;

  final SecureStorageService _secureStorageService;

  AppState({SecureStorageService? secureStorageService})
    : _secureStorageService = secureStorageService ?? SecureStorageService() {
    _initMockData();
    initializationFuture = () async {
      await loadTerminalConfig();
      await loadTicketFiscalConfig();
      await _loadRecentClosedSales();
      if (isTerminalConfigured) {
        await _loadPendingSaleSyncJobs();
        await syncTicketSettings();
        await fetchMenuDynamic();
        await fetchTablesDynamic();
      } else {
        await _loadPendingSaleSyncJobs();
        await loadTablesFromJson();
      }
    }();
    _seedDefaultUsersOffline();
    _autoConnectPrinter();
  }

  Future<void> loadTerminalConfig() async {
    try {
      final config = await _secureStorageService.getTerminalConfig();
      if (config != null) {
        terminalBusinessId = config['businessId'];
        terminalBranchId = config['branchId'];
        terminalBusinessName = config['businessName'];
        terminalBranchName = config['branchName'];
        terminalApiUrl = config['apiUrl'];
        isTerminalConfigured = true;
      } else {
        isTerminalConfigured = false;
      }
    } catch (e) {
      debugPrint('Error loading terminal config: $e');
      isTerminalConfigured = false;
    }
    notifyListeners();
  }

  Future<void> loadTicketFiscalConfig() async {
    try {
      final cached = await _secureStorageService.getTicketFiscalConfig();
      ticketFiscalConfig = cached != null
          ? TicketFiscalConfig.fromJson(cached)
          : TicketFiscalConfig.defaults(
              businessName: terminalBusinessName,
              branchName: terminalBranchName,
            );
    } catch (e) {
      debugPrint('Error loading ticket fiscal config: $e');
      ticketFiscalConfig = TicketFiscalConfig.defaults(
        businessName: terminalBusinessName,
        branchName: terminalBranchName,
      );
    }
  }

  Future<void> configureTerminal({
    required String businessId,
    required String branchId,
    required String businessName,
    required String branchName,
    required String apiUrl,
  }) async {
    terminalBusinessId = businessId;
    terminalBranchId = branchId;
    terminalBusinessName = businessName;
    terminalBranchName = branchName;
    terminalApiUrl = apiUrl;
    isTerminalConfigured = true;

    await _secureStorageService.saveTerminalConfig(
      businessId: businessId,
      branchId: branchId,
      businessName: businessName,
      branchName: branchName,
      apiUrl: apiUrl,
    );

    await fetchMenuDynamic();
    await syncTicketSettings();
    notifyListeners();
  }

  Future<void> deconfigureTerminal() async {
    terminalBusinessId = null;
    terminalBranchId = null;
    terminalBusinessName = null;
    terminalBranchName = null;
    terminalApiUrl = null;
    isTerminalConfigured = false;

    await _secureStorageService.clearTerminalConfig();
    notifyListeners();
  }

  Future<bool> configureTerminalWithCode(String branchId) async {
    try {
      String baseUrl = 'https://pos-sync-api-umqpitkpoa-uc.a.run.app/api';

      http.Response response = await http
          .get(Uri.parse('$baseUrl/branches/$branchId'))
          .timeout(const Duration(seconds: 12));

      if (response.statusCode == 200) {
        final Map<String, dynamic> branch = jsonDecode(response.body);
        final String? bId = branch['businessId'];
        final String? name = branch['name'];

        if (bId != null && name != null) {
          await configureTerminal(
            businessId: bId,
            branchId: branchId,
            businessName: 'Empire POS',
            branchName: name,
            apiUrl: baseUrl,
          );
          return true;
        }
      }
    } catch (e) {
      debugPrint('Error configuring terminal with code: $e');
    }
    return false;
  }

  Future<bool> syncTicketSettings() async {
    if (!isTerminalConfigured) return false;

    try {
      final String baseUrl =
          terminalApiUrl ?? 'https://pos-sync-api-umqpitkpoa-uc.a.run.app/api';
      final String? businessId = terminalBusinessId;
      final String? branchId = terminalBranchId;
      if (businessId == null || branchId == null) return false;

      final response = await http
          .get(
            Uri.parse(
              '$baseUrl/ticket-settings?businessId=$businessId&branchId=$branchId',
            ),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        debugPrint('syncTicketSettings status error: ${response.statusCode}');
        return false;
      }

      final data = Map<String, dynamic>.from(jsonDecode(response.body));
      data['syncedAt'] = DateTime.now().toIso8601String();
      final synced = TicketFiscalConfig.fromJson(data);
      ticketFiscalConfig = synced;
      await _secureStorageService.saveTicketFiscalConfig(synced.toJson());
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Error syncing ticket settings: $e');
      return false;
    }
  }

  Future<bool> syncOperators() async {
    if (!isTerminalConfigured) {
      debugPrint('SyncOperators skipped: Terminal is not configured.');
      return false;
    }
    try {
      final String baseUrl =
          terminalApiUrl ?? 'https://pos-sync-api-umqpitkpoa-uc.a.run.app/api';
      final String bId =
          terminalBusinessId ?? 'd3b07384-d113-4a0e-a555-e5b12824bf01';
      final String brId = terminalBranchId ?? '';

      final url = '$baseUrl/auth/operators?businessId=$bId&branchId=$brId';
      debugPrint('Syncing operators from: $url');
      final response = await http
          .get(Uri.parse(url))
          .timeout(const Duration(seconds: 10));

      debugPrint('SyncOperators response status: ${response.statusCode}');
      if (response.statusCode == 200) {
        final List<dynamic> operators = jsonDecode(response.body);
        debugPrint('SyncOperators loaded ${operators.length} operators.');
        if (operators.isNotEmpty) {
          await _secureStorageService.cacheOperatorsOffline(operators);
          _hydrateCurrentUserIdFromOperators(operators);
        }
        return true;
      } else {
        debugPrint(
          'SyncOperators server returned error status: ${response.statusCode}, body: ${response.body}',
        );
      }
    } catch (e) {
      debugPrint('Error syncing operators: $e');
    }
    return false;
  }

  Future<bool> syncAllData() async {
    bool success = true;

    final txSync = await syncOfflineTransactions();
    if (!txSync) {
      success = false;
    }

    if (isTerminalConfigured) {
      final ticketSync = await syncTicketSettings();
      if (!ticketSync) {
        debugPrint('syncAllData: syncTicketSettings returned false');
        success = false;
      }

      try {
        await fetchMenuDynamic();
      } catch (e) {
        debugPrint('syncAllData: fetchMenuDynamic failed with error: $e');
        success = false;
      }
    }

    if (currentUserRole == UserRole.none) {
      final opsSync = await syncOperators();
      if (!opsSync) {
        debugPrint('syncAllData: syncOperators returned false');
        success = false;
      }
    }

    if (currentUserRole == UserRole.waiter) {
      try {
        await fetchTablesDynamic();
        await syncActiveOrders();
        await syncKitchenOrders();
        // Sync table states last to ensure they override any stale data
        await syncTableStates();
      } catch (e) {
        debugPrint('syncAllData: sync failed with error: $e');
        success = false;
      }
    } else if (currentUserRole == UserRole.cashier) {
      try {
        await fetchTablesDynamic();
        await syncActiveOrders();
        // Sync table states last to ensure they override any stale data
        await syncTableStates();
        final cashierTxSync = await syncOfflineTransactions();
        if (!cashierTxSync) success = false;
      } catch (e) {
        debugPrint(
          'syncAllData: sync failed with error: $e',
        );
        success = false;
      }
    } else if (currentUserRole == UserRole.kitchen) {
      try {
        await syncKitchenOrders();
      } catch (e) {
        debugPrint('syncAllData: syncKitchenOrders failed with error: $e');
        success = false;
      }
    }

    // TODO: Consider adding periodic background sync (every 10-15 seconds) to keep
    // table states fresh across all devices. This would require implementing a timer
    // that calls syncTableStates() in the background. Be mindful of API rate limits.

    notifyListeners();
    return success;
  }

  Future<void> _seedDefaultUsersOffline() async {
    try {
      final cached = await _secureStorageService.verifyOfflineCredentials(
        '1111',
      );
      if (cached == null) {
        await _secureStorageService.cacheUserOffline(
          name: 'Juan (Mesero)',
          pin: '1111',
          role: 'waiter',
        );
        await _secureStorageService.cacheUserOffline(
          name: 'Sofia (Cajero)',
          pin: '2222',
          role: 'cashier',
        );
        await _secureStorageService.cacheUserOffline(
          name: 'Chef Carlos',
          pin: '3333',
          role: 'kitchen',
        );
      }
    } catch (e) {
      debugPrint('Error writing default secure storage seed: $e');
    }
  }

  void _initMockData() {
    // Generate mock tables for 3 zones: Salón Principal, Terraza, Bar
    tables = [
      // Salón Principal
      TableModel(
        id: 1,
        label: 'Mesa 1',
        shape: TableShape.circle,
        zone: 'Salón Principal',
        x: 0.15,
        y: 0.25,
      ),
      TableModel(
        id: 2,
        label: 'Mesa 2',
        shape: TableShape.square,
        zone: 'Salón Principal',
        x: 0.45,
        y: 0.25,
      ),
      TableModel(
        id: 3,
        label: 'Mesa 3',
        shape: TableShape.circle,
        zone: 'Salón Principal',
        x: 0.75,
        y: 0.25,
      ),
      TableModel(
        id: 4,
        label: 'Mesa 4',
        shape: TableShape.square,
        zone: 'Salón Principal',
        x: 0.15,
        y: 0.65,
      ),
      TableModel(
        id: 5,
        label: 'Mesa 5',
        shape: TableShape.circle,
        zone: 'Salón Principal',
        x: 0.45,
        y: 0.65,
        state: TableState.occupied,
        guests: 2,
        items: [
          OrderItem(
            item: menu[0],
            quantity: 2,
            modifiers: ['Queso Extra'],
            isSent: true,
          ),
          OrderItem(item: menu[4], quantity: 2, isSent: true),
        ],
      ),
      TableModel(
        id: 6,
        label: 'Mesa 6',
        shape: TableShape.square,
        zone: 'Salón Principal',
        x: 0.75,
        y: 0.65,
        state: TableState.billing,
        guests: 4,
        items: [
          OrderItem(item: menu[1], quantity: 2, isSent: true),
          OrderItem(
            item: menu[2],
            quantity: 2,
            modifiers: ['Bien Cocido'],
            isSent: true,
          ),
          OrderItem(item: menu[5], quantity: 4, isSent: true),
        ],
      ),

      // Terraza
      TableModel(
        id: 7,
        label: 'Terraza 1',
        shape: TableShape.square,
        zone: 'Terraza',
        x: 0.2,
        y: 0.3,
      ),
      TableModel(
        id: 8,
        label: 'Terraza 2',
        shape: TableShape.circle,
        zone: 'Terraza',
        x: 0.5,
        y: 0.3,
      ),
      TableModel(
        id: 9,
        label: 'Terraza 3',
        shape: TableShape.square,
        zone: 'Terraza',
        x: 0.8,
        y: 0.3,
      ),
      TableModel(
        id: 10,
        label: 'Terraza 4',
        shape: TableShape.circle,
        zone: 'Terraza',
        x: 0.35,
        y: 0.7,
      ),

      // Bar
      TableModel(
        id: 11,
        label: 'Bar 1',
        shape: TableShape.circle,
        zone: 'Bar',
        x: 0.25,
        y: 0.45,
      ),
      TableModel(
        id: 12,
        label: 'Bar 2',
        shape: TableShape.circle,
        zone: 'Bar',
        x: 0.75,
        y: 0.45,
      ),
    ];
  }

  Future<void> loadTablesFromJson() async {
    try {
      final jsonString = await rootBundle.loadString(
        'assets/floor_plan_mesa.json',
      ).timeout(const Duration(seconds: 1), onTimeout: () => '[]');
      final List<dynamic> data = json.decode(jsonString);

      final Map<int, TableModel> currentTablesMap = {
        for (var t in tables) t.id: t,
      };

      final List<TableModel> loadedTables = [];
      for (var item in data) {
        final int id = item['id'];
        final String label = item['label'];
        final String shapeStr = item['shape'];
        final String zone = item['zone'];
        final double x = (item['x'] as num).toDouble();
        final double y = (item['y'] as num).toDouble();

        final TableShape shape = shapeStr == 'circle'
            ? TableShape.circle
            : TableShape.square;

        final existing = currentTablesMap[id];
        if (existing != null) {
          loadedTables.add(
            TableModel(
              id: id,
              label: label,
              shape: shape,
              zone: zone,
              x: x,
              y: y,
              state: existing.state,
              items: existing.items,
              guests: existing.guests,
              discountPercentage: existing.discountPercentage,
              guestGenders: existing.guestGenders,
            ),
          );
        } else {
          TableState state = TableState.free;
          int guests = 0;
          List<OrderItem> items = [];
          if (id == 5) {
            state = TableState.occupied;
            guests = 2;
            items = [
              OrderItem(
                item: menu[0],
                quantity: 2,
                modifiers: ['Queso Extra'],
                isSent: true,
              ),
              OrderItem(item: menu[4], quantity: 2, isSent: true),
            ];
          } else if (id == 6) {
            state = TableState.billing;
            guests = 4;
            items = [
              OrderItem(item: menu[1], quantity: 2, isSent: true),
              OrderItem(
                item: menu[2],
                quantity: 2,
                modifiers: ['Bien Cocido'],
                isSent: true,
              ),
              OrderItem(item: menu[5], quantity: 4, isSent: true),
            ];
          }
          loadedTables.add(
            TableModel(
              id: id,
              label: label,
              shape: shape,
              zone: zone,
              x: x,
              y: y,
              state: state,
              guests: guests,
              items: items,
            ),
          );
        }
      }

      tables = loadedTables;
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading floor plan from JSON: $e');
    }
  }

  Future<void> fetchTablesDynamic() async {
    if (!isTerminalConfigured || terminalBranchId == null) {
      await loadTablesFromJson();
      return;
    }

    try {
      final String baseUrl =
          terminalApiUrl ?? 'https://pos-sync-api-umqpitkpoa-uc.a.run.app/api';
      final String brId = terminalBranchId!;

      // Fetch branch configs dynamically (room configs, zoom, images)
      try {
        final branchResponse = await http
            .get(Uri.parse('$baseUrl/branches/$brId'))
            .timeout(const Duration(seconds: 10));

        if (branchResponse.statusCode == 200) {
          final Map<String, dynamic> branchData = jsonDecode(
            branchResponse.body,
          );
          final String? roomConfigsStr = branchData['roomConfigs'];
          if (roomConfigsStr != null) {
            final Map<String, dynamic> parsed = jsonDecode(roomConfigsStr);
            roomConfigs = parsed.map(
              (key, value) => MapEntry(key, Map<String, dynamic>.from(value)),
            );
          }
        }
      } catch (e) {
        debugPrint('Error fetching branch roomConfigs: $e');
      }

      final response = await http
          .get(Uri.parse('$baseUrl/branches/$brId/tables'))
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final List<dynamic> dbData = jsonDecode(response.body);

        // 1. Load layout coordinates from assets for placement reference
        Map<String, Map<String, dynamic>> layoutCoords = {};
        try {
          final jsonString = await rootBundle.loadString(
            'assets/floor_plan_mesa.json',
          );
          final List<dynamic> refList = json.decode(jsonString);
          for (var ref in refList) {
            final String normLabel = (ref['label'] as String)
                .trim()
                .toLowerCase();
            layoutCoords[normLabel] = {
              'x': (ref['x'] as num).toDouble(),
              'y': (ref['y'] as num).toDouble(),
              'shape': ref['shape'] as String,
            };
          }
        } catch (e) {
          debugPrint('Error loading layout references: $e');
        }

        // Keep current orders state so we don't clear active carts/orders on table sync
        final Map<int, TableModel> currentTablesMap = {
          for (var t in tables) t.id: t,
        };

        final List<TableModel> loadedTables = [];
        final Map<String, int> zoneCounters = {};

        for (var item in dbData) {
          final String dbIdStr = item['id'] ?? '';
          final String label = item['label'] ?? '';
          final String zone = item['room'] ?? 'General';
          final String stateStr = item['state'] ?? 'free';

          final int localId = dbIdStr.hashCode;
          final String normLabel = label.trim().toLowerCase();

          double x = 0.15;
          double y = 0.25;
          TableShape shape = TableShape.square;

          // 1. Check if database coordinates are available
          if (item['x'] != null && item['y'] != null) {
            x = (item['x'] as num).toDouble();
            y = (item['y'] as num).toDouble();
            shape = item['shape'] == 'circle'
                ? TableShape.circle
                : TableShape.square;
          }
          // 2. Fallback to asset template coordinates
          else if (layoutCoords.containsKey(normLabel)) {
            final coords = layoutCoords[normLabel]!;
            x = coords['x'];
            y = coords['y'];
            shape = coords['shape'] == 'circle'
                ? TableShape.circle
                : TableShape.square;
          }
          // 3. Dynamic grid mapping fallback
          else {
            double startY = 0.25;
            switch (zone) {
              case 'Salón Principal':
                startY = 0.95;
                break;
              case 'Terraza':
                startY = 1.05;
                break;
              case 'Bar':
              case 'Barra':
                startY = 0.80;
                break;
              default:
                startY = 0.25;
                break;
            }

            final int count = zoneCounters[zone] ?? 0;
            zoneCounters[zone] = count + 1;

            final int col = count % 3;
            final int row = count ~/ 3;
            x = 0.15 + col * 0.30;
            y = startY + row * 0.30;

            if (normLabel.contains('barra') ||
                normLabel.contains('bar') ||
                normLabel.contains('mostrador')) {
              shape = TableShape.circle;
            }
          }

          // Map TableState
          TableState state = TableState.free;
          switch (stateStr) {
            case 'occupied':
              state = TableState.occupied;
              break;
            case 'billing':
              state = TableState.billing;
              break;
            case 'cleaning':
              state = TableState.cleaning;
              break;
            case 'free':
            default:
              state = TableState.free;
              break;
          }

          final existing = currentTablesMap[localId];
          if (existing != null) {
            // Use state from database, but preserve local cart data (items, guests, etc)
            loadedTables.add(
              TableModel(
                id: localId,
                remoteId: dbIdStr,
                label: label,
                shape: shape,
                zone: zone,
                x: x,
                y: y,
                state: state, // Use DB state, not existing.state!
                items: existing.items,
                guests: existing.guests,
                discountPercentage: existing.discountPercentage,
                guestGenders: existing.guestGenders,
              ),
            );
          } else {
            loadedTables.add(
              TableModel(
                id: localId,
                remoteId: dbIdStr,
                label: label,
                shape: shape,
                zone: zone,
                x: x,
                y: y,
                state: state,
                items: const [],
                guests: 0,
                guestGenders: const ['M'],
              ),
            );
          }
        }

        tables = loadedTables;
        // Don't call notifyListeners() here - let the caller decide when to notify
        // This prevents premature UI updates before sync completes
      } else {
        debugPrint('fetchTablesDynamic status error: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('Error fetching dynamic tables: $e');
      // Fail-safe: fall back to local JSON
      await loadTablesFromJson();
    }
  }

  Future<void> fetchMenuDynamic() async {
    if (!isTerminalConfigured) return;
    try {
      final String baseUrl =
          terminalApiUrl ?? 'https://pos-sync-api-umqpitkpoa-uc.a.run.app/api';
      final bool isLocalConfig =
          baseUrl.contains('localhost') ||
          baseUrl.contains('10.0.2.2') ||
          baseUrl.contains('127.0.0.1');

      http.Response catResponse;
      http.Response prodResponse;
      final String bId =
          terminalBusinessId ?? 'd3b07384-d113-4a0e-a555-e5b12824bf01';

      try {
        catResponse = await http
            .get(Uri.parse('$baseUrl/categories?businessId=$bId'))
            .timeout(const Duration(seconds: 10));
        prodResponse = await http
            .get(Uri.parse('$baseUrl/products?businessId=$bId'))
            .timeout(const Duration(seconds: 10));
      } catch (e) {
        debugPrint('API request failed: $e');
        if (isLocalConfig) {
          // If local config failed, we can try to switch address helper or rethrow
          rethrow;
        } else {
          rethrow;
        }
      }

      if (catResponse.statusCode == 200 && prodResponse.statusCode == 200) {
        final List<dynamic> catData = jsonDecode(catResponse.body);
        final List<dynamic> prodData = jsonDecode(prodResponse.body);

        final Map<String, String> catMap = {};
        for (var cat in catData) {
          catMap[cat['id']] = cat['name'];
        }

        final List<MenuItem> loadedMenu = [];
        for (var prod in prodData) {
          if (prod['isSellable'] != false &&
              prod['isIngredient'] != true &&
              prod['isActive'] != false) {
            loadedMenu.add(
              MenuItem(
                id: prod['id'],
                name: prod['name'],
                price:
                    double.tryParse(prod['price']?.toString() ?? '0.0') ?? 0.0,
                category: catMap[prod['categoryId']] ?? 'Otros',
                imagePath: prod['imageUrl'] ?? '',
              ),
            );
          }
        }

        if (loadedMenu.isNotEmpty) {
          menu.clear();
          menu.addAll(loadedMenu);
          isOnline = true;
          notifyListeners();
        }
      }
    } catch (e) {
      debugPrint('Error fetching menu dynamically: $e');
      isOnline = false;
      notifyListeners();
    }
  }

  Future<bool> syncActiveOrders({bool notify = true}) async {
    if (!isTerminalConfigured || terminalBranchId == null) return false;

    try {
      final String baseUrl =
          terminalApiUrl ?? 'https://pos-sync-api-umqpitkpoa-uc.a.run.app/api';
      final response = await http
          .get(Uri.parse('$baseUrl/orders/active?branchId=$terminalBranchId'))
          .timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        debugPrint('syncActiveOrders status error: ${response.statusCode}');
        return false;
      }

      final List<dynamic> activeOrders = jsonDecode(response.body);
      final activeTableIds = <String>{};

      for (final rawOrder in activeOrders.whereType<Map>()) {
        final order = Map<String, dynamic>.from(rawOrder);
        final tableId = order['tableId']?.toString();
        final orderId = order['id']?.toString();
        if (!_isUuid(tableId) || !_isUuid(orderId)) continue;

        activeTableIds.add(tableId!);
        _activeOrderIdsByTableRemoteId[tableId] = orderId!;

        final tableIndex = tables.indexWhere(
          (table) => table.remoteId == tableId,
        );
        if (tableIndex == -1) continue;

        final state = order['state']?.toString() == 'billing'
            ? TableState.billing
            : TableState.occupied;

        tables[tableIndex].state = state;
        tables[tableIndex].items = _itemsFromCloud(order['items']);
      }

      // Clear items from tables that no longer have active orders
      // This fixes the issue where completed orders still show items
      for (int i = 0; i < tables.length; i++) {
        final table = tables[i];
        if (table.remoteId != null &&
            !activeTableIds.contains(table.remoteId) &&
            table.items.isNotEmpty) {
          // Table had items but is not in active orders anymore
          // Clear the items (state will be updated by syncTableStates)
          tables[i].items = [];
          debugPrint('Cleared items from table ${table.label} (no longer has active order)');
        }
      }

      _activeOrderIdsByTableRemoteId.removeWhere(
        (tableId, _) => !activeTableIds.contains(tableId),
      );

      if (notify) notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Error syncing active orders: $e');
      return false;
    }
  }

  Future<bool> syncKitchenOrders() async {
    if (!isTerminalConfigured || terminalBranchId == null) return false;

    try {
      final String baseUrl =
          terminalApiUrl ?? 'https://pos-sync-api-umqpitkpoa-uc.a.run.app/api';
      final response = await http
          .get(Uri.parse('$baseUrl/kitchen/active?branchId=$terminalBranchId'))
          .timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        debugPrint('syncKitchenOrders status error: ${response.statusCode}');
        return false;
      }

      final Map<String, String> oldStatuses = {
        for (final o in kitchenOrders) o.id: o.status,
      };

      final List<dynamic> tickets = jsonDecode(response.body);
      final List<KitchenOrder> newOrders = tickets
          .whereType<Map>()
          .map((rawTicket) {
            final ticket = Map<String, dynamic>.from(rawTicket);
            return KitchenOrder(
              id: ticket['id']?.toString() ?? '',
              tableLabel: ticket['tableLabel']?.toString() ?? 'Mesa',
              items: _itemsFromCloud(ticket['items']),
              timestamp:
                  DateTime.tryParse(ticket['createdAt']?.toString() ?? '') ??
                  DateTime.now(),
              status: ticket['status']?.toString() ?? 'pending',
            );
          })
          .where((order) => order.id.isNotEmpty)
          .toList();

      // Trigger notification if status changed to 'ready'
      for (final order in newOrders) {
        final oldStatus = oldStatuses[order.id];
        if (order.status == 'ready' && oldStatus != 'ready') {
          final String notificationText = '¡Pedido listo para la ${order.tableLabel}!';
          if (!readyNotifications.contains(notificationText)) {
            readyNotifications.add(notificationText);
          }
        }
      }

      kitchenOrders = newOrders;
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Error syncing kitchen orders: $e');
      return false;
    }
  }

  /// Syncs table states from the backend using the pull sync endpoint.
  /// This ensures all devices see the latest table states (free, occupied, billing, cleaning).
  Future<bool> syncTableStates({bool notify = true}) async {
    if (!isTerminalConfigured || terminalBranchId == null) return false;

    try {
      final String baseUrl =
          terminalApiUrl ?? 'https://pos-sync-api-umqpitkpoa-uc.a.run.app/api';

      // Get last sync checkpoint timestamp
      final lastSyncedAt = await _getLastSyncCheckpoint();

      // Call POST /sync/pull endpoint
      final response = await http
          .post(
            Uri.parse('$baseUrl/sync/pull'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'deviceId': 'tablet-pos-1',
              'branchId': terminalBranchId,
              if (lastSyncedAt != null) 'lastSyncedAt': lastSyncedAt,
            }),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        debugPrint('syncTableStates status error: ${response.statusCode}');
        return false;
      }

      final responseData = jsonDecode(response.body);
      final changes = responseData['changes'] as Map<String, dynamic>?;
      final serverTimestamp = responseData['timestamp'] as String?;

      if (changes == null) {
        debugPrint('syncTableStates: No changes in response');
        return false;
      }

      // Update local table states from the branchTables in the response
      final branchTables = changes['branchTables'] as List?;
      if (branchTables != null && branchTables.isNotEmpty) {
        for (final tableData in branchTables.whereType<Map>()) {
          final tableId = tableData['id']?.toString();
          final tableState = tableData['state']?.toString();

          if (tableId == null || tableState == null) continue;

          final tableIndex = tables.indexWhere((t) => t.remoteId == tableId);
          if (tableIndex != -1) {
            tables[tableIndex].state = _parseTableState(tableState);
          }
        }

        debugPrint('syncTableStates: Updated ${branchTables.length} table(s)');
      }

      // Save the new sync checkpoint timestamp
      if (serverTimestamp != null) {
        await _saveLastSyncCheckpoint(serverTimestamp);
      }

      if (notify) notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Error syncing table states: $e');
      return false;
    }
  }

  /// Parses a table state string into the TableState enum
  TableState _parseTableState(String state) {
    switch (state.toLowerCase()) {
      case 'free':
        return TableState.free;
      case 'occupied':
        return TableState.occupied;
      case 'billing':
        return TableState.billing;
      case 'cleaning':
        return TableState.cleaning;
      default:
        return TableState.free;
    }
  }

  /// Gets the last sync checkpoint timestamp from secure storage
  Future<String?> _getLastSyncCheckpoint() async {
    try {
      return await _secureStorageService.getSyncCheckpoint();
    } catch (e) {
      debugPrint('Error reading sync checkpoint: $e');
      return null;
    }
  }

  /// Saves the sync checkpoint timestamp to secure storage
  Future<void> _saveLastSyncCheckpoint(String timestamp) async {
    try {
      await _secureStorageService.saveSyncCheckpoint(timestamp);
    } catch (e) {
      debugPrint('Error saving sync checkpoint: $e');
    }
  }

  List<OrderItem> _itemsFromCloud(dynamic rawItems) {
    if (rawItems is! List) return [];

    return rawItems.whereType<Map>().map((rawItem) {
      final item = Map<String, dynamic>.from(rawItem);
      final productId = item['productId']?.toString() ?? '';
      final menuItem = _menuItemById(
        productId,
        fallbackName: item['productName']?.toString(),
      );
      final quantity = (item['quantity'] as num?)?.toInt() ?? 1;
      final grossUnitPrice =
          double.tryParse(item['price']?.toString() ?? '') ??
          menuItem.price;
      final assignedGuest = item['assignedGuest'] == null
          ? null
          : 'P${item['assignedGuest']}';
      final notes = item['notes']?.toString() ?? '';

      return OrderItem(
        item: MenuItem(
          id: menuItem.id,
          name: menuItem.name,
          price: grossUnitPrice,
          category: menuItem.category,
          imagePath: menuItem.imagePath,
          modifierGroups: menuItem.modifierGroups,
        ),
        quantity: quantity,
        assignedGuest: assignedGuest,
        notes: notes,
        isSent: true,
      );
    }).toList();
  }

  MenuItem _menuItemById(String id, {String? fallbackName}) {
    for (final item in menu) {
      if (item.id == id) return item;
    }
    return MenuItem(
      id: id,
      name: fallbackName?.isNotEmpty == true ? fallbackName! : 'Producto',
      price: 0,
      category: 'Otros',
    );
  }

  // Predefined Menu Items
  static final List<MenuItem> menu = [
    MenuItem(
      id: '1',
      name: 'Lasagna Bolognesa',
      price: 18.50,
      category: 'Pastas',
    ),
    MenuItem(
      id: '2',
      name: 'Fettuccine Alfredo',
      price: 16.00,
      category: 'Pastas',
    ),
    MenuItem(
      id: '3',
      name: 'Hamburguesa Empire',
      price: 14.50,
      category: 'Hamburguesas',
    ),
    MenuItem(
      id: '4',
      name: 'Hamburguesa de Pollo',
      price: 13.00,
      category: 'Hamburguesas',
    ),
    MenuItem(
      id: '5',
      name: 'Tiramisú de la Casa',
      price: 7.50,
      category: 'Postres',
    ),
    MenuItem(
      id: '6',
      name: 'Volcán de Chocolate',
      price: 8.50,
      category: 'Postres',
    ),
    MenuItem(
      id: '7',
      name: 'Vino Tinto Copa',
      price: 9.00,
      category: 'Bebidas',
    ),
    MenuItem(
      id: '8',
      name: 'Limonada de Coco',
      price: 5.50,
      category: 'Bebidas',
    ),
  ];

  // Auth Operations (Query backend, fallback to offline local cache)
  Future<bool> login(String pin) async {
    try {
      final String bId =
          terminalBusinessId ?? 'd3b07384-d113-4a0e-a555-e5b12824bf01';
      final String? brId = terminalBranchId;

      final Map<String, dynamic> payload = {
        'businessId': bId,
        'pin': pin,
        'deviceId': 'tablet-pos-1',
      };
      if (brId != null && brId.isNotEmpty) {
        payload['branchId'] = brId;
      }

      http.Response response;
      final String baseUrl =
          terminalApiUrl ?? 'https://pos-sync-api-umqpitkpoa-uc.a.run.app/api';
      try {
        response = await http
            .post(
              Uri.parse('$baseUrl/auth/tablet-login'),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode(payload),
            )
            .timeout(const Duration(seconds: 3));
      } catch (e) {
        debugPrint('Hosted tablet-login failed, trying local: $e');
        final String host = Platform.isAndroid ? '10.0.2.2' : 'localhost';
        response = await http
            .post(
              Uri.parse('http://$host:3000/api/auth/tablet-login'),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode(payload),
            )
            .timeout(const Duration(seconds: 3));
      }

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true || data['user'] != null) {
          final userData = data['user'];
          currentUserId = userData['id'];
          currentUserName = userData['name'];
          currentUserRole = _parseRole(userData['role']);

          // Securely cache credentials locally
          await _secureStorageService.cacheUserOffline(
            id: userData['id'],
            name: userData['name'],
            pin: pin,
            role: userData['role'],
          );

          unawaited(syncAllData());
          notifyListeners();
          return true;
        }
      }
    } catch (e) {
      debugPrint(
        'Error de conexión con el servidor de autenticación, usando credenciales locales: $e',
      );
    }

    // Fallback offline secure credentials validation
    try {
      final offlineUser = await _secureStorageService.verifyOfflineCredentials(
        pin,
      );
      if (offlineUser != null) {
        currentUserId = offlineUser['id']?.isNotEmpty == true
            ? offlineUser['id']
            : null;
        currentUserName = offlineUser['name']!;
        currentUserRole = _parseRole(offlineUser['role']!);
        unawaited(syncAllData());
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('Error during offline secure login verification: $e');
    }

    return false;
  }

  UserRole _parseRole(String roleStr) {
    switch (roleStr.toLowerCase()) {
      case 'waiter':
        return UserRole.waiter;
      case 'cashier':
        return UserRole.cashier;
      case 'kitchen':
        return UserRole.kitchen;
      default:
        return UserRole.none;
    }
  }

  void logout() {
    currentUserRole = UserRole.none;
    currentUserId = null;
    currentUserName = "";
    selectedTable = null;
    notifyListeners();
  }

  // Network Offline Simulation Toggle
  void toggleConnection() {
    isOnline = !isOnline;
    notifyListeners();
  }

  // Cashier Session Methods
  void openShift(double floatAmount) {
    isShiftOpen = true;
    initialFloat = floatAmount;
    cashDrawerAmount = floatAmount;
    notifyListeners();
  }

  void closeShift() {
    isShiftOpen = false;
    initialFloat = 0.0;
    notifyListeners();
  }

  void addCashDrop(double amount) {
    cashDrawerAmount += amount;
    notifyListeners();
  }

  void removeCashDrop(double amount) {
    cashDrawerAmount = max(0.0, cashDrawerAmount - amount);
    notifyListeners();
  }

  // Waiter Order submission
  void submitOrder(
    int tableId,
    List<OrderItem> cartItems,
    int guestsCount,
    List<String> genders, {
    bool printComanda = false,
  }) {
    if (cartItems.isEmpty) {
      unawaited(cancelActiveOrder(tableId));
      return;
    }

    final index = tables.indexWhere((t) => t.id == tableId);
    if (index != -1) {
      // Filter out only new (unsent) items to print and send to kitchen
      final newItems = cartItems.where((i) => !i.isSent).toList();

      // Mark all cart items as sent
      final updatedItems = cartItems
          .map((i) => i.copyWith(isSent: true))
          .toList();

      tables[index].items = updatedItems;
      tables[index].guests = guestsCount;
      tables[index].guestGenders = List.from(genders);
      tables[index].state = TableState.occupied;

      if (newItems.isNotEmpty) {
        // Add print jobs
        final newJobId = DateTime.now().millisecondsSinceEpoch.toString();

        // Determine targets
        final hasKitchenItems = newItems.any(
          (i) => i.item.category != 'Bebidas',
        );
        final hasBarItems = newItems.any((i) => i.item.category == 'Bebidas');

        final dateStr = DateTime.now().toString().substring(0, 16);

        if (hasKitchenItems) {
          final buffer = StringBuffer();
          buffer.writeln(formatCenter('=== COMANDA COCINA ==='));
          buffer.writeln(formatCenter(tables[index].label));
          buffer.writeln(formatRow('Fecha:', dateStr));
          buffer.writeln(formatRow('Mesero:', currentUserName));
          buffer.writeln(formatDivider());

          final kitchenItems = newItems.where(
            (i) => i.item.category != 'Bebidas',
          );
          for (final item in kitchenItems) {
            buffer.writeln('${item.quantity}x ${item.item.name}');
            if (item.assignedGuest != null) {
              final guest = item.assignedGuest!;
              final displayGuest = guest.startsWith('P')
                  ? 'Persona ${guest.substring(1)}'
                  : guest;
              buffer.writeln('  [$displayGuest]');
            }
            if (item.modifiers.isNotEmpty) {
              buffer.writeln('  + ${item.modifiers.join(', ')}');
            }
            if (item.notes.isNotEmpty) {
              buffer.writeln('  * Nota: ${item.notes}');
            }
          }
          buffer.writeln(formatDivider());
          buffer.writeln('');

          enqueuePrintJob(
            PrintJob(
              id: '${newJobId}_k',
              title: 'Comanda Cocina - ${tables[index].label}',
              details: buffer.toString(),
              target: 'Cocina',
              timestamp: DateTime.now(),
            ),
            forcePhysical: printComanda,
          );
        }

        if (hasBarItems) {
          final buffer = StringBuffer();
          buffer.writeln(formatCenter('=== COMANDA BARRA ==='));
          buffer.writeln(formatCenter(tables[index].label));
          buffer.writeln(formatRow('Fecha:', dateStr));
          buffer.writeln(formatRow('Mesero:', currentUserName));
          buffer.writeln(formatDivider());

          final barItems = newItems.where((i) => i.item.category == 'Bebidas');
          for (final item in barItems) {
            buffer.writeln('${item.quantity}x ${item.item.name}');
            if (item.assignedGuest != null) {
              final guest = item.assignedGuest!;
              final displayGuest = guest.startsWith('P')
                  ? 'Persona ${guest.substring(1)}'
                  : guest;
              buffer.writeln('  [$displayGuest]');
            }
            if (item.modifiers.isNotEmpty) {
              buffer.writeln('  + ${item.modifiers.join(', ')}');
            }
            if (item.notes.isNotEmpty) {
              buffer.writeln('  * Nota: ${item.notes}');
            }
          }
          buffer.writeln(formatDivider());
          buffer.writeln('');

          enqueuePrintJob(
            PrintJob(
              id: '${newJobId}_b',
              title: 'Comanda Barra - ${tables[index].label}',
              details: buffer.toString(),
              target: 'Barra',
              timestamp: DateTime.now(),
            ),
            forcePhysical: printComanda,
          );
        }

        // Add to Kitchen Orders
        kitchenOrders.add(
          KitchenOrder(
            id: newJobId,
            tableLabel: tables[index].label,
            items: List.from(newItems),
            timestamp: DateTime.now(),
          ),
        );

        unawaited(_pushOpenOrderToCloud(tables[index], newItems));
      }

      notifyListeners();
    }
  }

  Future<void> cancelActiveOrder(int tableId) async {
    final index = tables.indexWhere((t) => t.id == tableId);
    if (index == -1) return;

    final table = tables[index];
    final tableRemoteId = _remoteIdForTable(table);
    final orderId = tableRemoteId == null
        ? null
        : _activeOrderIdsByTableRemoteId[tableRemoteId];

    // Clear local state
    table.items = [];
    table.guests = 0;
    table.state = TableState.free;

    if (tableRemoteId != null) {
      _activeOrderIdsByTableRemoteId.remove(tableRemoteId);
    }

    notifyListeners();

    if (orderId != null) {
      try {
        final String baseUrl =
            terminalApiUrl ?? 'https://pos-sync-api-umqpitkpoa-uc.a.run.app/api';
        await http
            .post(Uri.parse('$baseUrl/orders/$orderId/cancel'))
            .timeout(const Duration(seconds: 8));
      } catch (e) {
        debugPrint('Cloud order cancel failed: $e');
      }
    }
  }

  // Mark Table as ready for billing
  void requestBilling(int tableId) {
    final index = tables.indexWhere((t) => t.id == tableId);
    if (index != -1) {
      tables[index].state = TableState.billing;
      unawaited(_requestCloudBilling(tables[index]));
      notifyListeners();
    }
  }

  Future<void> _pushOpenOrderToCloud(
    TableModel table,
    List<OrderItem> newItems,
  ) async {
    if (!isTerminalConfigured || terminalBranchId == null) return;
    final tableRemoteId = _remoteIdForTable(table);
    if (!_isUuid(tableRemoteId) || !_isUuid(currentUserId)) return;
    if (newItems.isEmpty) return;

    try {
      final String baseUrl =
          terminalApiUrl ?? 'https://pos-sync-api-umqpitkpoa-uc.a.run.app/api';

      var orderId = _activeOrderIdsByTableRemoteId[tableRemoteId!];
      if (orderId == null) {
        await syncActiveOrders(notify: false);
        orderId = _activeOrderIdsByTableRemoteId[tableRemoteId];
      }

      final itemsPayload = newItems.map(_cloudOrderItemPayload).toList();

      if (orderId == null) {
        final netSubtotal = table.netSubtotal;
        final tax = table.includedTax;
        final response = await http
            .post(
              Uri.parse('$baseUrl/orders'),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({
                'branchId': terminalBranchId,
                'tableId': tableRemoteId,
                'waiterId': currentUserId,
                'subtotal': netSubtotal.toStringAsFixed(2),
                'discount': '0.00',
                'tax': tax.toStringAsFixed(2),
                'total': table.total.toStringAsFixed(2),
                'items': itemsPayload,
              }),
            )
            .timeout(const Duration(seconds: 10));

        if (response.statusCode != 201) {
          debugPrint(
            'Cloud order create failed ${response.statusCode}: ${response.body}',
          );
          return;
        }

        final created = Map<String, dynamic>.from(jsonDecode(response.body));
        orderId = created['id']?.toString();
        if (!_isUuid(orderId)) return;
        _activeOrderIdsByTableRemoteId[tableRemoteId] = orderId!;
      } else {
        final response = await http
            .post(
              Uri.parse('$baseUrl/orders/$orderId/items'),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({'items': itemsPayload}),
            )
            .timeout(const Duration(seconds: 10));

        if (response.statusCode != 200) {
          debugPrint(
            'Cloud order add items failed ${response.statusCode}: ${response.body}',
          );
          return;
        }
      }

      final kitchenResponse = await http
          .post(Uri.parse('$baseUrl/kitchen/orders/$orderId/send'))
          .timeout(const Duration(seconds: 10));
      if (kitchenResponse.statusCode != 200) {
        debugPrint(
          'Cloud kitchen send failed ${kitchenResponse.statusCode}: ${kitchenResponse.body}',
        );
      }
    } catch (e) {
      debugPrint('Cloud open order sync failed: $e');
    }
  }

  Map<String, dynamic> _cloudOrderItemPayload(OrderItem item) => {
    'productId': _productRemoteIdForItem(item),
    'quantity': item.quantity,
    'price': (item.totalPrice / item.quantity).toStringAsFixed(2),
    'assignedGuest': _assignedGuestNumber(item.assignedGuest),
    'notes': [
      if (item.modifiers.isNotEmpty) item.modifiers.join(', '),
      if (item.notes.trim().isNotEmpty) item.notes.trim(),
    ].join(' | '),
  };

  Future<void> _requestCloudBilling(TableModel table) async {
    final tableRemoteId = _remoteIdForTable(table);
    final orderId = tableRemoteId == null
        ? null
        : _activeOrderIdsByTableRemoteId[tableRemoteId];
    if (orderId == null) return;

    try {
      final String baseUrl =
          terminalApiUrl ?? 'https://pos-sync-api-umqpitkpoa-uc.a.run.app/api';
      await http
          .post(Uri.parse('$baseUrl/orders/$orderId/billing'))
          .timeout(const Duration(seconds: 10));
    } catch (e) {
      debugPrint('Cloud billing request failed: $e');
    }
  }

  String _generateOperationNumber(DateTime timestamp) {
    final prefix = ticketFiscalConfig.receiptPrefix.trim().isEmpty
        ? 'CCH'
        : ticketFiscalConfig.receiptPrefix.trim().toUpperCase();
    final stamp =
        '${timestamp.year.toString().padLeft(4, '0')}'
        '${timestamp.month.toString().padLeft(2, '0')}'
        '${timestamp.day.toString().padLeft(2, '0')}-'
        '${timestamp.hour.toString().padLeft(2, '0')}'
        '${timestamp.minute.toString().padLeft(2, '0')}'
        '${timestamp.second.toString().padLeft(2, '0')}';
    return '$prefix-$stamp';
  }

  String _generateFinalCustomerTicket(
    TableModel table, {
    required double discount,
    required String paymentMethod,
    required String refCode,
    required DateTime closedAt,
    double? cashReceived,
    double? cashChange,
  }) {
    final config = ticketFiscalConfig;
    final operationNumber = _generateOperationNumber(closedAt);
    final dateStr = closedAt.toString().substring(0, 16);
    final buffer = StringBuffer();

    buffer.writeln(formatCenter('TICKET DE COMPRA'));
    buffer.write(formatCenterLines(config.sellerDisplayName));
    buffer.write(formatCenterLines(config.legalName));
    buffer.write(formatCenterLines('RFC: ${config.fiscalId}'));
    buffer.write(formatCenterLines(config.branchName));
    buffer.write(formatCenterLines(config.branchAddress));
    if (config.phone != null && config.phone!.trim().isNotEmpty) {
      buffer.write(formatCenterLines('Tel: ${config.phone}'));
    }
    buffer.writeln(formatDivider());
    buffer.writeln(formatRow('Operacion:', operationNumber));
    buffer.writeln(formatRow('Fecha:', dateStr));
    buffer.writeln(formatRow('Mesa:', table.label));
    buffer.writeln(formatRow('Atendio:', currentUserName));
    buffer.writeln(formatDivider());
    buffer.writeln(formatRow('Metodo:', paymentMethod.toUpperCase()));
    if (refCode.isNotEmpty && refCode != 'Efectivo') {
      buffer.writeln(formatRow('Referencia:', refCode));
    }
    buffer.writeln(formatDivider());
    buffer.writeln(formatRow('Cant Descripcion', 'Total'));
    buffer.writeln(formatDivider());

    for (final item in table.items) {
      final line = '${item.quantity}x ${item.item.name}';
      final priceStr = '\$${item.totalPrice.toStringAsFixed(2)}';
      buffer.writeln(formatRow(line, priceStr));
      if (item.modifiers.isNotEmpty) {
        buffer.writeln('   + ${item.modifiers.join(', ')}');
      }
      if (item.notes.isNotEmpty) {
        buffer.writeln('   * ${item.notes}');
      }
    }

    buffer.writeln(formatDivider());
    if (config.taxMode == 'included') {
      buffer.writeln(
        formatRow('Subtotal:', '\$${table.subtotal.toStringAsFixed(2)}'),
      );
      if (discount > 0) {
        buffer.writeln(
          formatRow(
            'Desc (${discount.toInt()}%):',
            '-\$${table.discountAmount.toStringAsFixed(2)}',
          ),
        );
      }
      buffer.write(formatCenterLines('IVA incluido'));
    } else {
      buffer.writeln(
        formatRow(
          'Subtotal neto:',
          '\$${table.netSubtotal.toStringAsFixed(2)}',
        ),
      );
      if (discount > 0) {
        buffer.writeln(
          formatRow(
            'Desc neto (${discount.toInt()}%):',
            '-\$${table.netDiscountAmount.toStringAsFixed(2)}',
          ),
        );
      }
      buffer.writeln(
        formatRow('IVA (16%):', '\$${table.includedTax.toStringAsFixed(2)}'),
      );
    }
    buffer.writeln(formatDivider(char: '='));
    buffer.writeln(
      formatRow('TOTAL PAGADO:', '\$${table.total.toStringAsFixed(2)}'),
    );
    if (paymentMethod.toLowerCase() == 'efectivo' && cashReceived != null) {
      buffer.writeln(
        formatRow('Recibido:', '\$${cashReceived.toStringAsFixed(2)}'),
      );
      buffer.writeln(
        formatRow('Cambio:', '\$${(cashChange ?? 0).toStringAsFixed(2)}'),
      );
    }
    buffer.writeln(formatDivider(char: '='));
    buffer.write(formatCenterLines('Precios con IVA incluido'));
    if (config.footerText != null && config.footerText!.trim().isNotEmpty) {
      buffer.writeln('');
      buffer.write(
        formatCenterLines(_normalizeTicketFooter(config.footerText!)),
      );
    }
    buffer.writeln('');
    buffer.write(formatCenterLines('GRACIAS POR SU COMPRA'));

    return buffer.toString();
  }

  String _normalizeTicketFooter(String footerText) {
    return footerText.trim().replaceAll(
      RegExp(r'\.\s+IVA incluido', caseSensitive: false),
      '.\nIVA incluido',
    );
  }

  // Checkout process
  void checkoutTable(
    int tableId, {
    required double discount,
    required String paymentMethod,
    required String refCode,
    double? cashReceived,
    double? cashChange,
    bool isEqualSplit = false,
    int? splitCount,
    List<int>? itemIndicesToPay,
  }) {
    final index = tables.indexWhere((t) => t.id == tableId);
    if (index != -1) {
      final t = tables[index];
      t.discountPercentage = discount;

      // Determine what is being paid
      double finalTotal;
      TableModel tableSnapshot;

      if (isEqualSplit && splitCount != null && splitCount > 1) {
        // Equal split payment: 1 part of splitCount
        finalTotal = t.total / splitCount;
        
        // Construct a mock TableModel to represent the partial payment on the receipt
        tableSnapshot = t.copyWith(
          label: '${t.label} (División 1/$splitCount)',
          items: [
            OrderItem(
              item: MenuItem(
                id: 'partial_payment',
                name: 'Pago Parcial (1/$splitCount)',
                price: t.subtotal / splitCount,
                category: 'Pago',
              ),
              quantity: 1,
              isSent: true,
            ),
          ],
        );
      } else if (itemIndicesToPay != null && itemIndicesToPay.isNotEmpty) {
        // Split by items: only pay selected items
        final selectedItems = itemIndicesToPay.map((idx) => t.items[idx].copyWith()).toList();
        finalTotal = selectedItems.fold<double>(0.0, (sum, item) => sum + item.totalPrice) * (1 - (discount / 100.0));
        
        tableSnapshot = t.copyWith(
          label: '${t.label} (Parcial)',
          items: selectedItems,
        );
      } else {
        // Full checkout
        finalTotal = t.total;
        tableSnapshot = t.copyWith(
          items: t.items.map((item) => item.copyWith()).toList(),
          discountPercentage: t.discountPercentage,
        );
      }

      final closedAt = DateTime.now();

      // Add to cash drawer if paid in cash
      if (paymentMethod.toLowerCase() == 'efectivo') {
        cashDrawerAmount += finalTotal;
      }

      final printDetails = _generateFinalCustomerTicket(
        tableSnapshot,
        discount: discount,
        paymentMethod: paymentMethod,
        refCode: refCode,
        closedAt: closedAt,
        cashReceived: cashReceived,
        cashChange: cashChange,
      );

      enqueuePrintJob(
        PrintJob(
          id: 'rec_${DateTime.now().millisecondsSinceEpoch}',
          title: 'Ticket - ${tableSnapshot.label}',
          details: printDetails,
          target: 'Caja',
          timestamp: DateTime.now(),
        ),
      );

      _addRecentClosedSale(
        id: 'sale_${DateTime.now().millisecondsSinceEpoch}',
        label: tableSnapshot.label,
        total: finalTotal,
        closedAt: closedAt,
        printDetails: printDetails,
      );

      final cloudOrderId = _activeCloudOrderIdForTable(t);
      if (cloudOrderId != null) {
        unawaited(
          _processCloudOrderPayment(
            cloudOrderId,
            amount: finalTotal,
            paymentMethod: paymentMethod,
            refCode: refCode,
          ),
        );
      } else {
        unawaited(
          _queueClosedSaleForSync(
            tableSnapshot: tableSnapshot,
            paymentMethod: paymentMethod,
            refCode: refCode,
            closedAt: closedAt,
          ),
        );
      }

      // Update the original table state based on what remains:
      if (isEqualSplit && splitCount != null && splitCount > 1) {
        // It's a partial equal split: do not reset the table!
        // Just keep the table open in billing state
        t.state = TableState.billing;
        debugPrint('Processed equal split payment of \$${finalTotal.toStringAsFixed(2)}. Table remains open.');
      } else if (itemIndicesToPay != null && itemIndicesToPay.isNotEmpty) {
        // Split by items: remove paid items from the table!
        // We sort indices in descending order to avoid shift issues during removal
        final sortedIndices = List<int>.from(itemIndicesToPay)..sort((a, b) => b.compareTo(a));
        for (final idx in sortedIndices) {
          t.items.removeAt(idx);
        }

        // If no items are left, close the table!
        if (t.items.isEmpty) {
          t.state = TableState.cleaning;
          t.guests = 0;
          t.discountPercentage = 0;
          debugPrint('All items paid. Closing table ${t.label}.');
        } else {
          // If items are still left, keep it open/billing
          t.state = TableState.billing;
          debugPrint('Split by items payment done. ${t.items.length} items remaining on table ${t.label}.');
        }
      } else {
        // Full checkout: close the table completely
        t.state = TableState.cleaning;
        t.items = [];
        t.guests = 0;
        t.discountPercentage = 0;
        debugPrint('Full checkout completed. Closing table ${t.label}.');
      }

      notifyListeners();
    }
  }

  String? _activeCloudOrderIdForTable(TableModel table) {
    final tableRemoteId = _remoteIdForTable(table);
    if (tableRemoteId == null) return null;
    return _activeOrderIdsByTableRemoteId[tableRemoteId];
  }

  Future<void> _processCloudOrderPayment(
    String orderId, {
    required double amount,
    required String paymentMethod,
    required String refCode,
  }) async {
    try {
      final String baseUrl =
          terminalApiUrl ?? 'https://pos-sync-api-umqpitkpoa-uc.a.run.app/api';
      final response = await http
          .post(
            Uri.parse('$baseUrl/orders/$orderId/payments'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'amount': amount.toStringAsFixed(2),
              'paymentMethod': _normalizePaymentMethod(paymentMethod),
              if (refCode.isNotEmpty && refCode != 'Efectivo')
                'referenceCode': refCode,
            }),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        debugPrint(
          'Cloud order payment failed ${response.statusCode}: ${response.body}',
        );
        return;
      }

      _activeOrderIdsByTableRemoteId.removeWhere((_, id) => id == orderId);

      // Sync table states after successful payment to update other devices
      await syncTableStates(notify: true);
    } catch (e) {
      debugPrint('Cloud order payment request failed: $e');
    }
  }

  Future<TableModel?> createToGoTable() async {
    if (!isTerminalConfigured || terminalBranchId == null) {
      // Local fallback if offline/no configuration
      final int nextId = tables.where((t) => t.zone == 'Para Llevar').length + 1;
      final newTable = TableModel(
        id: 'Llevar #$nextId'.hashCode,
        remoteId: 'local_togo_$nextId',
        label: 'Llevar #$nextId',
        shape: TableShape.circle,
        zone: 'Para Llevar',
        x: 0.5,
        y: 0.5,
        state: TableState.occupied,
        items: const [],
        guests: 1,
        guestGenders: const ['M'],
      );
      tables.add(newTable);
      notifyListeners();
      return newTable;
    }

    try {
      final String baseUrl =
          terminalApiUrl ?? 'https://pos-sync-api-umqpitkpoa-uc.a.run.app/api';
      final String brId = terminalBranchId!;

      // Calculate next index
      final toGoTables = tables.where((t) => t.zone == 'Para Llevar').toList();
      final int nextIndex = toGoTables.length + 1;
      final String label = 'Llevar #$nextIndex';

      final response = await http
          .post(
            Uri.parse('$baseUrl/branches/$brId/tables'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'label': label,
              'capacity': 1,
              'room': 'Para Llevar',
              'shape': 'circle',
              'x': 0.5,
              'y': 0.5,
            }),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 201) {
        final Map<String, dynamic> data = jsonDecode(response.body);
        final String remoteId = data['id'] ?? '';
        final int localId = remoteId.hashCode;

        final newTable = TableModel(
          id: localId,
          remoteId: remoteId,
          label: label,
          shape: TableShape.circle,
          zone: 'Para Llevar',
          x: 0.5,
          y: 0.5,
          state: TableState.occupied,
          items: const [],
          guests: 1,
          guestGenders: const ['M'],
        );

        tables.add(newTable);
        notifyListeners();
        return newTable;
      }
    } catch (e) {
      debugPrint('Error creating To Go table in cloud: $e');
    }
    return null;
  }

  Future<TableModel?> startToGoOrder() async {
    // 1. Look for a free table in 'Para Llevar' zone
    final freeTableIndex = tables.indexWhere((t) => t.zone == 'Para Llevar' && t.state == TableState.free);
    if (freeTableIndex != -1) {
      tables[freeTableIndex].state = TableState.occupied;
      tables[freeTableIndex].items = [];
      tables[freeTableIndex].guests = 1;
      tables[freeTableIndex].guestGenders = ['M'];
      notifyListeners();
      return tables[freeTableIndex];
    }

    // 2. If none are free, create a new one
    return await createToGoTable();
  }

  // Clean table (from cleaning to free)
  void finishCleaning(int tableId) async {
    final index = tables.indexWhere((t) => t.id == tableId);
    if (index == -1) return;

    // Update local state immediately for UI responsiveness
    tables[index].state = TableState.free;
    notifyListeners();

    // Update backend to sync state across devices
    final table = tables[index];
    if (table.remoteId != null &&
        isTerminalConfigured &&
        terminalBranchId != null) {
      try {
        final String baseUrl =
            terminalApiUrl ?? 'https://pos-sync-api-umqpitkpoa-uc.a.run.app/api';
        final response = await http
            .patch(
              Uri.parse(
                  '$baseUrl/branches/$terminalBranchId/tables/${table.remoteId}'),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({'state': 'free'}),
            )
            .timeout(const Duration(seconds: 10));

        if (response.statusCode != 200) {
          debugPrint(
              'Failed to update table state on server: ${response.statusCode}');
        }
      } catch (e) {
        debugPrint('Error updating table state on server: $e');
      }
    }
  }

  // Kitchen Order operations
  void updateKitchenOrderStatus(String orderId, String newStatus) {
    final index = kitchenOrders.indexWhere((o) => o.id == orderId);
    if (index != -1) {
      kitchenOrders[index].status = newStatus;
      unawaited(_updateCloudKitchenTicketStatus(orderId, newStatus));

      if (newStatus == 'ready') {
        // Notification for waiter
        final String notificationText =
            '¡Pedido listo para la ${kitchenOrders[index].tableLabel}!';
        readyNotifications.add(notificationText);

        // Also highlight table as needing service or update list
      }
      notifyListeners();
    }
  }

  Future<void> _updateCloudKitchenTicketStatus(
    String ticketId,
    String status,
  ) async {
    if (!isTerminalConfigured) return;
    try {
      final String baseUrl =
          terminalApiUrl ?? 'https://pos-sync-api-umqpitkpoa-uc.a.run.app/api';
      final response = await http
          .patch(
            Uri.parse('$baseUrl/kitchen/tickets/$ticketId/status'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'status': status}),
          )
          .timeout(const Duration(seconds: 10));
      if (response.statusCode != 200) {
        debugPrint(
          'Kitchen status sync failed ${response.statusCode}: ${response.body}',
        );
      }
    } catch (e) {
      debugPrint('Kitchen status sync request failed: $e');
    }
  }

  void clearNotification(String notification) {
    readyNotifications.remove(notification);
    notifyListeners();
  }

  // Printer Retry logic
  Future<void> retryPrintJob(String jobId) async {
    final index = printJobs.indexWhere((j) => j.id == jobId);
    if (index != -1) {
      final job = printJobs[index];
      job.status = 'queued';
      notifyListeners();

      if (connectedPrinterMac != null && job.target == 'Caja') {
        final success = await _printToPhysicalPrinter(job.details);
        job.status = success ? 'printed' : 'failed';
      } else {
        job.status = 'printed';
      }
      notifyListeners();
    }
  }

  // Platform detection helpers
  static bool get isDesktop {
    if (kIsWeb) return false;
    return Platform.isMacOS || Platform.isWindows || Platform.isLinux;
  }

  static bool get isMobile {
    if (kIsWeb) return false;
    return Platform.isAndroid || Platform.isIOS;
  }

  // Desktop printer connectivity
  Future<bool> connectToDesktopPrinter(String printerName) async {
    if (!isDesktop) return false;

    try {
      connectedPrinterName = printerName;
      connectedPrinterMac = 'desktop'; // Use a marker for desktop printers
      await _secureStorageService.savePrinter('desktop', printerName);
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Error connecting to desktop printer: $e');
      return false;
    }
  }

  // Bluetooth printer connectivity
  Future<bool> connectToPrinter(String mac, String name) async {
    isConnectingPrinter = true;
    notifyListeners();
    if (mac == '00:11:22:33:44:55') {
      connectedPrinterMac = mac;
      connectedPrinterName = name;
      await _secureStorageService.savePrinter(mac, name);
      isConnectingPrinter = false;
      notifyListeners();
      return true;
    }
    try {
      final success = await PrintBluetoothThermal.connect(
        macPrinterAddress: mac,
      );
      if (success) {
        connectedPrinterMac = mac;
        connectedPrinterName = name;
        await _secureStorageService.savePrinter(mac, name);
        isConnectingPrinter = false;
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('Error connecting to printer: $e');
    }
    isConnectingPrinter = false;
    notifyListeners();
    return false;
  }

  Future<void> disconnectPrinter() async {
    // Only try to disconnect Bluetooth if it's not a desktop or simulated printer
    if (connectedPrinterMac != '00:11:22:33:44:55' &&
        connectedPrinterMac != 'desktop' &&
        isMobile) {
      try {
        await PrintBluetoothThermal.disconnect;
      } catch (e) {
        debugPrint('Error disconnecting printer: $e');
      }
    }
    connectedPrinterMac = null;
    connectedPrinterName = null;
    await _secureStorageService.clearSavedPrinter();
    notifyListeners();
  }

  Future<void> _autoConnectPrinter() async {
    try {
      final saved = await _secureStorageService.getSavedPrinter();
      if (saved != null) {
        final mac = saved['mac']!;
        final name = saved['name']!;

        // Simulated printer
        if (mac == '00:11:22:33:44:55') {
          connectedPrinterMac = mac;
          connectedPrinterName = name;
          notifyListeners();
          return;
        }

        // Desktop printer
        if (mac == 'desktop') {
          connectedPrinterMac = mac;
          connectedPrinterName = name;
          notifyListeners();
          return;
        }

        // Mobile Bluetooth printer
        if (isMobile) {
          final success = await PrintBluetoothThermal.connect(
            macPrinterAddress: mac,
          );
          if (success) {
            connectedPrinterMac = mac;
            connectedPrinterName = name;
            notifyListeners();
          }
        }
      }
    } catch (e) {
      debugPrint('Error auto-connecting printer: $e');
    }
  }

  Future<bool> _printToPhysicalPrinter(String details) async {
    if (connectedPrinterMac == null) return false;
    if (connectedPrinterMac == '00:11:22:33:44:55') {
      debugPrint('Simulated Printer Print Job:\n$details');
      return true;
    }

    // Desktop printer (using system printers)
    if (connectedPrinterMac == 'desktop' && connectedPrinterName != null) {
      return await _printToDesktopPrinter(details);
    }

    // Mobile Bluetooth printer
    try {
      final isConnected = await PrintBluetoothThermal.connectionStatus;
      if (!isConnected) {
        final reconnected = await PrintBluetoothThermal.connect(
          macPrinterAddress: connectedPrinterMac!,
        );
        if (!reconnected) return false;
      }
      final bytes = latin1.encode('$details\n\n\n\n').toList();
      return await PrintBluetoothThermal.writeBytes(bytes);
    } catch (e) {
      debugPrint('Error printing to physical printer: $e');
      return false;
    }
  }

  Future<bool> _printToDesktopPrinter(String details) async {
    if (connectedPrinterName == null) return false;

    try {
      final pdf = pw.Document();

      // Create a simple text-based receipt using monospace font
      pdf.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.roll80,
          build: (context) {
            return pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  details,
                  style: pw.TextStyle(
                    font: pw.Font.courier(),
                    fontSize: 10,
                  ),
                ),
              ],
            );
          },
        ),
      );

      // Print to the selected printer
      await Printing.directPrintPdf(
        printer: Printer(
          url: connectedPrinterName!,
          name: connectedPrinterName!,
        ),
        onLayout: (format) async => pdf.save(),
      );

      debugPrint('Successfully printed to desktop printer: $connectedPrinterName');
      return true;
    } catch (e) {
      debugPrint('Error printing to desktop printer: $e');
      return false;
    }
  }

  Future<void> enqueuePrintJob(
    PrintJob job, {
    bool forcePhysical = false,
  }) async {
    printJobs.add(job);
    notifyListeners();

    if (connectedPrinterMac != null &&
        (job.target == 'Caja' || forcePhysical)) {
      job.status = 'queued';
      notifyListeners();
      final success = await _printToPhysicalPrinter(job.details);
      job.status = success ? 'printed' : 'failed';
    } else {
      job.status = isOnline ? 'printed' : 'failed';
    }
    notifyListeners();
  }

  Future<void> _loadRecentClosedSales() async {
    try {
      final sales = await _secureStorageService.getRecentClosedSales();
      recentClosedSales = sales;
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading recent closed sales: $e');
    }
  }

  void _addRecentClosedSale({
    required String id,
    required String label,
    required double total,
    required DateTime closedAt,
    required String printDetails,
  }) {
    recentClosedSales.insert(0, {
      'id': id,
      'label': label,
      'total': total,
      'closedAt': closedAt.toIso8601String(),
      'printDetails': printDetails,
    });
    if (recentClosedSales.length > 30) {
      recentClosedSales = recentClosedSales.sublist(0, 30);
    }
    _secureStorageService.saveRecentClosedSales(recentClosedSales);
    notifyListeners();
  }

  Future<void> _loadPendingSaleSyncJobs() async {
    try {
      final jobs = await _secureStorageService.getPendingSaleSyncJobs();
      _pendingSaleSyncJobs
        ..clear()
        ..addAll(jobs);
      pendingSyncCount = _pendingSaleSyncJobs.length;
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading pending sale sync jobs: $e');
    }
  }

  Future<void> _persistPendingSaleSyncJobs() async {
    pendingSyncCount = _pendingSaleSyncJobs.length;
    await _secureStorageService.savePendingSaleSyncJobs(_pendingSaleSyncJobs);
    notifyListeners();
  }

  Future<void> _queueAndSyncSaleJob(Map<String, dynamic> job) async {
    await _syncPendingSaleJobs();
    _pendingSaleSyncJobs.add(job);
    await _persistPendingSaleSyncJobs();
    await _syncPendingSaleJobs();
  }

  Future<void> _queueClosedSaleForSync({
    required TableModel tableSnapshot,
    required String paymentMethod,
    required String refCode,
    required DateTime closedAt,
  }) async {
    await _syncPendingSaleJobs();

    if (!isTerminalConfigured) {
      await loadTerminalConfig();
    }
    if (currentUserId == null && isTerminalConfigured) {
      await syncOperators();
    }
    if (!_isUuid(_remoteIdForTable(tableSnapshot)) && isTerminalConfigured) {
      await fetchTablesDynamic();
    }
    if (tableSnapshot.items.any(
          (item) => !_isUuid(_productRemoteIdForItem(item)),
        ) &&
        isTerminalConfigured) {
      await fetchMenuDynamic();
    }

    final saleSyncJob = _buildClosedSaleSyncJob(
      table: tableSnapshot,
      paymentMethod: paymentMethod,
      refCode: refCode,
      closedAt: closedAt,
    );

    if (saleSyncJob == null) {
      debugPrint(
        'Closed sale was not queued for cloud sync. Check terminal config, operator sync, table sync, and product sync.',
      );
      return;
    }

    await _queueAndSyncSaleJob(saleSyncJob);
  }

  Map<String, dynamic>? _buildClosedSaleSyncJob({
    required TableModel table,
    required String paymentMethod,
    required String refCode,
    required DateTime closedAt,
  }) {
    final branchId = terminalBranchId;
    final tableRemoteId = _remoteIdForTable(table);
    final waiterId = currentUserId;

    final missingIds = <String>[
      if (!_isUuid(branchId)) 'branchId=$branchId',
      if (!_isUuid(tableRemoteId)) 'tableId=$tableRemoteId (${table.label})',
      if (!_isUuid(waiterId))
        'userId=$waiterId ($currentUserName/$currentUserRole)',
    ];

    if (missingIds.isNotEmpty) {
      debugPrint(
        'Sale sync skipped: missing cloud IDs: ${missingIds.join(', ')}.',
      );
      return null;
    }

    final missingProducts = table.items
        .where((item) => !_isUuid(_productRemoteIdForItem(item)))
        .map((item) => '${item.item.name}=${item.item.id}')
        .toList();

    if (missingProducts.isNotEmpty) {
      debugPrint(
        'Sale sync skipped: products without cloud UUIDs: ${missingProducts.join(', ')}.',
      );
      return null;
    }

    final orderId = _newUuid();
    final paymentId = _newUuid();
    final timestamp = closedAt.toUtc().toIso8601String();
    final subtotal = table.netSubtotal;
    final discountAmount = table.netDiscountAmount;
    final tax = table.includedTax;
    final total = table.total;

    return {
      'id': orderId,
      'payload': {
        'orders': [
          {
            'id': orderId,
            'branchId': branchId,
            'tableId': tableRemoteId,
            'waiterId': waiterId,
            'state': 'closed',
            'subtotal': subtotal.toStringAsFixed(2),
            'discount': discountAmount.toStringAsFixed(2),
            'tax': tax.toStringAsFixed(2),
            'total': total.toStringAsFixed(2),
            'createdAt': timestamp,
            'updatedAt': timestamp,
            'version': 1,
          },
        ],
        'orderItems': table.items.map((item) {
          final productId = _productRemoteIdForItem(item);
          return {
            'id': _newUuid(),
            'orderId': orderId,
            'productId': productId,
            'quantity': item.quantity,
            'price': item.item.price.toStringAsFixed(2),
            'assignedGuest': _assignedGuestNumber(item.assignedGuest),
            'isSent': true,
            'notes': item.notes.isEmpty ? null : item.notes,
            'createdAt': timestamp,
            'updatedAt': timestamp,
            'version': 1,
          };
        }).toList(),
        'payments': [
          {
            'id': paymentId,
            'orderId': orderId,
            'amount': total.toStringAsFixed(2),
            'paymentMethod': _normalizePaymentMethod(paymentMethod),
            'referenceCode': refCode.isEmpty || refCode == 'Efectivo'
                ? null
                : refCode,
            'createdAt': timestamp,
          },
        ],
      },
    };
  }

  Future<bool> _syncPendingSaleJobs() async {
    if (_pendingSaleSyncJobs.isEmpty) {
      pendingSyncCount = 0;
      return true;
    }

    if (!isTerminalConfigured) {
      return false;
    }

    final remaining = <Map<String, dynamic>>[];
    for (final job in List<Map<String, dynamic>>.from(_pendingSaleSyncJobs)) {
      final payload = job['payload'];
      if (payload is! Map<String, dynamic>) {
        continue;
      }

      final pushed = await _pushSyncPayload(payload);
      if (!pushed) {
        remaining.add(job);
      }
    }

    _pendingSaleSyncJobs
      ..clear()
      ..addAll(remaining);
    await _persistPendingSaleSyncJobs();
    return _pendingSaleSyncJobs.isEmpty;
  }

  Future<bool> _pushSyncPayload(Map<String, dynamic> payload) async {
    final baseUrl =
        terminalApiUrl ?? 'https://pos-sync-api-umqpitkpoa-uc.a.run.app/api';
    try {
      final response = await http
          .post(
            Uri.parse('$baseUrl/sync/push'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 8));

      final success = response.statusCode >= 200 && response.statusCode < 300;
      isOnline = success;
      if (!success) {
        debugPrint('Sale sync failed ${response.statusCode}: ${response.body}');
      }
      return success;
    } catch (e) {
      isOnline = false;
      debugPrint('Sale sync request failed: $e');
      return false;
    } finally {
      notifyListeners();
    }
  }

  // Sync operations manually triggered
  Future<bool> syncOfflineTransactions() async {
    return _syncPendingSaleJobs();
  }

  String _normalizePaymentMethod(String paymentMethod) {
    final normalized = paymentMethod.toLowerCase();
    if (normalized == 'tarjeta' || normalized == 'card') return 'card';
    return 'cash';
  }

  void _hydrateCurrentUserIdFromOperators(List<dynamic> operators) {
    String? onlyRoleMatchId;
    var roleMatches = 0;

    for (final operator in operators) {
      if (operator is! Map<String, dynamic>) continue;
      final name = operator['name']?.toString();
      final role = operator['role']?.toString();
      final id = operator['id']?.toString();
      if (role == null || _parseRole(role) != currentUserRole || !_isUuid(id)) {
        continue;
      }

      roleMatches++;
      onlyRoleMatchId = id;

      final normalizedOperatorName = _normalizeName(name);
      final normalizedCurrentName = _normalizeName(currentUserName);
      if (normalizedCurrentName.isNotEmpty &&
          (normalizedOperatorName == normalizedCurrentName ||
              normalizedOperatorName.contains(normalizedCurrentName) ||
              normalizedCurrentName.contains(normalizedOperatorName))) {
        currentUserId = id;
        debugPrint('Resolved operator cloud ID by name: $currentUserName');
        notifyListeners();
        return;
      }
    }

    if (currentUserId == null && roleMatches == 1) {
      currentUserId = onlyRoleMatchId;
      debugPrint(
        'Resolved operator cloud ID by unique role match: $currentUserRole',
      );
      notifyListeners();
    }
  }

  String _normalizeName(String? value) {
    return (value ?? '')
        .toLowerCase()
        .replaceAll(RegExp(r'\([^)]*\)'), '')
        .replaceAll(RegExp(r'[^a-z0-9áéíóúüñ]+'), ' ')
        .trim();
  }

  String? _remoteIdForTable(TableModel table) {
    if (_isUuid(table.remoteId)) return table.remoteId;
    for (final candidate in tables) {
      if ((candidate.id == table.id || candidate.label == table.label) &&
          _isUuid(candidate.remoteId)) {
        return candidate.remoteId;
      }
    }
    return table.remoteId;
  }

  String? _productRemoteIdForItem(OrderItem item) {
    if (_isUuid(item.item.id)) return item.item.id;
    for (final candidate in menu) {
      if (candidate.name == item.item.name && _isUuid(candidate.id)) {
        return candidate.id;
      }
    }
    return item.item.id;
  }

  int _assignedGuestNumber(String? assignedGuest) {
    if (assignedGuest == null || assignedGuest.isEmpty) return 1;
    final cleaned = assignedGuest.startsWith('P')
        ? assignedGuest.substring(1)
        : assignedGuest;
    return int.tryParse(cleaned) ?? 1;
  }

  bool _isUuid(String? value) {
    if (value == null) return false;
    return RegExp(
      r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    ).hasMatch(value);
  }

  String _newUuid() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }

  // Format helpers for 58mm thermal printer (32 columns max)
  String formatCenter(String text, {int width = 32}) {
    if (text.length >= width) return text.substring(0, width);
    final leftPadding = (width - text.length) ~/ 2;
    final rightPadding = width - text.length - leftPadding;
    return ' ' * leftPadding + text + ' ' * rightPadding;
  }

  String formatCenterLines(String text, {int width = 32}) {
    return '${_wrapText(text, width).map((line) => formatCenter(line, width: width)).join('\n')}\n';
  }

  String formatRow(String left, String right, {int width = 32}) {
    if (left.length + right.length >= width) {
      final allowedLeftWidth = width - right.length - 1;
      if (allowedLeftWidth > 0) {
        left = left.substring(0, allowedLeftWidth);
      } else {
        return right.substring(0, min(right.length, width));
      }
    }
    final padding = width - left.length - right.length;
    return left + ' ' * padding + right;
  }

  String formatDivider({String char = '-', int width = 32}) {
    return char * width;
  }

  List<String> _wrapText(String text, int width) {
    final lines = <String>[];
    for (final rawLine in text.split('\n')) {
      final words = rawLine.trim().split(RegExp(r'\s+'));
      var current = '';
      for (final word in words.where((word) => word.isNotEmpty)) {
        if (word.length > width) {
          if (current.isNotEmpty) {
            lines.add(current);
            current = '';
          }
          for (var i = 0; i < word.length; i += width) {
            lines.add(word.substring(i, min(i + width, word.length)));
          }
          continue;
        }

        final candidate = current.isEmpty ? word : '$current $word';
        if (candidate.length <= width) {
          current = candidate;
        } else {
          lines.add(current);
          current = word;
        }
      }
      if (current.isNotEmpty) {
        lines.add(current);
      }
    }
    return lines.isEmpty ? [''] : lines;
  }
}
