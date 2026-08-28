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
import 'package:package_info_plus/package_info_plus.dart';
import '../../services/secure_storage_service.dart';
import '../../models/local_requisition.dart';
import 'sync_socket_service.dart';

enum TableState { free, occupied, billing, cleaning }

enum TableShape { circle, square }

enum UserRole { waiter, cashier, kitchen, encargado, responsable, none }

const double ivaRate = 0.16;
const double ivaFactor = 1 + ivaRate;

const String defaultProductionApiUrl =
    'https://pos-sync-api-232144991863.us-central1.run.app/api';
const String configuredDefaultApiUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: defaultProductionApiUrl,
);

// Model for tracking individual partial payments
class PartialPayment {
  final double amount;
  final String paymentMethod;
  final String refCode;
  final DateTime timestamp;
  final String description; // e.g., "Pago 1 de 3" or "Artículos: Café, Pan"

  PartialPayment({
    required this.amount,
    required this.paymentMethod,
    required this.refCode,
    required this.timestamp,
    required this.description,
  });
}

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
  List<PartialPayment>
      partialPayments; // Track partial payments for final ticket

  // Payment session state (persists across widget rebuilds)
  String? activePaymentType; // 'simple', 'equalSplit', 'byItems'
  int paymentsMadeInSession; // Number of partial payments made
  int? originalSplitCountInSession; // Original split count (for equal split)

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
    this.partialPayments = const [],
    this.activePaymentType,
    this.paymentsMadeInSession = 0,
    this.originalSplitCountInSession,
  });

  double get subtotal => double.parse(items
      .fold<double>(0.0,
          (sum, item) => sum + double.parse(item.totalPrice.toStringAsFixed(2)))
      .toStringAsFixed(2));
  double get discountAmount => double.parse(
      (subtotal * (discountPercentage / 100.0)).toStringAsFixed(2));
  double get total =>
      double.parse((subtotal - discountAmount).toStringAsFixed(2));
  double get netSubtotal =>
      double.parse((subtotal / ivaFactor).toStringAsFixed(2));
  double get netTotal => double.parse((total / ivaFactor).toStringAsFixed(2));
  double get netDiscountAmount =>
      double.parse((netSubtotal - netTotal).toStringAsFixed(2));
  double get includedTax => double.parse((total - netTotal).toStringAsFixed(2));

  TableModel copyWith({
    String? label,
    TableState? state,
    List<OrderItem>? items,
    int? guests,
    double? discountPercentage,
    List<String>? guestGenders,
    List<PartialPayment>? partialPayments,
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
      partialPayments: partialPayments ?? List.from(this.partialPayments),
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
  String? remoteId;
  String? clientUuid;
  String syncState; // 'synced', 'pending', 'failed'

  OrderItem({
    required this.item,
    this.quantity = 1,
    this.modifiers = const [],
    this.notes = '',
    this.assignedGuest,
    this.isSent = false,
    this.remoteId,
    this.clientUuid,
    this.syncState = 'synced',
  });

  double get totalPrice => double.parse(
      ((item.price + (modifiers.length * 1.5)) * quantity).toStringAsFixed(2));
  double get netTotalPrice =>
      double.parse((totalPrice / ivaFactor).toStringAsFixed(2));

  OrderItem copyWith({
    int? quantity,
    List<String>? modifiers,
    String? notes,
    String? assignedGuest,
    bool? isSent,
    String? remoteId,
    String? clientUuid,
    String? syncState,
  }) {
    return OrderItem(
      item: item,
      quantity: quantity ?? this.quantity,
      modifiers: modifiers ?? List.from(this.modifiers),
      notes: notes ?? this.notes,
      assignedGuest: assignedGuest ?? this.assignedGuest,
      isSent: isSent ?? this.isSent,
      remoteId: remoteId ?? this.remoteId,
      clientUuid: clientUuid ?? this.clientUuid,
      syncState: syncState ?? this.syncState,
    );
  }

  Map<String, dynamic> toSyncJson() => {
        'item': {
          'id': item.id,
          'name': item.name,
          'price': item.price,
          'category': item.category,
          'imagePath': item.imagePath,
          'modifierGroups': item.modifierGroups,
        },
        'quantity': quantity,
        'modifiers': modifiers,
        'notes': notes,
        'assignedGuest': assignedGuest,
        'isSent': isSent,
        'remoteId': remoteId,
        'clientUuid': clientUuid,
        'syncState': syncState,
      };

  factory OrderItem.fromSyncJson(Map<String, dynamic> json) {
    final rawItem = json['item'];
    final itemMap = rawItem is Map
        ? Map<String, dynamic>.from(rawItem)
        : <String, dynamic>{};
    final rawModifierGroups = itemMap['modifierGroups'];
    final rawModifiers = json['modifiers'];
    return OrderItem(
      item: MenuItem(
        id: itemMap['id']?.toString() ?? '',
        name: itemMap['name']?.toString() ?? '',
        price: (itemMap['price'] as num?)?.toDouble() ??
            double.tryParse(itemMap['price']?.toString() ?? '') ??
            0.0,
        category: itemMap['category']?.toString() ?? '',
        imagePath: itemMap['imagePath']?.toString() ?? '',
        modifierGroups: rawModifierGroups is List
            ? rawModifierGroups.map((value) => value.toString()).toList()
            : const [],
      ),
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      modifiers: rawModifiers is List
          ? rawModifiers.map((value) => value.toString()).toList()
          : const [],
      notes: json['notes']?.toString() ?? '',
      assignedGuest: json['assignedGuest']?.toString(),
      isSent: json['isSent'] == true,
      remoteId: json['remoteId']?.toString(),
      clientUuid: json['clientUuid']?.toString(),
      syncState: json['syncState']?.toString() ?? 'pending',
    );
  }
}

class KitchenOrder {
  final String id;
  final String tableLabel;
  final List<OrderItem> items;
  final DateTime timestamp;
  String status; // 'pending', 'preparing', 'ready', 'served'
  final String station; // 'cocina', 'barra'

  KitchenOrder({
    required this.id,
    required this.tableLabel,
    required this.items,
    required this.timestamp,
    this.status = 'pending',
    this.station = 'cocina',
  });

  Map<String, dynamic> toSyncJson() => {
        'id': id,
        'tableLabel': tableLabel,
        'items': items.map((item) => item.toSyncJson()).toList(),
        'timestamp': timestamp.toIso8601String(),
        'status': status,
        'station': station,
      };

  factory KitchenOrder.fromSyncJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    return KitchenOrder(
      id: json['id']?.toString() ?? '',
      tableLabel: json['tableLabel']?.toString() ?? 'Mesa',
      items: rawItems is List
          ? rawItems
              .whereType<Map>()
              .map((item) => OrderItem.fromSyncJson(
                    Map<String, dynamic>.from(item),
                  ))
              .toList()
          : const [],
      timestamp: DateTime.tryParse(json['timestamp']?.toString() ?? '') ??
          DateTime.now(),
      status: json['status']?.toString() ?? 'ready',
      station: json['station']?.toString() ?? 'cocina',
    );
  }
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

enum ComandaPrintMode { none, auto, local, remoteStation }

class ComandaPrintSelection {
  final ComandaPrintMode mode;
  final String? stationId;

  const ComandaPrintSelection({
    required this.mode,
    this.stationId,
  });

  static const none = ComandaPrintSelection(mode: ComandaPrintMode.none);
  static const auto = ComandaPrintSelection(mode: ComandaPrintMode.auto);
  static const local = ComandaPrintSelection(mode: ComandaPrintMode.local);
}

class PrintStation {
  final String stationId;
  final String deviceName;
  final String? operatorId;
  final String? operatorName;
  final String printerName;
  final UserRole role;
  final DateTime lastSeenAt;
  final bool canPrintComandas;
  final bool online;
  final bool recentlySeen;
  final String presenceStatus;
  final int? lastSeenSecondsAgo;

  String get displayName => operatorName != null && operatorName!.isNotEmpty
      ? '$deviceName ($operatorName)'
      : deviceName;

  const PrintStation({
    required this.stationId,
    required this.deviceName,
    this.operatorId,
    this.operatorName,
    required this.printerName,
    required this.role,
    required this.lastSeenAt,
    required this.canPrintComandas,
    required this.online,
    required this.recentlySeen,
    required this.presenceStatus,
    this.lastSeenSecondsAgo,
  });

  factory PrintStation.fromJson(Map<String, dynamic> json) {
    final lastSeenAt =
        DateTime.tryParse(json['lastSeenAt']?.toString() ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
    final rawOnline = json['online'];
    final secondsAgo = DateTime.now().difference(lastSeenAt).inSeconds;
    final inferredOnline = secondsAgo < 120;
    final inferredRecent = secondsAgo < 24 * 60 * 60;
    final rawRecentlySeen = json['recentlySeen'];
    final rawLastSeenSecondsAgo = json['lastSeenSecondsAgo'];
    final online = rawOnline is bool ? rawOnline : inferredOnline;
    final recentlySeen =
        rawRecentlySeen is bool ? rawRecentlySeen : inferredRecent;
    return PrintStation(
      stationId: json['stationId']?.toString() ?? json['id']?.toString() ?? '',
      deviceName: json['deviceName']?.toString() ?? 'Caja',
      operatorId: json['operatorId']?.toString(),
      operatorName: json['operatorName']?.toString(),
      printerName: json['printerName']?.toString() ?? '',
      role: _roleFromJson(json['role']?.toString()),
      lastSeenAt: lastSeenAt,
      canPrintComandas: json['canPrintComandas'] != false,
      online: online,
      recentlySeen: recentlySeen,
      presenceStatus: json['presenceStatus']?.toString() ??
          (online
              ? 'online'
              : recentlySeen
                  ? 'recent'
                  : 'offline'),
      lastSeenSecondsAgo: rawLastSeenSecondsAgo is num
          ? rawLastSeenSecondsAgo.round()
          : secondsAgo,
    );
  }

  Map<String, dynamic> toJson({
    required String branchId,
  }) =>
      {
        'stationId': stationId,
        'branchId': branchId,
        'deviceName': deviceName,
        'role': role.name,
        'operatorId': operatorId,
        'operatorName': operatorName,
        'printerName': printerName,
        'canPrintComandas': canPrintComandas,
        'lastSeenAt': lastSeenAt.toUtc().toIso8601String(),
      };

  String get presenceLabel {
    final seconds = lastSeenSecondsAgo;
    if (online) return 'ONLINE';
    if (seconds == null || seconds < 0) return 'OFFLINE';
    if (seconds < 60) return 'visto hace ${seconds}s';
    final minutes = seconds ~/ 60;
    if (minutes < 60) return 'visto hace ${minutes}m';
    final hours = minutes ~/ 60;
    if (hours < 24) return 'visto hace ${hours}h';
    final days = hours ~/ 24;
    return 'visto hace ${days}d';
  }

  static UserRole _roleFromJson(String? role) {
    switch ((role ?? '').toLowerCase()) {
      case 'cashier':
        return UserRole.cashier;
      case 'encargado':
        return UserRole.encargado;
      case 'responsable':
        return UserRole.responsable;
      case 'waiter':
        return UserRole.waiter;
      case 'kitchen':
        return UserRole.kitchen;
      default:
        return UserRole.none;
    }
  }
}

class RemotePrintJob {
  final String id;
  final String targetStationId;
  final String title;
  final String details;
  final String target;
  final String status;

  const RemotePrintJob({
    required this.id,
    required this.targetStationId,
    required this.title,
    required this.details,
    required this.target,
    required this.status,
  });

  factory RemotePrintJob.fromJson(Map<String, dynamic> json) {
    return RemotePrintJob(
      id: json['id']?.toString() ?? '',
      targetStationId: json['targetStationId']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Impresion remota',
      details: json['details']?.toString() ?? '',
      target: json['target']?.toString() ?? 'Caja',
      status: json['status']?.toString() ?? 'queued',
    );
  }
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
      branchName:
          branchName?.isNotEmpty == true ? branchName! : 'Sucursal Demo',
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
      branchAddress: json['branchAddress']?.toString() ??
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
  List<UserRole> availableUserRoles = const [];
  String? currentUserId;
  String currentUserName = "";

  // Tables state
  List<TableModel> tables = [];

  // Kitchen orders
  List<KitchenOrder> kitchenOrders = [];
  List<KitchenOrder> readyPickupOrders = [];

  // Printer Queue
  List<PrintJob> printJobs = [];

  // Recent closed sales history
  List<Map<String, dynamic>> recentClosedSales = [];

  bool isShiftOpen = false;
  double cashDrawerAmount = 0.0;
  double initialFloat = 0.0;
  String? activeShiftId;

  // Offline & sync states
  bool isOnline = true;
  SyncSocketService? _socketService;
  SocketConnectionState socketConnectionState =
      SocketConnectionState.disconnected;
  String? currentJwtToken;
  Timer? _fallbackPollingTimer;
  int pendingSyncCount = 0;
  final List<Map<String, dynamic>> _pendingSaleSyncJobs = [];
  final List<Map<String, dynamic>> _pendingOrderSyncJobs = [];
  final Map<String, String> _activeOrderIdsByTableRemoteId = {};
  final Map<String, String> _locallyClosedPaidOrderIdsByTableRemoteId = {};
  final Set<String> _pendingKitchenStatusUpdates = {};
  final Set<String> _alertedReadyPickupIds = {};
  Timer? _kitchenSyncRetryTimer;
  int _kitchenSyncRetryCount = 0;
  Timer? _printStationHeartbeatTimer;
  Timer? _remotePrintPollingTimer;
  final Set<String> _remotePrintJobsInFlight = {};

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
  String? lastSyncError;
  Map<String, Map<String, dynamic>> roomConfigs = {};
  TicketFiscalConfig ticketFiscalConfig = TicketFiscalConfig.defaults();

  List<Map<String, dynamic>> cachedIngredients = [];
  List<Map<String, dynamic>> cachedWarehouses = [];

  // Bluetooth printer connection state
  String? connectedPrinterMac;
  String? connectedPrinterName;
  String printerPaperWidth = '58mm'; // '58mm' (26 cols), '80mm' (40 cols)

  int get ticketWidth {
    if (printerPaperWidth == '80mm') return 40;
    return 26; // 58mm uses 26 cols
  }

  Future<void> setPrinterPaperWidth(String paperWidth) async {
    if (paperWidth == '80mm') {
      printerPaperWidth = '80mm';
    } else {
      printerPaperWidth = '58mm';
    }
    await _secureStorageService.savePrinterPaperWidth(printerPaperWidth);
    notifyListeners();
  }

  bool isConnectingPrinter = false;
  Future<void>? initializationFuture;
  String? localStationId;
  String? deviceId;
  List<PrintStation> onlinePrintStations = [];
  String? lastSelectedPrintStationId;
  bool receiveRemotePrintJobs = false;
  DateTime? lastPrintStationPublishAttemptAt;
  bool? lastPrintStationPublishSucceeded;
  String? lastPrintStationPublishMessage;
  String appVersion = 'v1.0.1+3';

  final SecureStorageService _secureStorageService;
  SecureStorageService get secureStorageService => _secureStorageService;

  AppState({SecureStorageService? secureStorageService})
      : _secureStorageService = secureStorageService ?? SecureStorageService() {
    _initMockData();
    initializationFuture = () async {
      try {
        final packageInfo = await PackageInfo.fromPlatform();
        appVersion = 'v${packageInfo.version}+${packageInfo.buildNumber}';
      } catch (e) {
        debugPrint('Error getting PackageInfo: $e');
      }
      localStationId = await _secureStorageService.getOrCreateLocalStationId();
      deviceId = await _secureStorageService.getOrCreateDeviceId();
      lastSelectedPrintStationId =
          await _secureStorageService.getLastPrintStationId();
      receiveRemotePrintJobs =
          await _secureStorageService.getReceiveRemotePrintJobs();
      await loadTerminalConfig();
      await loadTicketFiscalConfig();
      await _loadRecentClosedSales();
      await _loadReadyPickupOrders();
      cachedIngredients = await _secureStorageService.getCachedIngredients();
      cachedWarehouses = await _secureStorageService.getCachedWarehouses();
      await _loadPendingOrderSyncJobs();
      if (isTerminalConfigured) {
        await _loadPendingSaleSyncJobs();
        await syncOperators();
        await syncTicketSettings();
        await fetchMenuDynamic();
        await syncWarehouses();
        await fetchTablesDynamic();
      } else {
        await _loadPendingSaleSyncJobs();
        await loadTablesFromJson();
      }
      await _autoConnectPrinter();
      _refreshPrintStationLifecycle();
    }();
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

        // Auto-migrate old Cloud Run API URLs to the secure VM API subdomain
        if (terminalApiUrl != null &&
            terminalApiUrl!.contains('umqpitkpoa-uc.a.run.app')) {
          terminalApiUrl =
              configuredDefaultApiUrl;
          await _secureStorageService.saveTerminalConfig(
            businessId: terminalBusinessId ?? '',
            branchId: terminalBranchId ?? '',
            businessName: terminalBusinessName ?? '',
            branchName: terminalBranchName ?? '',
            apiUrl: terminalApiUrl!,
          );
          debugPrint('Migrated terminal config API URL to: $terminalApiUrl');
        }

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
    await syncWarehouses();
    await syncTicketSettings();
    await syncOperators();
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
      String baseUrl =
          configuredDefaultApiUrl;

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
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
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
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
      final String? bId = terminalBusinessId;
      if (bId == null || bId.isEmpty) {
        debugPrint('SyncOperators skipped: missing terminal businessId.');
        return false;
      }
      final String brId = terminalBranchId ?? '';

      final url = '$baseUrl/auth/operators?businessId=$bId&branchId=$brId';
      debugPrint('Syncing operators from: $url');
      final response =
          await http.get(Uri.parse(url)).timeout(const Duration(seconds: 10));

      debugPrint('SyncOperators response status: ${response.statusCode}');
      if (response.statusCode == 200) {
        final List<dynamic> operators = jsonDecode(response.body);
        debugPrint('SyncOperators loaded ${operators.length} operators.');
        if (operators.isNotEmpty) {
          await _secureStorageService.cacheOperatorsOffline(
            operators,
            businessId: bId,
            branchId: brId.isEmpty ? null : brId,
          );
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
        await syncWarehouses();
      } catch (e) {
        debugPrint(
            'syncAllData: fetchMenuDynamic/syncWarehouses failed with error: $e');
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
        await syncTableStates();
        await checkActiveShift();
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
      final jsonString = await rootBundle
          .loadString(
            'assets/floor_plan_mesa.json',
          )
          .timeout(const Duration(seconds: 1), onTimeout: () => '[]');
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

        final TableShape shape =
            shapeStr == 'circle' ? TableShape.circle : TableShape.square;

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
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
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
            final String normLabel =
                (ref['label'] as String).trim().toLowerCase();
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
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
      final bool isLocalConfig = baseUrl.contains('localhost') ||
          baseUrl.contains('10.0.2.2') ||
          baseUrl.contains('127.0.0.1');

      http.Response catResponse;
      http.Response prodResponse;
      final String? bId = terminalBusinessId;
      if (bId == null || bId.isEmpty) {
        debugPrint('fetchMenuDynamic skipped: missing terminal businessId.');
        return;
      }

      try {
        catResponse = await http
            .get(Uri.parse('$baseUrl/categories?businessId=$bId'))
            .timeout(const Duration(seconds: 10));
        final String? brId = terminalBranchId;
        final String productsUrl = (brId != null && brId.isNotEmpty)
            ? '$baseUrl/products?businessId=$bId&branchId=$brId'
            : '$baseUrl/products?businessId=$bId';
        prodResponse = await http
            .get(Uri.parse(productsUrl))
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
          if (prod['isSellable'] == true && prod['isActive'] != false) {
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

        final List<Map<String, dynamic>> ingredients = [];
        for (var prod in prodData) {
          if (prod['isIngredient'] == true && prod['isActive'] != false) {
            ingredients.add({
              'id': prod['id'],
              'name': prod['name'],
              'sku': prod['sku'] ?? '',
            });
          }
        }
        cachedIngredients = ingredients;
        await _secureStorageService.saveCachedIngredients(ingredients);

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

  Future<bool> syncWarehouses() async {
    if (!isTerminalConfigured) return false;
    try {
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
      final String? bId = terminalBusinessId;
      if (bId == null || bId.isEmpty) {
        debugPrint('syncWarehouses skipped: missing terminal businessId.');
        return false;
      }
      final response = await http
          .get(Uri.parse('$baseUrl/warehouses?businessId=$bId'))
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        final List<Map<String, dynamic>> list = data
            .map((item) => {
                  'id': item['id'],
                  'name': item['name'],
                })
            .toList();
        cachedWarehouses = list;
        await _secureStorageService.saveCachedWarehouses(list);
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('Error syncing warehouses: $e');
    }
    return false;
  }

  Future<bool> syncActiveOrders({bool notify = true}) async {
    if (!isTerminalConfigured || terminalBranchId == null) return false;

    try {
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
      final response = await http
          .get(Uri.parse('$baseUrl/orders/active?branchId=$terminalBranchId'))
          .timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        debugPrint('syncActiveOrders status error: ${response.statusCode}');
        return false;
      }

      final List<dynamic> activeOrders = jsonDecode(response.body);

      // Check if there are active orders for tables not currently in local memory
      bool hasUnknownTables = false;
      for (final rawOrder in activeOrders) {
        final order = Map<String, dynamic>.from(rawOrder);
        final tableId = order['tableId']?.toString();
        if (_isUuid(tableId)) {
          final exists = tables.any((t) => t.remoteId == tableId);
          if (!exists) {
            hasUnknownTables = true;
            break;
          }
        }
      }

      if (hasUnknownTables) {
        debugPrint(
            'syncActiveOrders: Found unknown tables in active orders list. Fetching dynamic tables...');
        await fetchTablesDynamic();
      }

      final activeTableIds = <String>{};

      for (final rawOrder in activeOrders) {
        final order = Map<String, dynamic>.from(rawOrder);
        final tableId = order['tableId']?.toString();
        final orderId = order['id']?.toString();
        if (!_isUuid(tableId) || !_isUuid(orderId)) continue;

        final locallyClosedOrderId =
            _locallyClosedPaidOrderIdsByTableRemoteId[tableId];
        if (locallyClosedOrderId == orderId) {
          activeTableIds.add(tableId!);
          continue;
        }
        if (locallyClosedOrderId != null && locallyClosedOrderId != orderId) {
          _locallyClosedPaidOrderIdsByTableRemoteId.remove(tableId);
        }

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
        tables[tableIndex].items = _mergePendingOrderItems(
          tables[tableIndex],
          _itemsFromCloud(order['items']),
        );
      }

      // Clear items from tables that no longer have active orders
      // This fixes the issue where completed orders still show items
      for (int i = 0; i < tables.length; i++) {
        final table = tables[i];
        if (table.remoteId != null &&
            !activeTableIds.contains(table.remoteId) &&
            table.items.isNotEmpty &&
            !_hasPendingOpenOrderForTable(table)) {
          // Table had items but is not in active orders anymore
          // Clear the items (state will be updated by syncTableStates)
          tables[i].items = [];
          debugPrint(
              'Cleared items from table ${table.label} (no longer has active order)');
        }
      }

      _activeOrderIdsByTableRemoteId.removeWhere(
        (tableId, _) =>
            !activeTableIds.contains(tableId) &&
            !_hasPendingOpenOrderForTableRemoteId(tableId),
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
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
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
      final List<KitchenOrder> newOrders = [];
      for (final rawTicket in tickets) {
        final ticket = Map<String, dynamic>.from(rawTicket);
        final String id = ticket['id']?.toString() ?? '';
        String status = ticket['status']?.toString() ?? 'pending';

        if (_pendingKitchenStatusUpdates.contains(id)) {
          final int existingIdx = kitchenOrders.indexWhere((o) => o.id == id);
          if (existingIdx != -1) {
            status = kitchenOrders[existingIdx].status;
          }
        }

        newOrders.add(KitchenOrder(
          id: id,
          tableLabel: ticket['tableLabel']?.toString() ?? 'Mesa',
          items: _itemsFromCloud(ticket['items']),
          timestamp: DateTime.tryParse(ticket['createdAt']?.toString() ?? '') ??
              DateTime.now(),
          status: status,
          station: ticket['station']?.toString() ?? 'cocina',
        ));
      }

      final serverReadyIds = newOrders
          .where((order) => order.status == 'ready')
          .map((order) => order.id)
          .toSet();
      await _reconcileReadyPickupOrders(serverReadyIds);

      // Trigger notification if status changed to 'ready'
      for (final order in newOrders) {
        final oldStatus = oldStatuses[order.id];
        if (order.status == 'ready' && oldStatus != 'ready') {
          await _addReadyPickupOrder(order, alert: true);
        } else if (order.status == 'ready') {
          await _addReadyPickupOrder(order, alert: false);
        }
      }

      lastSyncError = null;
      kitchenOrders = newOrders;
      notifyListeners();
      return true;
    } catch (e, stack) {
      if (_isTransientSyncFailure(e)) {
        isOnline = false;
        debugPrint('Transient kitchen sync failure: $e');
      } else {
        lastSyncError = 'Error: $e\n$stack';
        debugPrint('Error syncing kitchen orders: $e\n$stack');
      }
      notifyListeners();
      return false;
    }
  }

  bool _isTransientSyncFailure(Object error) {
    return error is TimeoutException ||
        error is SocketException ||
        error is HttpException ||
        error is http.ClientException;
  }

  /// Syncs table states from the backend using the pull sync endpoint.
  /// This ensures all devices see the latest table states (free, occupied, billing, cleaning).
  Future<bool> syncTableStates({bool notify = true}) async {
    if (!isTerminalConfigured || terminalBranchId == null) return false;

    try {
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;

      // Get last sync checkpoint timestamp
      final lastSyncedAt = await _getLastSyncCheckpoint();

      // Call POST /sync/pull endpoint
      final response = await http
          .post(
            Uri.parse('$baseUrl/sync/pull'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'deviceId': deviceId ?? 'tablet-pos-1',
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
        bool hasUnknownTables = false;
        for (final tableData in branchTables) {
          final table = Map<String, dynamic>.from(tableData);
          final tableId = table['id']?.toString();
          if (tableId != null) {
            final exists = tables.any((t) => t.remoteId == tableId);
            if (!exists) {
              hasUnknownTables = true;
              break;
            }
          }
        }

        if (hasUnknownTables) {
          debugPrint(
              'syncTableStates: Found unknown tables in changes. Fetching dynamic tables...');
          await fetchTablesDynamic();
        }

        for (final tableData in branchTables) {
          final table = Map<String, dynamic>.from(tableData);
          final tableId = table['id']?.toString();
          final tableState = table['state']?.toString();

          if (tableId == null || tableState == null) continue;

          final tableIndex = tables.indexWhere((t) => t.remoteId == tableId);
          if (tableIndex != -1) {
            final newState = _parseTableState(tableState);
            final isLocallyClosedPaidOrder =
                _locallyClosedPaidOrderIdsByTableRemoteId.containsKey(tableId);
            if (isLocallyClosedPaidOrder &&
                newState != TableState.free &&
                newState != TableState.cleaning) {
              continue;
            }
            if (isLocallyClosedPaidOrder) {
              _locallyClosedPaidOrderIdsByTableRemoteId.remove(tableId);
            }
            tables[tableIndex].state = newState;
            if (newState == TableState.free ||
                newState == TableState.cleaning) {
              tables[tableIndex].items = [];
              tables[tableIndex].guests = 0;
              tables[tableIndex].discountPercentage = 0;
              tables[tableIndex].guestGenders = const ['M'];
            }
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

    return rawItems.map((rawItem) {
      final item = Map<String, dynamic>.from(rawItem);
      final productId = item['productId']?.toString() ?? '';
      final menuItem = _menuItemById(
        productId,
        fallbackName: item['productName']?.toString(),
      );
      final quantity = (item['quantity'] as num?)?.toInt() ?? 1;
      final grossUnitPrice =
          double.tryParse(item['price']?.toString() ?? '') ?? menuItem.price;
      final assignedGuest =
          item['assignedGuest'] == null ? null : 'P${item['assignedGuest']}';
      final notes = item['notes']?.toString() ?? '';

      return OrderItem(
        remoteId: item['id']?.toString(),
        clientUuid: item['clientUuid']?.toString(),
        syncState: 'synced',
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

  List<OrderItem> _mergePendingOrderItems(
    TableModel table,
    List<OrderItem> cloudItems,
  ) {
    final cloudClientUuids = cloudItems
        .map((item) => item.clientUuid)
        .whereType<String>()
        .where((value) => value.isNotEmpty)
        .toSet();
    final cloudRemoteIds = cloudItems
        .map((item) => item.remoteId)
        .whereType<String>()
        .where((value) => value.isNotEmpty)
        .toSet();

    final pendingLocalItems = table.items.where((item) {
      final isPending =
          item.syncState == 'pending' || item.syncState == 'failed';
      if (!isPending) return false;
      if (item.clientUuid != null &&
          cloudClientUuids.contains(item.clientUuid)) {
        return false;
      }
      if (item.remoteId != null && cloudRemoteIds.contains(item.remoteId)) {
        return false;
      }
      return true;
    }).toList();

    return [...cloudItems, ...pendingLocalItems];
  }

  bool _hasPendingOpenOrderForTable(TableModel table) {
    final tableRemoteId = _remoteIdForTable(table);
    return _hasPendingOpenOrderForTableRemoteId(tableRemoteId) ||
        _pendingOrderSyncJobs.any((job) => job['tableId'] == table.id);
  }

  bool _hasPendingOpenOrderForTableRemoteId(String? tableRemoteId) {
    if (!_isUuid(tableRemoteId)) return false;
    return _pendingOrderSyncJobs.any(
      (job) => job['tableRemoteId']?.toString() == tableRemoteId,
    );
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
    currentUserRole = UserRole.none;
    availableUserRoles = const [];
    try {
      final String? bId = terminalBusinessId;
      if (bId == null || bId.isEmpty) {
        debugPrint('Login skipped: terminal businessId is not configured.');
        return false;
      }
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
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
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
          final roles = _parseRoles(userData['roles'], userData['role']);
          if (roles.every((role) => role == UserRole.none)) {
            debugPrint(
              'Login rejected: user has no valid POS role (${userData['role']}/${userData['roles']}).',
            );
            return false;
          }
          currentUserId = userData['id'];
          currentUserName = userData['name'];
          availableUserRoles = roles;

          currentJwtToken = data['accessToken'];
          if (currentJwtToken != null) {
            await _secureStorageService.saveJwtToken(currentJwtToken!);
          }

          // Securely cache credentials locally
          await _secureStorageService.cacheUserOffline(
            id: userData['id'],
            name: userData['name'],
            pin: pin,
            role: roles.first.name,
            roles: roles.map((role) => role.name).toList(),
            businessId: bId,
            branchId: brId,
          );

          if (roles.length > 1 && !roles.contains(currentUserRole)) {
            currentUserRole = UserRole.none;
            notifyListeners();
            return true;
          }

          completeLoginWithRole(roles.first);
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
        businessId: terminalBusinessId,
        branchId: terminalBranchId,
      );
      if (offlineUser != null) {
        currentUserId =
            offlineUser['id']?.isNotEmpty == true ? offlineUser['id'] : null;
        currentUserName = offlineUser['name']!;
        final roles = _parseRoles(offlineUser['roles'], offlineUser['role']);
        if (roles.every((role) => role == UserRole.none)) {
          debugPrint(
            'Offline login rejected: user has no valid POS role (${offlineUser['role']}/${offlineUser['roles']}).',
          );
          return false;
        }
        availableUserRoles = roles;

        currentJwtToken = await _secureStorageService.getJwtToken();
        if (roles.length > 1 && !roles.contains(currentUserRole)) {
          currentUserRole = UserRole.none;
          notifyListeners();
          return true;
        }

        completeLoginWithRole(roles.first);
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('Error during offline secure login verification: $e');
    }

    return false;
  }

  bool completeLoginWithRole(UserRole selectedRole) {
    if (selectedRole == UserRole.none) return false;
    if (availableUserRoles.isNotEmpty &&
        !availableUserRoles.contains(selectedRole)) {
      return false;
    }
    currentUserRole = selectedRole;
    if (availableUserRoles.isEmpty) {
      availableUserRoles = [selectedRole];
    }
    _initWebSocket();
    _refreshPrintStationLifecycle();
    unawaited(syncAllData());
    notifyListeners();
    return true;
  }

  UserRole _parseRole(String roleStr) {
    switch (roleStr.toLowerCase()) {
      case 'waiter':
        return UserRole.waiter;
      case 'cashier':
        return UserRole.cashier;
      case 'kitchen':
        return UserRole.kitchen;
      case 'encargado':
        return UserRole.encargado;
      case 'responsable':
        return UserRole.responsable;
      default:
        return UserRole.none;
    }
  }

  List<UserRole> _parseRoles(dynamic roles, dynamic fallbackRole) {
    final parsed = <UserRole>[];
    if (roles is List) {
      for (final role in roles) {
        final parsedRole = _parseRole(role?.toString() ?? '');
        if (parsedRole != UserRole.none && !parsed.contains(parsedRole)) {
          parsed.add(parsedRole);
        }
      }
    }
    if (parsed.isEmpty && fallbackRole != null) {
      final parsedRole = _parseRole(fallbackRole.toString());
      if (parsedRole != UserRole.none) {
        parsed.add(parsedRole);
      }
    }
    return parsed.isEmpty ? [UserRole.none] : parsed;
  }

  void logout() {
    currentUserRole = UserRole.none;
    availableUserRoles = const [];
    currentUserId = null;
    currentUserName = "";
    selectedTable = null;
    currentJwtToken = null;
    _secureStorageService.clearJwtToken();
    _stopPrintStationLifecycle();
    disconnectWebSocket();
  }

  // Network Offline Simulation Toggle
  void toggleConnection() {
    isOnline = !isOnline;
    notifyListeners();
  }

  Future<void> checkActiveShift() async {
    if (!isTerminalConfigured ||
        terminalBranchId == null ||
        currentUserId == null) {
      return;
    }
    try {
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
      final response = await http
          .get(Uri.parse(
              '$baseUrl/cash-shifts/active?branchId=$terminalBranchId&cashierId=$currentUserId'))
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final Map<String, dynamic> data = jsonDecode(response.body);
        activeShiftId = data['id']?.toString();
        initialFloat =
            double.tryParse(data['initialFloat']?.toString() ?? '') ?? 0.0;
        cashDrawerAmount =
            double.tryParse(data['cashDrawerAmount']?.toString() ?? '') ?? 0.0;
        isShiftOpen = data['status'] == 'open';
      } else {
        isShiftOpen = false;
        activeShiftId = null;
      }
      notifyListeners();
    } catch (e) {
      debugPrint('Error checking active shift: $e');
    }
  }

  Future<bool> openShift(double floatAmount) async {
    if (!isTerminalConfigured ||
        terminalBranchId == null ||
        currentUserId == null) {
      return false;
    }
    try {
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
      final response = await http
          .post(
            Uri.parse('$baseUrl/cash-shifts'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'cashierId': currentUserId,
              'branchId': terminalBranchId,
              'initialFloat': floatAmount.toStringAsFixed(2),
            }),
          )
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 201 || response.statusCode == 200) {
        final Map<String, dynamic> data = jsonDecode(response.body);
        activeShiftId = data['id']?.toString();
        initialFloat = floatAmount;
        cashDrawerAmount = floatAmount;
        isShiftOpen = true;
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Error opening shift: $e');
      return false;
    }
  }

  Future<bool> addCashDrop(double amount,
      {String reason = 'Ingreso de caja'}) async {
    if (activeShiftId == null) return false;
    try {
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
      final response = await http
          .post(
            Uri.parse('$baseUrl/cash-shifts/$activeShiftId/transactions'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'type': 'cash-in',
              'amount': amount.toStringAsFixed(2),
              'reason': reason,
            }),
          )
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 201 || response.statusCode == 200) {
        final Map<String, dynamic> data = jsonDecode(response.body);
        if (data['shift'] != null) {
          cashDrawerAmount = double.tryParse(
                  data['shift']['cashDrawerAmount']?.toString() ?? '') ??
              (cashDrawerAmount + amount);
        } else {
          cashDrawerAmount += amount;
        }
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Error adding cash drop: $e');
      return false;
    }
  }

  Future<bool> removeCashDrop(double amount,
      {String reason = 'Retiro de caja'}) async {
    if (activeShiftId == null) return false;
    try {
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
      final response = await http
          .post(
            Uri.parse('$baseUrl/cash-shifts/$activeShiftId/transactions'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'type': 'cash-out',
              'amount': amount.toStringAsFixed(2),
              'reason': reason,
            }),
          )
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 201 || response.statusCode == 200) {
        final Map<String, dynamic> data = jsonDecode(response.body);
        if (data['shift'] != null) {
          cashDrawerAmount = double.tryParse(
                  data['shift']['cashDrawerAmount']?.toString() ?? '') ??
              max(0.0, cashDrawerAmount - amount);
        } else {
          cashDrawerAmount = max(0.0, cashDrawerAmount - amount);
        }
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Error removing cash withdrawal: $e');
      return false;
    }
  }

  Future<Map<String, dynamic>?> closeShift(
    double actualAmount, {
    Map<String, num>? denominationCounts,
    String? closeNotes,
  }) async {
    if (activeShiftId == null) return null;
    try {
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
      final response = await http
          .post(
            Uri.parse('$baseUrl/cash-shifts/$activeShiftId/close'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'actualAmount': actualAmount.toStringAsFixed(2),
              if (denominationCounts != null)
                'denominationCounts': denominationCounts,
              if (closeNotes != null && closeNotes.trim().isNotEmpty)
                'closeNotes': closeNotes.trim(),
            }),
          )
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final Map<String, dynamic> data = jsonDecode(response.body);
        isShiftOpen = false;
        activeShiftId = null;
        initialFloat = 0.0;
        cashDrawerAmount = 0.0;
        notifyListeners();
        return Map<String, dynamic>.from(
          data['report'] ?? data['reconciliation'] ?? {},
        );
      }
      return null;
    } catch (e) {
      debugPrint('Error closing shift: $e');
      return null;
    }
  }

  Future<Map<String, dynamic>?> getCashShiftAuditReport(String shiftId) async {
    try {
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
      final response = await http
          .get(Uri.parse('$baseUrl/reports/cash-shifts/$shiftId/audit'))
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        return Map<String, dynamic>.from(jsonDecode(response.body));
      }
      return null;
    } catch (e) {
      debugPrint('Error getting cash shift audit: $e');
      return null;
    }
  }

  // Waiter Order submission
  Future<bool> submitOrder(
    int tableId,
    List<OrderItem> cartItems,
    int guestsCount,
    List<String> genders, {
    bool printComanda = false,
    ComandaPrintMode printMode = ComandaPrintMode.none,
    String? targetStationId,
  }) async {
    if (cartItems.isEmpty) {
      await cancelActiveOrder(tableId);
      return true;
    }

    final index = tables.indexWhere((t) => t.id == tableId);
    if (index != -1) {
      if (_hasPendingOpenOrderForTable(tables[index])) {
        await _syncPendingOrderJobs();
        if (_hasPendingOpenOrderForTable(tables[index])) {
          debugPrint(
            'Order submit blocked: table ${tables[index].label} has a pending order sync job.',
          );
          return false;
        }
      }

      // Filter out only new (unsent) items to print and send to kitchen.
      final newItems = <OrderItem>[];
      final updatedItems = cartItems.map((item) {
        if (item.isSent) return item;
        final queuedItem = item.copyWith(
          isSent: true,
          clientUuid: item.clientUuid ?? _newUuid(),
          syncState: 'pending',
        );
        newItems.add(queuedItem);
        return queuedItem;
      }).toList();

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

        final effectivePrintMode =
            printComanda ? ComandaPrintMode.local : printMode;

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

          _routeComandaPrintJob(
            PrintJob(
              id: '${newJobId}_k',
              title: 'Comanda Cocina - ${tables[index].label}',
              details: buffer.toString(),
              target: 'Cocina',
              timestamp: DateTime.now(),
            ),
            printMode: effectivePrintMode,
            targetStationId: targetStationId,
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

          _routeComandaPrintJob(
            PrintJob(
              id: '${newJobId}_b',
              title: 'Comanda Barra - ${tables[index].label}',
              details: buffer.toString(),
              target: 'Barra',
              timestamp: DateTime.now(),
            ),
            printMode: effectivePrintMode,
            targetStationId: targetStationId,
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

        final syncJob = _buildOpenOrderSyncJob(
          table: tables[index],
          newItems: newItems,
        );
        if (syncJob != null) {
          final synced = await _queueAndSyncOrderJob(syncJob);
          notifyListeners();
          return synced;
        }
      }

      notifyListeners();
      return true;
    }
    return false;
  }

  void _routeComandaPrintJob(
    PrintJob job, {
    required ComandaPrintMode printMode,
    String? targetStationId,
  }) {
    switch (printMode) {
      case ComandaPrintMode.none:
        return;
      case ComandaPrintMode.auto:
        unawaited(
          enqueueCajaPrintJob(
            job,
            preferredStationId: targetStationId,
          ),
        );
        return;
      case ComandaPrintMode.local:
        unawaited(enqueuePrintJob(job, forcePhysical: true));
        return;
      case ComandaPrintMode.remoteStation:
        if (targetStationId == null || targetStationId.isEmpty) {
          debugPrint('Remote comanda print skipped: missing targetStationId');
          return;
        }
        unawaited(enqueueRemotePrintJob(job, targetStationId));
        return;
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
        final String baseUrl = terminalApiUrl ??
            configuredDefaultApiUrl;
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

  Map<String, dynamic>? _buildOpenOrderSyncJob({
    required TableModel table,
    required List<OrderItem> newItems,
  }) {
    final tableRemoteId = _remoteIdForTable(table);
    if (!_isUuid(tableRemoteId) || newItems.isEmpty) return null;

    return {
      'id': _newUuid(),
      'orderClientUuid': _newUuid(),
      'tableId': table.id,
      'tableRemoteId': tableRemoteId,
      'tableLabel': table.label,
      'waiterId': currentUserId,
      'subtotal': table.netSubtotal.toStringAsFixed(2),
      'discount': table.netDiscountAmount.toStringAsFixed(2),
      'tax': table.includedTax.toStringAsFixed(2),
      'total': table.total.toStringAsFixed(2),
      'items': newItems.map((item) => item.toSyncJson()).toList(),
      'createdAt': DateTime.now().toUtc().toIso8601String(),
      'attemptCount': 0,
    };
  }

  Future<bool> _queueAndSyncOrderJob(Map<String, dynamic> job) async {
    await _syncPendingOrderJobs();
    _pendingOrderSyncJobs.add(job);
    await _persistPendingOrderSyncJobs();
    await _syncPendingOrderJobs();
    final jobId = job['id']?.toString();
    if (jobId == null) return false;
    return !_pendingOrderSyncJobs.any(
      (pendingJob) => pendingJob['id']?.toString() == jobId,
    );
  }

  Future<bool> _syncPendingOrderJobs() async {
    if (_pendingOrderSyncJobs.isEmpty) {
      _updatePendingSyncCount();
      return true;
    }

    if (!isTerminalConfigured) {
      return false;
    }

    final remaining = <Map<String, dynamic>>[];
    for (final job in List<Map<String, dynamic>>.from(_pendingOrderSyncJobs)) {
      final pushed = await _pushOpenOrderJobToCloud(job);
      if (pushed) {
        _markOrderJobItemsSynced(job);
      } else {
        remaining.add({
          ...job,
          'attemptCount': ((job['attemptCount'] as num?)?.toInt() ?? 0) + 1,
          'lastAttemptAt': DateTime.now().toUtc().toIso8601String(),
        });
      }
    }

    _pendingOrderSyncJobs
      ..clear()
      ..addAll(remaining);
    await _persistPendingOrderSyncJobs();
    return _pendingOrderSyncJobs.isEmpty;
  }

  void _markOrderJobItemsSynced(Map<String, dynamic> job) {
    final rawItems = job['items'];
    if (rawItems is! List) return;

    final clientUuids = rawItems
        .whereType<Map>()
        .map((rawItem) => Map<String, dynamic>.from(rawItem))
        .map((item) => item['clientUuid']?.toString())
        .whereType<String>()
        .where((value) => value.isNotEmpty)
        .toSet();
    if (clientUuids.isEmpty) return;

    final tableRemoteId = job['tableRemoteId']?.toString();
    final tableId = (job['tableId'] as num?)?.toInt();
    final tableIndex = tables.indexWhere(
      (table) =>
          (_isUuid(tableRemoteId) &&
              _remoteIdForTable(table) == tableRemoteId) ||
          (tableId != null && table.id == tableId),
    );
    if (tableIndex == -1) return;

    tables[tableIndex].items = tables[tableIndex].items.map((item) {
      if (item.clientUuid != null && clientUuids.contains(item.clientUuid)) {
        return item.copyWith(syncState: 'synced');
      }
      return item;
    }).toList();
  }

  Future<bool> _pushOpenOrderJobToCloud(Map<String, dynamic> job) async {
    if (!isTerminalConfigured || terminalBranchId == null) return false;

    final tableRemoteId = job['tableRemoteId']?.toString();
    final waiterId = job['waiterId']?.toString() ?? currentUserId;
    final rawItems = job['items'];
    if (!_isUuid(tableRemoteId) || !_isUuid(waiterId) || rawItems is! List) {
      return false;
    }

    final newItems = rawItems
        .whereType<Map>()
        .map((rawItem) => OrderItem.fromSyncJson(
              Map<String, dynamic>.from(rawItem),
            ))
        .toList();
    if (newItems.isEmpty) return true;

    final missingProducts = newItems
        .where((item) => !_isUuid(_productRemoteIdForItem(item)))
        .map((item) => '${item.item.name}=${item.item.id}')
        .toList();
    if (missingProducts.isNotEmpty) {
      debugPrint(
        'Open order sync skipped: products without cloud UUIDs: ${missingProducts.join(', ')}.',
      );
      return false;
    }

    try {
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;

      var orderId = _activeOrderIdsByTableRemoteId[tableRemoteId!];
      if (orderId == null) {
        await syncActiveOrders(notify: false);
        orderId = _activeOrderIdsByTableRemoteId[tableRemoteId];
      }

      final itemsPayload = newItems.map(_cloudOrderItemPayload).toList();

      if (orderId == null) {
        final response = await http
            .post(
              Uri.parse('$baseUrl/orders'),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({
                'branchId': terminalBranchId,
                'tableId': tableRemoteId,
                'waiterId': waiterId,
                'clientUuid': job['orderClientUuid']?.toString(),
                'subtotal': job['subtotal']?.toString() ?? '0.00',
                'discount': job['discount']?.toString() ?? '0.00',
                'tax': job['tax']?.toString() ?? '0.00',
                'total': job['total']?.toString() ?? '0.00',
                'items': itemsPayload,
              }),
            )
            .timeout(const Duration(seconds: 10));

        if (response.statusCode != 201 && response.statusCode != 200) {
          debugPrint(
            'Cloud order create failed ${response.statusCode}: ${response.body}',
          );
          return false;
        }

        final created = Map<String, dynamic>.from(jsonDecode(response.body));
        orderId = created['id']?.toString();
        if (!_isUuid(orderId)) return false;
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
          return false;
        }
      }

      final kitchenResponse = await http
          .post(Uri.parse('$baseUrl/kitchen/orders/$orderId/send'))
          .timeout(const Duration(seconds: 10));
      if (kitchenResponse.statusCode != 200) {
        debugPrint(
          'Cloud kitchen send failed ${kitchenResponse.statusCode}: ${kitchenResponse.body}',
        );
        return false;
      }
      return true;
    } catch (e) {
      debugPrint('Cloud open order sync failed: $e');
      return false;
    }
  }

  Map<String, dynamic> _cloudOrderItemPayload(OrderItem item) => {
        'productId': _productRemoteIdForItem(item),
        'clientUuid': item.clientUuid,
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
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
      await http
          .post(Uri.parse('$baseUrl/orders/$orderId/billing'))
          .timeout(const Duration(seconds: 10));
    } catch (e) {
      debugPrint('Cloud billing request failed: $e');
    }
  }

  String generatePreCuentaTicket(TableModel table) {
    final buffer = StringBuffer();
    buffer.writeln(formatCenter('=== PRE-CUENTA ==='));
    buffer.writeln(formatCenter('GRUPO CACHARELO'));
    buffer.writeln(formatCenter(table.label));
    final dateStr = DateTime.now().toString().substring(0, 16);
    buffer.writeln(formatRow('Fecha:', dateStr));
    buffer.writeln(formatRow('Atendio:', currentUserName));
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
        buffer.writeln('   * Nota: ${item.notes}');
      }
    }

    buffer.writeln(formatDivider(char: '='));
    buffer.writeln(formatRow('TOTAL:', '\$${table.total.toStringAsFixed(2)}'));
    buffer.writeln(formatDivider(char: '='));
    buffer.writeln('');
    buffer.writeln(formatCenter('* FAVOR DE PAGAR EN CAJA *'));
    buffer.writeln(formatCenter('GRACIAS POR SU VISITA'));
    return buffer.toString();
  }

  Future<bool> printPreCuentaForTable(TableModel table) async {
    final job = PrintJob(
      id: 'pc_${DateTime.now().millisecondsSinceEpoch}',
      title: 'Pre-Cuenta - ${table.label}',
      details: generatePreCuentaTicket(table),
      target: 'Caja',
      timestamp: DateTime.now(),
    );
    return enqueueCajaPrintJob(job);
  }

  String _generateOperationNumber(DateTime timestamp) {
    final prefix = ticketFiscalConfig.receiptPrefix.trim().isEmpty
        ? 'CCH'
        : ticketFiscalConfig.receiptPrefix.trim().toUpperCase();
    final stamp = '${timestamp.year.toString().padLeft(4, '0')}'
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
    final mesaClean = table.label.startsWith('Mesa ')
        ? table.label.substring(5)
        : table.label;
    buffer.writeln(formatRow('Mesa:', mesaClean));
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
    int? originalSplitCount,
    List<int>? itemIndicesToPay,
    bool printCustomerTicket = true,
  }) {
    final index = tables.indexWhere((t) => t.id == tableId);
    if (index != -1) {
      final t = tables[index];
      t.discountPercentage = discount;

      // Determine what is being paid
      double finalTotal;
      TableModel tableSnapshot;

      if (isEqualSplit && splitCount != null) {
        // Equal split payment: 1 part of splitCount
        final divisor = originalSplitCount ?? splitCount;
        finalTotal = t.total / divisor;

        // Construct a mock TableModel to represent the partial payment on the receipt
        final currentPart = originalSplitCount != null
            ? (originalSplitCount - splitCount + 1)
            : 1;
        tableSnapshot = t.copyWith(
          label: '${t.label} (División $currentPart/$divisor)',
          items: [
            OrderItem(
              item: MenuItem(
                id: 'partial_payment',
                name: 'Pago Parcial ($currentPart/$divisor)',
                price: t.subtotal / divisor,
                category: 'Pago',
              ),
              quantity: 1,
              isSent: true,
            ),
          ],
        );
      } else if (itemIndicesToPay != null && itemIndicesToPay.isNotEmpty) {
        // Split by items: only pay selected items
        final selectedItems =
            itemIndicesToPay.map((idx) => t.items[idx].copyWith()).toList();
        finalTotal = selectedItems.fold<double>(
                0.0, (sum, item) => sum + item.totalPrice) *
            (1 - (discount / 100.0));

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

      // Check if this is a completed equal split payment from the new flow
      final isCompletedEqualSplit = isEqualSplit &&
          originalSplitCount != null &&
          originalSplitCount > 1 &&
          splitCount == 1; // Final payment indicator

      String printDetails; // Declare here so it's accessible later

      if (isCompletedEqualSplit) {
        final amountPerPerson = t.total / originalSplitCount;

        // Add all individual payments to partialPayments for the summary
        t.partialPayments = []; // Clear any existing
        for (int i = 1; i <= originalSplitCount; i++) {
          t.partialPayments.add(PartialPayment(
            amount: amountPerPerson,
            paymentMethod: 'División Equitativa',
            refCode: 'Pago $i',
            timestamp: closedAt,
            description: 'Pago $i de $originalSplitCount',
          ));
        }

        // Generate final summary ticket
        _printFinalSummaryTicket(t, closedAt);

        // For recent sales, use the summary ticket
        printDetails =
            'División Equitativa: $originalSplitCount pagos de \$${amountPerPerson.toStringAsFixed(2)}';
      } else {
        // Regular ticket printing for non-split or partial payments
        printDetails = _generateFinalCustomerTicket(
          tableSnapshot,
          discount: discount,
          paymentMethod: paymentMethod,
          refCode: refCode,
          closedAt: closedAt,
          cashReceived: cashReceived,
          cashChange: cashChange,
        );

        if (printCustomerTicket) {
          unawaited(enqueueCajaPrintJob(
            PrintJob(
              id: 'rec_${DateTime.now().millisecondsSinceEpoch}',
              title: 'Ticket - ${tableSnapshot.label}',
              details: printDetails,
              target: 'Caja',
              timestamp: DateTime.now(),
            ),
          ));
        }
      }

      _addRecentClosedSale(
        id: 'sale_${DateTime.now().millisecondsSinceEpoch}',
        label: tableSnapshot.label,
        total: finalTotal,
        closedAt: closedAt,
        printDetails: printDetails,
      );

      List<String>? paidOrderItemIds;
      if (itemIndicesToPay != null && itemIndicesToPay.isNotEmpty) {
        paidOrderItemIds = itemIndicesToPay
            .map((idx) => t.items[idx].remoteId)
            .whereType<String>()
            .toList();
      }
      final willCloseAfterItemPayment =
          itemIndicesToPay != null && itemIndicesToPay.length >= t.items.length;

      final cloudOrderId = _activeCloudOrderIdForTable(t);
      if (cloudOrderId != null) {
        if (willCloseAfterItemPayment) {
          _markLocallyClosedPaidOrder(t, orderId: cloudOrderId);
        }
        unawaited(
          _processCloudOrderPayment(
            cloudOrderId,
            tableId: t.id,
            amount: finalTotal,
            paymentMethod: paymentMethod,
            refCode: refCode,
            paidOrderItemIds: paidOrderItemIds,
            forceCloseLocalOnSuccess: willCloseAfterItemPayment,
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

      // Track partial payment for final summary ticket
      final isPartialPayment =
          (isEqualSplit && splitCount != null && splitCount > 1) ||
              (itemIndicesToPay != null &&
                  itemIndicesToPay.isNotEmpty &&
                  t.items.isNotEmpty);

      if (isPartialPayment) {
        // Add this payment to the partial payments list
        final currentPaymentNumber = t.partialPayments.length + 1;
        final totalParts = originalSplitCount ?? splitCount ?? 1;
        final paymentDescription = isEqualSplit
            ? 'Pago $currentPaymentNumber de $totalParts'
            : 'Pago parcial ${itemIndicesToPay?.length ?? 0} artículo(s)';

        t.partialPayments = [
          ...t.partialPayments,
          PartialPayment(
            amount: finalTotal,
            paymentMethod: paymentMethod,
            refCode: refCode,
            timestamp: closedAt,
            description: paymentDescription,
          ),
        ];
      }

      if (isEqualSplit && splitCount != null && splitCount > 1) {
        // It's a partial equal split: do not reset the table!
        // Just keep the table open in billing state
        t.state = TableState.billing;
        debugPrint(
            'Processed equal split payment of \$${finalTotal.toStringAsFixed(2)}. Table remains open.');
      } else if (itemIndicesToPay != null && itemIndicesToPay.isNotEmpty) {
        // Split by items: remove paid items from the table!
        // We sort indices in descending order to avoid shift issues during removal
        final sortedIndices = List<int>.from(itemIndicesToPay)
          ..sort((a, b) => b.compareTo(a));
        for (final idx in sortedIndices) {
          t.items.removeAt(idx);
        }

        // If no items are left, close the table!
        if (t.items.isEmpty) {
          // This was the final partial payment - print summary ticket!
          if (t.partialPayments.isNotEmpty) {
            _printFinalSummaryTicket(t, closedAt);
          }
          t.state =
              (t.zone == 'Para Llevar') ? TableState.free : TableState.cleaning;
          t.guests = 0;
          t.discountPercentage = 0;
          t.partialPayments = [];
          debugPrint('All items paid. Closing table ${t.label}.');
        } else {
          // If items are still left, keep it open/billing
          t.state = TableState.billing;
          debugPrint(
              'Split by items payment done. ${t.items.length} items remaining on table ${t.label}.');
        }
      } else {
        // Check if this is the final payment of an equal split
        if (isEqualSplit && t.partialPayments.isNotEmpty) {
          // This was the last equal split payment - print summary ticket!
          _printFinalSummaryTicket(t, closedAt);
        }

        // Full checkout: close the table completely
        t.state =
            (t.zone == 'Para Llevar') ? TableState.free : TableState.cleaning;
        t.items = [];
        t.guests = 0;
        t.discountPercentage = 0;
        t.partialPayments = [];
        debugPrint('Full checkout completed. Closing table ${t.label}.');
      }

      notifyListeners();
    }
  }

  // Generate and print final summary ticket for split/partial payments
  void _printFinalSummaryTicket(TableModel table, DateTime closedAt) {
    if (table.partialPayments.isEmpty) return;

    final config = ticketFiscalConfig;
    final operationNumber = _generateOperationNumber(closedAt);
    final dateStr = closedAt.toString().substring(0, 16);
    final buffer = StringBuffer();

    // Header
    buffer.writeln(formatCenter('RESUMEN FINAL - CUENTA DIVIDIDA'));
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
    final mesaClean = table.label.startsWith('Mesa ')
        ? table.label.substring(5)
        : table.label;
    buffer.writeln(formatRow('Mesa:', mesaClean));
    buffer.writeln(formatRow('Atendio:', currentUserName));
    buffer.writeln(formatDivider());

    // Partial payments list
    buffer.writeln(formatCenter('DETALLE DE PAGOS'));
    buffer.writeln(formatDivider());

    double grandTotal = 0.0;
    for (var i = 0; i < table.partialPayments.length; i++) {
      final payment = table.partialPayments[i];
      buffer.writeln(formatRow(payment.description, ''));
      buffer.writeln(formatRow('  ${payment.paymentMethod}',
          '\$${payment.amount.toStringAsFixed(2)}'));
      if (payment.refCode.isNotEmpty && payment.refCode != 'Efectivo') {
        buffer.writeln(formatRow('  Ref:', payment.refCode));
      }
      if (i < table.partialPayments.length - 1) {
        buffer.writeln(formatDivider(char: '-'));
      }
      grandTotal += payment.amount;
    }

    buffer.writeln(formatDivider(char: '='));
    buffer.writeln(
        formatRow('TOTAL GENERAL:', '\$${grandTotal.toStringAsFixed(2)}'));
    buffer.writeln(formatDivider(char: '='));

    buffer.write(formatCenterLines('Gracias por su preferencia'));
    buffer.writeln('');
    if (config.footerText != null && config.footerText!.trim().isNotEmpty) {
      buffer
          .write(formatCenterLines(_normalizeTicketFooter(config.footerText!)));
    }
    buffer.writeln('');
    buffer.writeln('');

    // Print the summary ticket
    unawaited(enqueueCajaPrintJob(
      PrintJob(
        id: 'summary_${DateTime.now().millisecondsSinceEpoch}',
        title: 'Resumen Final - ${table.label}',
        details: buffer.toString(),
        target: 'Caja',
        timestamp: DateTime.now(),
      ),
    ));

    debugPrint(
        'Final summary ticket printed for ${table.label} with ${table.partialPayments.length} partial payments.');
  }

  String? _activeCloudOrderIdForTable(TableModel table) {
    final tableRemoteId = _remoteIdForTable(table);
    if (tableRemoteId == null) return null;
    return _activeOrderIdsByTableRemoteId[tableRemoteId];
  }

  void finalizeCompletedSplitCheckout(int tableId) {
    final index = tables.indexWhere((table) => table.id == tableId);
    if (index == -1) return;

    final table = tables[index];
    final orderId = _activeCloudOrderIdForTable(table);
    if (orderId != null) {
      _forceCloseLocalPaidTable(tableId, orderId: orderId);
    } else {
      table.state =
          table.zone == 'Para Llevar' ? TableState.free : TableState.cleaning;
      table.items = [];
      table.guests = 0;
      table.discountPercentage = 0;
      table.guestGenders = const ['M'];
      table.partialPayments = [];
      table.activePaymentType = null;
      table.paymentsMadeInSession = 0;
      table.originalSplitCountInSession = null;
      notifyListeners();
    }

    unawaited(_updateClosedPaidTableStateOnServer(tableId));
  }

  Future<void> _processCloudOrderPayment(
    String orderId, {
    required int tableId,
    required double amount,
    required String paymentMethod,
    required String refCode,
    List<String>? paidOrderItemIds,
    bool forceCloseLocalOnSuccess = false,
  }) async {
    try {
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
      final response = await http
          .post(
            Uri.parse('$baseUrl/orders/$orderId/payments'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'amount': amount.toStringAsFixed(2),
              'paymentMethod': _normalizePaymentMethod(paymentMethod),
              if (refCode.isNotEmpty && refCode != 'Efectivo')
                'referenceCode': refCode,
              if (paidOrderItemIds != null && paidOrderItemIds.isNotEmpty)
                'paidOrderItemIds': paidOrderItemIds,
            }),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        debugPrint(
          'Cloud order payment failed ${response.statusCode}: ${response.body}',
        );
        if (forceCloseLocalOnSuccess) {
          _clearLocallyClosedPaidOrder(orderId);
        }
        return;
      }

      final Map<String, dynamic> responseData = jsonDecode(response.body);
      final bool isFullyPaid = responseData['isFullyPaid'] == true;
      final bool shouldCloseLocal = isFullyPaid || forceCloseLocalOnSuccess;

      if (shouldCloseLocal) {
        _activeOrderIdsByTableRemoteId.removeWhere((_, id) => id == orderId);
        _forceCloseLocalPaidTable(tableId, orderId: orderId);
        await _updateClosedPaidTableStateOnServer(tableId);
      }

      // Sync table states after successful payment to update other devices
      await syncTableStates(notify: true);
      if (shouldCloseLocal) {
        _forceCloseLocalPaidTable(tableId, orderId: orderId);
      }
    } catch (e) {
      if (forceCloseLocalOnSuccess) {
        _clearLocallyClosedPaidOrder(orderId);
      }
      debugPrint('Cloud order payment request failed: $e');
    }
  }

  void _markLocallyClosedPaidOrder(
    TableModel table, {
    required String orderId,
  }) {
    final tableRemoteId = _remoteIdForTable(table);
    if (tableRemoteId == null) return;
    _activeOrderIdsByTableRemoteId.remove(tableRemoteId);
    _locallyClosedPaidOrderIdsByTableRemoteId[tableRemoteId] = orderId;
  }

  void _clearLocallyClosedPaidOrder(String orderId) {
    _locallyClosedPaidOrderIdsByTableRemoteId.removeWhere(
      (_, locallyClosedOrderId) => locallyClosedOrderId == orderId,
    );
  }

  void _forceCloseLocalPaidTable(int tableId, {required String orderId}) {
    final index = tables.indexWhere((table) => table.id == tableId);
    if (index == -1) return;

    final table = tables[index];
    _markLocallyClosedPaidOrder(table, orderId: orderId);

    table.state =
        table.zone == 'Para Llevar' ? TableState.free : TableState.cleaning;
    table.items = [];
    table.guests = 0;
    table.discountPercentage = 0;
    table.guestGenders = const ['M'];
    table.partialPayments = [];
    table.activePaymentType = null;
    table.paymentsMadeInSession = 0;
    table.originalSplitCountInSession = null;
    notifyListeners();
  }

  Future<void> _updateClosedPaidTableStateOnServer(int tableId) async {
    final index = tables.indexWhere((table) => table.id == tableId);
    if (index == -1) return;

    final table = tables[index];
    if (table.remoteId == null ||
        !isTerminalConfigured ||
        terminalBranchId == null) {
      return;
    }

    final state = table.zone == 'Para Llevar' ? 'free' : 'cleaning';
    try {
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
      final response = await http
          .patch(
            Uri.parse(
              '$baseUrl/branches/$terminalBranchId/tables/${table.remoteId}',
            ),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'state': state}),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        debugPrint(
          'Failed to close paid table on server: ${response.statusCode}',
        );
      }
    } catch (e) {
      debugPrint('Error closing paid table on server: $e');
    }
  }

  Future<TableModel?> createToGoTable() async {
    if (!isTerminalConfigured || terminalBranchId == null) {
      // Local fallback if offline/no configuration
      final int nextId =
          tables.where((t) => t.zone == 'Para Llevar').length + 1;
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
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
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
    final freeTableIndex = tables.indexWhere(
        (t) => t.zone == 'Para Llevar' && t.state == TableState.free);
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
    tables[index].items = [];
    tables[index].guests = 0;
    tables[index].discountPercentage = 0;
    tables[index].guestGenders = const ['M'];
    notifyListeners();

    // Update backend to sync state across devices
    final table = tables[index];
    if (table.remoteId != null &&
        isTerminalConfigured &&
        terminalBranchId != null) {
      try {
        final String baseUrl = terminalApiUrl ??
            configuredDefaultApiUrl;
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
      _pendingKitchenStatusUpdates.add(orderId);
      Timer(const Duration(seconds: 2), () {
        _pendingKitchenStatusUpdates.remove(orderId);
      });

      unawaited(_updateCloudKitchenTicketStatus(orderId, newStatus));

      if (newStatus == 'ready') {
        unawaited(_addReadyPickupOrder(kitchenOrders[index], alert: true));
      } else if (newStatus == 'served') {
        unawaited(_removeReadyPickupOrder(orderId));
      }
      notifyListeners();
    }
  }

  Future<void> markReadyPickupOrderServed(String orderId) async {
    if (orderId.isEmpty) return;

    final index = kitchenOrders.indexWhere((o) => o.id == orderId);
    if (index != -1) {
      kitchenOrders[index].status = 'served';
      _pendingKitchenStatusUpdates.add(orderId);
      Timer(const Duration(seconds: 2), () {
        _pendingKitchenStatusUpdates.remove(orderId);
      });
      notifyListeners();
    }

    await _removeReadyPickupOrder(orderId);
    await _updateCloudKitchenTicketStatus(orderId, 'served');
    await syncKitchenOrders();
  }

  Future<bool> _updateCloudKitchenTicketStatus(
    String ticketId,
    String status,
  ) async {
    if (!isTerminalConfigured) return false;
    try {
      final String baseUrl = terminalApiUrl ??
          configuredDefaultApiUrl;
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
        return false;
      }
      return true;
    } catch (e) {
      debugPrint('Kitchen status sync request failed: $e');
      return false;
    }
  }

  void clearNotification(String notification) {
    readyNotifications.remove(notification);
    notifyListeners();
  }

  Future<void> _loadReadyPickupOrders() async {
    try {
      final orders = await _secureStorageService.getReadyPickupOrders();
      readyPickupOrders = orders
          .map((order) => KitchenOrder.fromSyncJson(order))
          .where((order) => order.id.isNotEmpty && order.status == 'ready')
          .toList();
      _alertedReadyPickupIds
        ..clear()
        ..addAll(readyPickupOrders.map((order) => order.id));
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading ready pickup orders: $e');
    }
  }

  Future<void> _persistReadyPickupOrders() async {
    await _secureStorageService.saveReadyPickupOrders(
      readyPickupOrders.map((order) => order.toSyncJson()).toList(),
    );
  }

  Future<void> _reconcileReadyPickupOrders(Set<String> serverReadyIds) async {
    if (readyPickupOrders.isEmpty) return;

    final removedTableLabels = <String>{};
    final removedIds = <String>{};
    readyPickupOrders.removeWhere((order) {
      final shouldRemove =
          order.id.isEmpty || !serverReadyIds.contains(order.id);
      if (shouldRemove) {
        removedIds.add(order.id);
        removedTableLabels.add(order.tableLabel);
      }
      return shouldRemove;
    });

    if (removedIds.isEmpty) return;

    _alertedReadyPickupIds.removeAll(removedIds);
    for (final tableLabel in removedTableLabels) {
      readyNotifications.remove('¡Pedido listo para la $tableLabel!');
    }

    await _persistReadyPickupOrders();
    notifyListeners();
  }

  Future<void> _addReadyPickupOrder(
    KitchenOrder order, {
    required bool alert,
  }) async {
    if (order.id.isEmpty || order.status != 'ready') return;

    final existingIndex =
        readyPickupOrders.indexWhere((existing) => existing.id == order.id);
    if (existingIndex == -1) {
      readyPickupOrders.add(order);
    } else {
      readyPickupOrders[existingIndex] = order;
    }

    final notificationText = '¡Pedido listo para la ${order.tableLabel}!';
    if (!readyNotifications.contains(notificationText)) {
      readyNotifications.add(notificationText);
    }

    if (alert && !_alertedReadyPickupIds.contains(order.id)) {
      _alertedReadyPickupIds.add(order.id);
      unawaited(_playReadyPickupAlert());
    }

    await _persistReadyPickupOrders();
    notifyListeners();
  }

  Future<void> _removeReadyPickupOrder(String orderId) async {
    String? tableLabel;
    for (final order in readyPickupOrders) {
      if (order.id == orderId) {
        tableLabel = order.tableLabel;
        break;
      }
    }
    readyPickupOrders.removeWhere((order) => order.id == orderId);
    _alertedReadyPickupIds.remove(orderId);
    if (tableLabel != null) {
      readyNotifications.remove('¡Pedido listo para la $tableLabel!');
    }
    await _persistReadyPickupOrders();
    notifyListeners();
  }

  Future<void> _playReadyPickupAlert() async {
    try {
      await SystemSound.play(SystemSoundType.alert);
    } catch (e) {
      debugPrint('Ready pickup sound failed: $e');
    }

    if (!kIsWeb) {
      try {
        await HapticFeedback.vibrate();
      } catch (e) {
        debugPrint('Ready pickup vibration failed: $e');
      }
    }
  }

  bool get hasConfiguredPrinter => connectedPrinterMac != null;

  bool get canAdvertisePrintStation =>
      !kIsWeb &&
      receiveRemotePrintJobs &&
      currentUserRole != UserRole.none &&
      connectedPrinterName != null &&
      terminalBranchId != null;

  Future<void> setReceiveRemotePrintJobs(bool enabled) async {
    receiveRemotePrintJobs = enabled;
    await _secureStorageService.saveReceiveRemotePrintJobs(enabled);
    if (!enabled) {
      await sendPrintStationAvailability(canPrintComandas: false);
    }
    _refreshPrintStationLifecycle();
    notifyListeners();
  }

  PrintStation? get lastSelectedOnlinePrintStation {
    final stationId = lastSelectedPrintStationId;
    if (stationId == null) return null;
    for (final station in onlinePrintStations) {
      if (station.stationId == stationId && station.canPrintComandas) {
        return station;
      }
    }
    return null;
  }

  Future<void> saveLastSelectedPrintStation(String stationId) async {
    lastSelectedPrintStationId = stationId;
    await _secureStorageService.saveLastPrintStationId(stationId);
    notifyListeners();
  }

  String get _printStationBaseUrl =>
      terminalApiUrl ??
      configuredDefaultApiUrl;

  String? get branchCashierPrintQueueId {
    final branchId = terminalBranchId;
    if (branchId == null || branchId.isEmpty) return null;
    return 'branch:$branchId:cashier';
  }

  String? get defaultCajaPrintStationId {
    final selected = lastSelectedPrintStationId?.trim();
    if (selected != null && selected.isNotEmpty) return selected;
    if (!hasConfiguredPrinter) return branchCashierPrintQueueId;
    return null;
  }

  String get defaultPrintRouteLabel {
    final selected = lastSelectedPrintStationId;
    if (selected != null && selected.isNotEmpty) {
      final station = onlinePrintStations.cast<PrintStation?>().firstWhere(
            (station) => station?.stationId == selected,
            orElse: () => null,
          );
      final name = station?.displayName ?? 'caja configurada';
      return 'Cola de caja: $name';
    }
    if (!hasConfiguredPrinter && branchCashierPrintQueueId != null) {
      return 'Cola de caja';
    }
    if (hasConfiguredPrinter) {
      return 'Impresora local';
    }
    return 'Sin impresora configurada';
  }

  Map<String, String> get _jsonAuthHeaders {
    final headers = {'Content-Type': 'application/json'};
    final token = currentJwtToken;
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<bool> refreshOnlinePrintStations() async {
    if (!isTerminalConfigured || terminalBranchId == null) {
      onlinePrintStations = [];
      notifyListeners();
      return false;
    }

    try {
      final uri = Uri.parse(
        '$_printStationBaseUrl/print-stations?branchId=$terminalBranchId',
      );
      final response = await http
          .get(uri, headers: _jsonAuthHeaders)
          .timeout(const Duration(seconds: 6));
      if (response.statusCode != 200) {
        debugPrint(
          'refreshOnlinePrintStations failed ${response.statusCode}: ${response.body}',
        );
        return false;
      }

      final decoded = jsonDecode(response.body);
      final List<dynamic> rawStations =
          decoded is List ? decoded : decoded['items'] ?? [];
      final parsed = rawStations
          .whereType<Map>()
          .map((item) => PrintStation.fromJson(Map<String, dynamic>.from(item)))
          .where(
            (station) =>
                station.stationId.isNotEmpty &&
                station.printerName.isNotEmpty &&
                station.canPrintComandas,
          );

      // Deduplicate stations by deviceName (keeping the most recently active record)
      final Map<String, PrintStation> uniqueByDevice = {};
      for (final station in parsed) {
        final key = station.deviceName.trim().toLowerCase();
        if (!uniqueByDevice.containsKey(key) ||
            station.lastSeenAt.isAfter(uniqueByDevice[key]!.lastSeenAt)) {
          uniqueByDevice[key] = station;
        }
      }

      onlinePrintStations = uniqueByDevice.values.toList();
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Error refreshing online print stations: $e');
      return false;
    }
  }

  Future<bool> sendPrintStationHeartbeat() async {
    if (!canAdvertisePrintStation) return false;
    return sendPrintStationAvailability(canPrintComandas: true);
  }

  Future<bool> sendPrintStationAvailability({
    required bool canPrintComandas,
  }) async {
    if (!isTerminalConfigured ||
        terminalBranchId == null ||
        connectedPrinterName == null ||
        currentUserRole == UserRole.none ||
        kIsWeb) {
      lastPrintStationPublishAttemptAt = DateTime.now();
      lastPrintStationPublishSucceeded = false;
      lastPrintStationPublishMessage =
          'Falta sucursal, sesion o impresora configurada.';
      notifyListeners();
      return false;
    }
    final stationId = localStationId ??
        await _secureStorageService.getOrCreateLocalStationId();
    localStationId = stationId;

    try {
      lastPrintStationPublishAttemptAt = DateTime.now();
      final station = PrintStation(
        stationId: stationId,
        deviceName: _defaultDeviceName(),
        operatorId: currentUserId,
        operatorName: currentUserName.isEmpty ? null : currentUserName,
        printerName: connectedPrinterName!,
        role: currentUserRole,
        lastSeenAt: DateTime.now().toUtc(),
        canPrintComandas: canPrintComandas,
        online: canPrintComandas,
        recentlySeen: true,
        presenceStatus: canPrintComandas ? 'online' : 'disabled',
      );
      final response = await http
          .post(
            Uri.parse('$_printStationBaseUrl/print-stations/heartbeat'),
            headers: _jsonAuthHeaders,
            body: jsonEncode({
              'stationId': station.stationId,
              'branchId': terminalBranchId,
              'deviceName': station.deviceName,
              'role': station.role.name,
              'operatorId': station.operatorId,
              'operatorName': station.operatorName,
              'printerName': station.printerName,
              'canPrintComandas': station.canPrintComandas,
            }),
          )
          .timeout(const Duration(seconds: 6));
      if (response.statusCode < 200 || response.statusCode >= 300) {
        lastPrintStationPublishSucceeded = false;
        lastPrintStationPublishMessage =
            'Error ${response.statusCode}: ${response.body}';
        notifyListeners();
        debugPrint(
          'sendPrintStationHeartbeat failed ${response.statusCode}: ${response.body}',
        );
        return false;
      }
      lastPrintStationPublishSucceeded = true;
      lastPrintStationPublishMessage = canPrintComandas
          ? 'Estacion publicada para recibir comandas.'
          : 'Estacion desactivada para comandas.';
      notifyListeners();
      return true;
    } catch (e) {
      lastPrintStationPublishSucceeded = false;
      lastPrintStationPublishMessage = 'Error publicando estacion: $e';
      notifyListeners();
      debugPrint('Error sending print station heartbeat: $e');
      return false;
    }
  }

  Future<bool> publishPrintStationNow() async {
    return sendPrintStationAvailability(
      canPrintComandas: receiveRemotePrintJobs,
    );
  }

  Future<bool> enqueueRemotePrintJob(
    PrintJob job,
    String targetStationId,
  ) async {
    if (!isTerminalConfigured || terminalBranchId == null) return false;

    try {
      final response = await http
          .post(
            Uri.parse('$_printStationBaseUrl/print-jobs'),
            headers: _jsonAuthHeaders,
            body: jsonEncode({
              'id': job.id,
              'branchId': terminalBranchId,
              'targetStationId': targetStationId,
              'sourceUserId': currentUserId,
              'sourceUserName': currentUserName,
              'title': job.title,
              'details': job.details,
              'target': job.target,
              'createdAt': job.timestamp.toUtc().toIso8601String(),
            }),
          )
          .timeout(const Duration(seconds: 8));
      if (response.statusCode < 200 || response.statusCode >= 300) {
        debugPrint(
          'enqueueRemotePrintJob failed ${response.statusCode}: ${response.body}',
        );
        final failedJob = PrintJob(
          id: 'remote_failed_${job.id}',
          title: job.title,
          details: job.details,
          target: job.target,
          status: 'failed',
          timestamp: DateTime.now(),
        );
        printJobs.add(failedJob);
        notifyListeners();
        return false;
      }
      return true;
    } catch (e) {
      debugPrint('Error enqueueing remote print job: $e');
      final failedJob = PrintJob(
        id: 'remote_failed_${job.id}',
        title: job.title,
        details: job.details,
        target: job.target,
        status: 'failed',
        timestamp: DateTime.now(),
      );
      printJobs.add(failedJob);
      notifyListeners();
      return false;
    }
  }

  Future<bool> enqueueCajaPrintJob(
    PrintJob job, {
    String? preferredStationId,
    bool allowLocalFallback = true,
  }) async {
    final explicitTarget = preferredStationId?.trim();
    final targetStationId = explicitTarget != null && explicitTarget.isNotEmpty
        ? explicitTarget
        : defaultCajaPrintStationId;

    if (targetStationId != null && targetStationId.isNotEmpty) {
      final queued = await enqueueRemotePrintJob(job, targetStationId);
      if (queued) return true;
    }

    if (allowLocalFallback && hasConfiguredPrinter) {
      await enqueuePrintJob(job, forcePhysical: true);
      return job.status == 'printed';
    }

    final failedJob = PrintJob(
      id: 'unrouted_${job.id}',
      title: job.title,
      details: job.details,
      target: job.target,
      status: 'failed',
      timestamp: DateTime.now(),
    );
    printJobs.add(failedJob);
    notifyListeners();
    return false;
  }

  Future<void> pollRemotePrintJobs() async {
    if (!canAdvertisePrintStation || localStationId == null) return;

    try {
      final targetIds = <String>{
        localStationId!,
        if (branchCashierPrintQueueId != null) branchCashierPrintQueueId!,
      };
      for (final targetId in targetIds) {
        await _pollRemotePrintJobsForTarget(targetId);
      }
    } catch (e) {
      debugPrint('Error polling remote print jobs: $e');
    }
  }

  Future<void> _pollRemotePrintJobsForTarget(String targetId) async {
    try {
      final uri = Uri.parse(
        '$_printStationBaseUrl/print-jobs?branchId=$terminalBranchId&targetStationId=$targetId&status=queued',
      );
      final response = await http
          .get(uri, headers: _jsonAuthHeaders)
          .timeout(const Duration(seconds: 6));
      if (response.statusCode != 200) {
        debugPrint(
          'pollRemotePrintJobs failed ${response.statusCode}: ${response.body}',
        );
        return;
      }

      final decoded = jsonDecode(response.body);
      final List<dynamic> rawJobs =
          decoded is List ? decoded : decoded['items'] ?? [];
      for (final rawJob in rawJobs.whereType<Map>()) {
        final job = RemotePrintJob.fromJson(Map<String, dynamic>.from(rawJob));
        if (job.id.isEmpty ||
            job.targetStationId != targetId ||
            _remotePrintJobsInFlight.contains(job.id)) {
          continue;
        }
        unawaited(_processRemotePrintJob(job));
      }
    } catch (e) {
      debugPrint('Error polling remote print jobs: $e');
    }
  }

  Future<void> _processRemotePrintJob(RemotePrintJob remoteJob) async {
    _remotePrintJobsInFlight.add(remoteJob.id);
    await _updateRemotePrintJobStatus(remoteJob.id, 'printing');

    final localJob = PrintJob(
      id: 'remote_${remoteJob.id}',
      title: remoteJob.title,
      details: remoteJob.details,
      target: remoteJob.target,
      status: 'queued',
      timestamp: DateTime.now(),
    );
    printJobs.add(localJob);
    notifyListeners();

    final success = await _printToPhysicalPrinter(remoteJob.details);
    localJob.status = success ? 'printed' : 'failed';
    await _updateRemotePrintJobStatus(
        remoteJob.id, success ? 'printed' : 'failed');
    _remotePrintJobsInFlight.remove(remoteJob.id);
    notifyListeners();
  }

  Future<bool> _updateRemotePrintJobStatus(String jobId, String status) async {
    try {
      final response = await http
          .patch(
            Uri.parse('$_printStationBaseUrl/print-jobs/$jobId/status'),
            headers: _jsonAuthHeaders,
            body: jsonEncode({'status': status}),
          )
          .timeout(const Duration(seconds: 6));
      return response.statusCode >= 200 && response.statusCode < 300;
    } catch (e) {
      debugPrint('Error updating remote print job status: $e');
      return false;
    }
  }

  void _refreshPrintStationLifecycle() {
    _printStationHeartbeatTimer?.cancel();
    _remotePrintPollingTimer?.cancel();

    if (canAdvertisePrintStation) {
      unawaited(sendPrintStationHeartbeat());
      unawaited(pollRemotePrintJobs());
      _printStationHeartbeatTimer = Timer.periodic(
        const Duration(seconds: 25),
        (_) => unawaited(sendPrintStationHeartbeat()),
      );
      _remotePrintPollingTimer = Timer.periodic(
        const Duration(seconds: 8),
        (_) => unawaited(pollRemotePrintJobs()),
      );
    } else if (currentUserRole == UserRole.waiter &&
        isTerminalConfigured &&
        terminalBranchId != null) {
      unawaited(refreshOnlinePrintStations());
      _remotePrintPollingTimer = Timer.periodic(
        const Duration(seconds: 20),
        (_) => unawaited(refreshOnlinePrintStations()),
      );
    }
  }

  void _stopPrintStationLifecycle() {
    _printStationHeartbeatTimer?.cancel();
    _printStationHeartbeatTimer = null;
    _remotePrintPollingTimer?.cancel();
    _remotePrintPollingTimer = null;
    _remotePrintJobsInFlight.clear();
    onlinePrintStations = [];
  }

  String get localDeviceName => _defaultDeviceName();

  String _defaultDeviceName() {
    if (isDesktop) {
      return Platform.localHostname.isNotEmpty
          ? Platform.localHostname
          : 'Caja';
    }
    if (isMobile) return 'Terminal movil';
    return 'Terminal POS';
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
    if (!isDesktop && !kIsWeb) return false;

    try {
      connectedPrinterName = printerName;
      connectedPrinterMac = 'desktop'; // Use a marker for desktop printers
      await _secureStorageService.savePrinter('desktop', printerName);
      _refreshPrintStationLifecycle();
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
      _refreshPrintStationLifecycle();
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
        _refreshPrintStationLifecycle();
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
    if (receiveRemotePrintJobs && connectedPrinterName != null) {
      await sendPrintStationAvailability(canPrintComandas: false);
    }
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
    _refreshPrintStationLifecycle();
    notifyListeners();
  }

  Future<void> _autoConnectPrinter() async {
    try {
      printerPaperWidth =
          await _secureStorageService.getSavedPrinterPaperWidth() ?? '58mm';
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

  String _sanitizePdfText(String text) {
    return text
        .replaceAll('á', 'a')
        .replaceAll('é', 'e')
        .replaceAll('í', 'i')
        .replaceAll('ó', 'o')
        .replaceAll('ú', 'u')
        .replaceAll('ü', 'u')
        .replaceAll('ñ', 'n')
        .replaceAll('Á', 'A')
        .replaceAll('É', 'E')
        .replaceAll('Í', 'I')
        .replaceAll('Ó', 'O')
        .replaceAll('Ú', 'U')
        .replaceAll('Ü', 'U')
        .replaceAll('Ñ', 'N')
        .replaceAll('¡', '!')
        .replaceAll('¿', '?')
        .replaceAll(RegExp(r'[^\x00-\x7F]'), '');
  }

  String reformatTicketForWidth(String details, int targetWidth) {
    final lines = details.split('\n');
    final buffer = StringBuffer();
    for (final line in lines) {
      final trimmed = line.trimRight();
      if (trimmed.startsWith('---') ||
          trimmed.startsWith('===') ||
          trimmed.startsWith('***')) {
        if (trimmed.contains('---')) {
          buffer.writeln(formatDivider(width: targetWidth));
        } else {
          buffer.writeln(formatCenter(trimmed, targetWidth));
        }
      } else if (trimmed.startsWith('Fecha:') ||
          trimmed.startsWith('Mesero:') ||
          trimmed.startsWith('Atendió:') ||
          trimmed.startsWith('Estado:') ||
          trimmed.startsWith('Conectado a:')) {
        final parts = trimmed.split(':');
        if (parts.length >= 2) {
          final label = '${parts[0]}:';
          final val = parts.sublist(1).join(':').trim();
          buffer.writeln(formatRow(label, val, targetWidth));
        } else {
          buffer.writeln(trimmed);
        }
      } else {
        buffer.writeln(trimmed);
      }
    }
    return buffer.toString();
  }

  Future<bool> _printToPhysicalPrinter(String details) async {
    if (connectedPrinterMac == null) return false;
    if (connectedPrinterMac == '00:11:22:33:44:55') {
      debugPrint('Simulated Printer Print Job:\n$details');
      return true;
    }

    final currentWidth = ticketWidth;
    final reformatted = reformatTicketForWidth(details, currentWidth);
    final sanitizedDetails = _sanitizePdfText(reformatted);

    // Desktop printer (using system printers)
    if (connectedPrinterMac == 'desktop' && connectedPrinterName != null) {
      return await _printToDesktopPrinter(sanitizedDetails);
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
      final bytes =
          latin1.encode('${sanitizedDetails.trimRight()}\n\n\n\n\n').toList();
      // GS V 66 1 — feed paper to cut position then full cut
      bytes.addAll([0x1D, 0x56, 0x42, 0x01]);
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
      final currentWidth = ticketWidth;
      final reformatted = reformatTicketForWidth(details, currentWidth);
      final sanitized = _sanitizePdfText(reformatted).trimRight();

      // Calculate visual line count including word wrapping
      final rawLines = sanitized.split('\n');
      int totalVisualLines = 0;
      for (final line in rawLines) {
        if (line.isEmpty) {
          totalVisualLines += 1;
        } else {
          totalVisualLines += (line.length / currentWidth).ceil();
        }
      }

      double fontSize;
      double horizontalMargin;
      double widthMm;
      double minHeightMm;

      if (printerPaperWidth == '80mm') {
        widthMm = 80.0;
        fontSize = 8.0;
        horizontalMargin = 6.0;
        minHeightMm = 50.0; // 50mm floor for POS-80 driver threshold
      } else {
        widthMm = 58.0;
        fontSize = 7.5;
        horizontalMargin = 4.0;
        minHeightMm = 35.0; // 35mm floor for POS-58 driver threshold
      }

      // Robust overflow-proof height math:
      // fontSize * 1.35 accounts for full font ascent/descent metrics
      // +16.0pt safety buffer prevents PDF layout engine from spawning a blank Page 2
      final double lineSpacingPt = fontSize * 1.35;
      final double calculatedHeightMm =
          ((totalVisualLines * lineSpacingPt) + 16.0) * 0.352778;
      final double targetHeightMm = max(minHeightMm, calculatedHeightMm);

      final targetFormat = PdfPageFormat(
        widthMm * PdfPageFormat.mm,
        targetHeightMm * PdfPageFormat.mm,
        marginAll: 0,
      );

      pdf.addPage(
        pw.Page(
          pageFormat: targetFormat,
          margin: pw.EdgeInsets.symmetric(
            horizontal: horizontalMargin,
            vertical: 0.0,
          ),
          build: (context) {
            return pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  sanitized,
                  style: pw.TextStyle(
                    font: pw.Font.courierBold(),
                    fontWeight: pw.FontWeight.bold,
                    fontSize: fontSize,
                    lineSpacing: 1.0,
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

      debugPrint(
          'Successfully printed to desktop printer: $connectedPrinterName ($printerPaperWidth)');
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
      _updatePendingSyncCount();
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading pending sale sync jobs: $e');
    }
  }

  Future<void> _persistPendingSaleSyncJobs() async {
    _updatePendingSyncCount();
    await _secureStorageService.savePendingSaleSyncJobs(_pendingSaleSyncJobs);
    notifyListeners();
  }

  Future<void> _loadPendingOrderSyncJobs() async {
    try {
      final jobs = await _secureStorageService.getPendingOrderSyncJobs();
      _pendingOrderSyncJobs
        ..clear()
        ..addAll(jobs);
      _updatePendingSyncCount();
      notifyListeners();
    } catch (e) {
      debugPrint('Error loading pending order sync jobs: $e');
    }
  }

  Future<void> _persistPendingOrderSyncJobs() async {
    _updatePendingSyncCount();
    await _secureStorageService.savePendingOrderSyncJobs(_pendingOrderSyncJobs);
    notifyListeners();
  }

  void _updatePendingSyncCount() {
    pendingSyncCount =
        _pendingSaleSyncJobs.length + _pendingOrderSyncJobs.length;
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
            'referenceCode':
                refCode.isEmpty || refCode == 'Efectivo' ? null : refCode,
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
    if (socketConnectionState == SocketConnectionState.connected &&
        _socketService != null) {
      final orderId = payload['id']?.toString() ?? _newUuid();
      _socketService!.push(orderId, '', payload['payload'] ?? payload);
      return false; // Leave in queue until socket ack arrives
    }

    final baseUrl = terminalApiUrl ??
        configuredDefaultApiUrl;
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
    final saleSync = await _syncPendingSaleJobs();
    final orderSync = await _syncPendingOrderJobs();
    final reqSync = await syncPendingRequisitions();
    return saleSync && orderSync && reqSync;
  }

  Future<bool> syncPendingRequisitions() async {
    if (!isTerminalConfigured) return false;

    final rawList = await _secureStorageService.getPendingRequisitions();
    if (rawList.isEmpty) return true;

    final String baseUrl = terminalApiUrl ??
        configuredDefaultApiUrl;
    final token = currentJwtToken ?? await _secureStorageService.getJwtToken();

    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    final List<Map<String, dynamic>> remainingList = [];
    var allSynced = true;

    for (final map in rawList) {
      // Decode requisition
      LocalBranchRequisition req;
      try {
        req = LocalBranchRequisition.fromMap(map);
      } catch (e) {
        debugPrint('Error decoding pending requisition item: $e');
        continue;
      }

      if (req.syncState == 'synced') {
        remainingList.add(map);
        continue;
      }

      try {
        final payload = {
          'id': req.id,
          'businessId': terminalBusinessId ?? req.fromBranchId,
          'fromBranchId': req.fromBranchId,
          'toWarehouseId': req.toWarehouseId,
          'createdBy': currentUserId ?? 'operator-pos',
          'notes': req.notes,
          'items': req.items
              .map((i) => {
                    'productId': i.productId,
                    'quantityRequested': i.quantityRequested,
                  })
              .toList(),
        };

        final response = await http
            .post(
              Uri.parse('$baseUrl/requisitions'),
              headers: headers,
              body: jsonEncode(payload),
            )
            .timeout(const Duration(seconds: 8));

        if (response.statusCode >= 200 && response.statusCode < 300) {
          final updatedReq = LocalBranchRequisition(
            id: req.id,
            fromBranchId: req.fromBranchId,
            toWarehouseId: req.toWarehouseId,
            status: req.status,
            notes: req.notes,
            createdAt: req.createdAt,
            syncState: 'synced',
            items: req.items,
          );
          remainingList.add(updatedReq.toMap());
        } else {
          debugPrint(
              'Failed to sync requisition ${req.id}: ${response.statusCode} ${response.body}');
          allSynced = false;
          final failedReq = LocalBranchRequisition(
            id: req.id,
            fromBranchId: req.fromBranchId,
            toWarehouseId: req.toWarehouseId,
            status: req.status,
            notes: req.notes,
            createdAt: req.createdAt,
            syncState: 'failed',
            items: req.items,
          );
          remainingList.add(failedReq.toMap());
        }
      } catch (e) {
        debugPrint('Error syncing requisition: $e');
        allSynced = false;
        final failedReq = LocalBranchRequisition(
          id: req.id,
          fromBranchId: req.fromBranchId,
          toWarehouseId: req.toWarehouseId,
          status: req.status,
          notes: req.notes,
          createdAt: req.createdAt,
          syncState: 'failed',
          items: req.items,
        );
        remainingList.add(failedReq.toMap());
      }
    }

    await _secureStorageService.savePendingRequisitions(remainingList);
    notifyListeners();
    return allSynced;
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
      final roles = _parseRoles(operator['roles'], operator['role']);
      final id = operator['id']?.toString();
      if (!roles.contains(currentUserRole) || !_isUuid(id)) {
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

  // Format helpers for thermal printer (50/58mm = 32 cols, 80mm = 48 cols)
  String formatCenter(String text, [int? width]) {
    final w = width ?? ticketWidth;
    final trimmed = text.trim();
    if (trimmed.length >= w) return trimmed.substring(0, w);
    final leftPadding = (w - trimmed.length) ~/ 2;
    return ' ' * leftPadding + trimmed;
  }

  String formatCenterLines(String text, [int? width]) {
    final w = width ?? ticketWidth;
    return '${_wrapText(text, w).map((line) => formatCenter(line, w)).join('\n')}\n';
  }

  String formatRow(String left, String right, [int? width]) {
    final w = width ?? ticketWidth;
    if (left.length + right.length >= w) {
      final allowedLeftWidth = w - right.length - 1;
      if (allowedLeftWidth > 0) {
        left = left.substring(0, allowedLeftWidth);
      } else {
        return right.substring(0, min(right.length, w));
      }
    }
    final padding = w - left.length - right.length;
    return left + ' ' * padding + right;
  }

  String formatDivider({String char = '-', int? width}) {
    final w = width ?? ticketWidth;
    return char * w;
  }

  List<String> _wrapText(String text, [int? width]) {
    final w = width ?? ticketWidth;
    final lines = <String>[];
    for (final rawLine in text.split('\n')) {
      final words = rawLine.trim().split(RegExp(r'\s+'));
      var current = '';
      for (final word in words.where((word) => word.isNotEmpty)) {
        if (word.length > w) {
          if (current.isNotEmpty) {
            lines.add(current);
            current = '';
          }
          for (var i = 0; i < word.length; i += w) {
            lines.add(word.substring(i, min(i + w, word.length)));
          }
          continue;
        }

        final candidate = current.isEmpty ? word : '$current $word';
        if (candidate.length <= w) {
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

  // WebSocket Integration Methods

  void _initWebSocket() {
    _socketService?.dispose();

    final String baseUrl = terminalApiUrl ??
        configuredDefaultApiUrl;
    final token = currentJwtToken;
    final branchId = terminalBranchId;
    final roleStr = currentUserRole == UserRole.waiter
        ? 'waiter'
        : currentUserRole == UserRole.cashier
            ? 'cashier'
            : currentUserRole == UserRole.kitchen
                ? 'kitchen'
                : currentUserRole == UserRole.encargado
                    ? 'encargado'
                    : currentUserRole == UserRole.responsable
                        ? 'responsable'
                        : 'none';

    if (token == null || branchId == null || roleStr == 'none') {
      debugPrint(
          'Skipping WebSocket init: missing credentials (token: ${token != null}, branchId: $branchId, role: $roleStr)');
      return;
    }

    _socketService = SyncSocketService(
      apiUrl: baseUrl,
      token: token,
      branchId: branchId,
      role: roleStr,
      onBroadcastChangeReceived: (data) {
        _handleWebSocketChange(data);
      },
      onResyncChangesReceived: (changes, serverTime) {
        _handleWebSocketResync(changes, serverTime);
      },
      onAckReceived: (clientUuid, versionEn) {
        _handleWebSocketAck(clientUuid, versionEn);
      },
      onStateChanged: (state) {
        socketConnectionState = state;
        if (state == SocketConnectionState.connected) {
          isOnline = true;
          _fallbackPollingTimer?.cancel();
          _triggerResync();
          unawaited(_syncPendingSaleJobs());
          unawaited(_syncPendingOrderJobs());
        } else {
          _startFallbackPolling();
        }
        notifyListeners();
      },
    );

    _socketService!.connect();
  }

  void _handleWebSocketChange(Map<String, dynamic> data) {
    final changes = data['changes'] as List<dynamic>?;
    if (changes == null) return;

    bool stateChanged = false;
    for (final change in changes) {
      if (change is! Map<String, dynamic>) continue;
      final entity = change['entity']?.toString();
      final entityId = change['entityId']?.toString();
      final payload = change['payload'];

      if (entity == 'branchTables' && payload is Map) {
        final tableIndex = tables.indexWhere((t) => t.remoteId == entityId);
        if (tableIndex != -1) {
          final newStateStr = payload['state']?.toString();
          if (newStateStr != null) {
            final newState = _parseTableState(newStateStr);
            final isLocallyClosedPaidOrder = entityId != null &&
                _locallyClosedPaidOrderIdsByTableRemoteId.containsKey(entityId);
            if (isLocallyClosedPaidOrder &&
                newState != TableState.free &&
                newState != TableState.cleaning) {
              continue;
            }
            if (isLocallyClosedPaidOrder) {
              _locallyClosedPaidOrderIdsByTableRemoteId.remove(entityId);
            }
            tables[tableIndex].state = newState;
            if (newState == TableState.free ||
                newState == TableState.cleaning) {
              tables[tableIndex].items = [];
              tables[tableIndex].guests = 0;
              tables[tableIndex].discountPercentage = 0;
              tables[tableIndex].guestGenders = const ['M'];
            }
            stateChanged = true;
          }
        }
      } else if (entity == 'orders' && payload is Map) {
        final tableId = payload['tableId']?.toString();
        final orderId = payload['id']?.toString();
        final orderState = payload['state']?.toString();

        if (tableId != null && orderId != null) {
          final locallyClosedOrderId =
              _locallyClosedPaidOrderIdsByTableRemoteId[tableId];
          if (locallyClosedOrderId == orderId && orderState != 'closed') {
            continue;
          }
          if (locallyClosedOrderId != null && locallyClosedOrderId != orderId) {
            _locallyClosedPaidOrderIdsByTableRemoteId.remove(tableId);
          }

          if (orderState == 'closed') {
            _activeOrderIdsByTableRemoteId.remove(tableId);
            final tableIndex = tables.indexWhere((t) => t.remoteId == tableId);
            if (tableIndex != -1) {
              tables[tableIndex].items = [];
              tables[tableIndex].state =
                  (tables[tableIndex].zone == 'Para Llevar')
                      ? TableState.free
                      : TableState.cleaning;
              stateChanged = true;
            }
          } else {
            _activeOrderIdsByTableRemoteId[tableId] = orderId;
            stateChanged = true;
          }
        }
      } else if (entity == 'kitchenOrders') {
        _scheduleKitchenSyncFromWebSocket();
      }
    }

    if (stateChanged) {
      notifyListeners();
    }

    // Background pull sync to ensure operational data is 100% up to date
    unawaited(syncActiveOrders(notify: false));
    unawaited(syncTableStates(notify: false));
  }

  void _handleWebSocketResync(List<dynamic> changes, String serverTime) {
    if (changes.isNotEmpty) {
      _handleWebSocketChange({'changes': changes});
    }
    _secureStorageService.saveSyncCheckpoint(serverTime);
  }

  void _handleWebSocketAck(String clientUuid, String versionEn) {
    _pendingSaleSyncJobs.removeWhere((job) => job['id'] == clientUuid);
    _persistPendingSaleSyncJobs();
  }

  void _triggerResync() async {
    final lastCheckpoint = await _secureStorageService.getSyncCheckpoint() ??
        DateTime.now()
            .subtract(const Duration(days: 1))
            .toUtc()
            .toIso8601String();
    _socketService?.triggerResync(lastCheckpoint);
  }

  void disconnectWebSocket() {
    _socketService?.dispose();
    _socketService = null;
    socketConnectionState = SocketConnectionState.disconnected;
    _fallbackPollingTimer?.cancel();
    _fallbackPollingTimer = null;
    notifyListeners();
  }

  void _startFallbackPolling() {
    if (_fallbackPollingTimer?.isActive == true) return;
    _fallbackPollingTimer?.cancel();

    _fallbackPollingTimer =
        Timer.periodic(const Duration(seconds: 30), (timer) async {
      if (socketConnectionState == SocketConnectionState.connected) {
        timer.cancel();
        return;
      }
      debugPrint('WebSocket offline - executing REST fallback polling...');
      try {
        bool syncSucceeded = true;
        if (currentUserRole == UserRole.kitchen) {
          syncSucceeded = await syncKitchenOrders();
        } else {
          syncSucceeded =
              await syncActiveOrders(notify: false) && syncSucceeded;
          syncSucceeded = await syncTableStates(notify: false) && syncSucceeded;
          if (currentUserRole == UserRole.waiter) {
            syncSucceeded = await syncKitchenOrders() && syncSucceeded;
            syncSucceeded = await _syncPendingOrderJobs() && syncSucceeded;
          }
        }
        isOnline = syncSucceeded;
        notifyListeners();
      } catch (e) {
        debugPrint('REST fallback polling failed: $e');
        isOnline = false;
        notifyListeners();
      }
    });
  }

  void _scheduleKitchenSyncFromWebSocket() {
    _kitchenSyncRetryTimer?.cancel();

    syncKitchenOrders().then((success) {
      if (success) {
        _kitchenSyncRetryCount = 0;
        lastSyncError = null;
      } else {
        throw Exception('syncKitchenOrders returned false');
      }
    }).catchError((e) {
      debugPrint(
          '❌ WebSocket kitchen sync failed (attempt ${_kitchenSyncRetryCount + 1}/3): $e');
      if (_kitchenSyncRetryCount < 3) {
        final delay = Duration(seconds: 2 * (_kitchenSyncRetryCount + 1));
        debugPrint('⏳ Retrying kitchen sync in ${delay.inSeconds}s...');
        _kitchenSyncRetryTimer = Timer(delay, () {
          _kitchenSyncRetryCount++;
          _scheduleKitchenSyncFromWebSocket();
        });
      } else {
        debugPrint('⛔ Kitchen sync failed after 3 retries, giving up');
        if (lastSyncError != null) {
          lastSyncError = 'Kitchen sync failed after 3 retries\n$lastSyncError';
        }
        isOnline = false;
        _kitchenSyncRetryCount = 0;
        notifyListeners();
      }
    });
  }

  bool _isDisposed = false;

  @override
  void notifyListeners() {
    if (_isDisposed) return;
    super.notifyListeners();
  }

  @override
  void dispose() {
    _isDisposed = true;
    _stopPrintStationLifecycle();
    _fallbackPollingTimer?.cancel();
    _kitchenSyncRetryTimer?.cancel();
    _socketService?.dispose();
    super.dispose();
  }
}
