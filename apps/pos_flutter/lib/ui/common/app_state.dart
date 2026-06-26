import 'dart:math';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';
import '../../services/secure_storage_service.dart';

enum TableState { free, occupied, billing, cleaning }

enum TableShape { circle, square }

enum UserRole { waiter, cashier, kitchen, none }

class TableModel {
  final int id;
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

  double get subtotal => items.fold(0.0, (sum, item) => sum + item.totalPrice);
  double get discountAmount => subtotal * (discountPercentage / 100.0);
  double get total => subtotal - discountAmount;

  TableModel copyWith({
    TableState? state,
    List<OrderItem>? items,
    int? guests,
    double? discountPercentage,
    List<String>? guestGenders,
  }) {
    return TableModel(
      id: id,
      label: label,
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

  double get totalPrice => (item.price + (modifiers.length * 1.5)) * quantity;

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

class AppState extends ChangeNotifier {
  UserRole currentUserRole = UserRole.none;
  String currentUserName = "";

  // Tables state
  List<TableModel> tables = [];

  // Kitchen orders
  List<KitchenOrder> kitchenOrders = [];

  // Printer Queue
  List<PrintJob> printJobs = [];

  // Shift controls (Cashier)
  bool isShiftOpen = false;
  double cashDrawerAmount = 0.0;

  // Offline & sync states
  bool isOnline = true;
  int pendingSyncCount = 0;

  // Notification queue (for alerts on waiter screen)
  List<String> readyNotifications = [];

  // Active table selected in Waiter / Cashier views
  TableModel? selectedTable;

  // Bluetooth printer connection state
  String? connectedPrinterMac;
  String? connectedPrinterName;
  bool isConnectingPrinter = false;

  final SecureStorageService _secureStorageService;

  AppState({SecureStorageService? secureStorageService})
    : _secureStorageService = secureStorageService ?? SecureStorageService() {
    _initMockData();
    _seedDefaultUsersOffline();
    _autoConnectPrinter();
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

  // Predefined Menu Items
  static const List<MenuItem> menu = [
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
      // Android emulators use 10.0.2.2 to access the host machine's localhost
      final String host = Platform.isAndroid ? '10.0.2.2' : 'localhost';
      final response = await http
          .post(
            Uri.parse('http://$host:3000/api/auth/login'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'pin': pin}),
          )
          .timeout(const Duration(seconds: 2));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          final userData = data['user'];
          currentUserName = userData['name'];
          currentUserRole = _parseRole(userData['role']);

          // Securely cache credentials locally
          await _secureStorageService.cacheUserOffline(
            name: userData['name'],
            pin: pin,
            role: userData['role'],
          );

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
        currentUserName = offlineUser['name']!;
        currentUserRole = _parseRole(offlineUser['role']!);
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
  void openShift(double initialFloat) {
    isShiftOpen = true;
    cashDrawerAmount = initialFloat;
    notifyListeners();
  }

  void closeShift() {
    isShiftOpen = false;
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
          
          final kitchenItems = newItems.where((i) => i.item.category != 'Bebidas');
          for (final item in kitchenItems) {
            buffer.writeln('${item.quantity}x ${item.item.name}');
            if (item.assignedGuest != null) {
              final guest = item.assignedGuest!;
              final displayGuest = guest.startsWith('P') ? 'Persona ${guest.substring(1)}' : guest;
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
              final displayGuest = guest.startsWith('P') ? 'Persona ${guest.substring(1)}' : guest;
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
      }

      if (!isOnline) {
        pendingSyncCount++;
      }

      notifyListeners();
    }
  }

  // Mark Table as ready for billing
  void requestBilling(int tableId) {
    final index = tables.indexWhere((t) => t.id == tableId);
    if (index != -1) {
      tables[index].state = TableState.billing;
      notifyListeners();
    }
  }

  // Checkout process
  void checkoutTable(
    int tableId, {
    required double discount,
    required String paymentMethod,
    required String refCode,
  }) {
    final index = tables.indexWhere((t) => t.id == tableId);
    if (index != -1) {
      final t = tables[index];
      t.discountPercentage = discount;

      // Calculate total
      double finalTotal = t.total;

      // Add to cash drawer if paid in cash
      if (paymentMethod.toLowerCase() == 'efectivo') {
        cashDrawerAmount += finalTotal;
      }

      // Print ticket
      final buffer = StringBuffer();
      buffer.writeln(formatCenter('=== COMPROBANTE DE PAGO ==='));
      buffer.writeln(formatCenter('GRUPO CACHARELO'));
      buffer.writeln(formatCenter(t.label));
      final dateStr = DateTime.now().toString().substring(0, 16);
      buffer.writeln(formatRow('Fecha:', dateStr));
      buffer.writeln(formatRow('Cajero:', currentUserName));
      buffer.writeln(formatDivider());
      buffer.writeln(formatRow('Metodo:', paymentMethod.toUpperCase()));
      if (refCode.isNotEmpty && refCode != 'Efectivo') {
        buffer.writeln(formatRow('Referencia:', refCode));
      }
      buffer.writeln(formatDivider());
      buffer.writeln(formatRow('Cant Descripcion', 'Total'));
      buffer.writeln(formatDivider());
      for (final item in t.items) {
        final line = '${item.quantity}x ${item.item.name}';
        final priceStr = '\$${item.totalPrice.toStringAsFixed(2)}';
        buffer.writeln(formatRow(line, priceStr));
        if (item.modifiers.isNotEmpty) {
          buffer.writeln('   + ${item.modifiers.join(', ')}');
        }
      }
      buffer.writeln(formatDivider());
      buffer.writeln(formatRow('Subtotal:', '\$${t.subtotal.toStringAsFixed(2)}'));
      if (discount > 0) {
        final discAmt = t.subtotal * (discount / 100.0);
        buffer.writeln(formatRow('Desc (${discount.toInt()}%):', '-\$${discAmt.toStringAsFixed(2)}'));
      }
      final tax = (t.subtotal - (t.subtotal * (discount / 100.0))) * 0.16;
      buffer.writeln(formatRow('IVA (16%):', '\$${tax.toStringAsFixed(2)}'));
      buffer.writeln(formatDivider(char: '='));
      buffer.writeln(formatRow('TOTAL PAGADO:', '\$${finalTotal.toStringAsFixed(2)}'));
      buffer.writeln(formatDivider(char: '='));
      buffer.writeln('');
      buffer.writeln(formatCenter('GRACIAS POR SU COMPRA'));

      enqueuePrintJob(
        PrintJob(
          id: 'rec_${DateTime.now().millisecondsSinceEpoch}',
          title: 'Factura - ${t.label}',
          details: buffer.toString(),
          target: 'Caja',
          timestamp: DateTime.now(),
        ),
      );

      // Reset Table
      t.state = TableState.cleaning;
      t.items = [];
      t.guests = 0;
      t.discountPercentage = 0;

      if (!isOnline) {
        pendingSyncCount++;
      }

      notifyListeners();
    }
  }

  // Clean table (from cleaning to free)
  void finishCleaning(int tableId) {
    final index = tables.indexWhere((t) => t.id == tableId);
    if (index != -1) {
      tables[index].state = TableState.free;
      notifyListeners();
    }
  }

  // Kitchen Order operations
  void updateKitchenOrderStatus(String orderId, String newStatus) {
    final index = kitchenOrders.indexWhere((o) => o.id == orderId);
    if (index != -1) {
      kitchenOrders[index].status = newStatus;

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
      final success = await PrintBluetoothThermal.connect(macPrinterAddress: mac);
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
    if (connectedPrinterMac != '00:11:22:33:44:55') {
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
        if (mac == '00:11:22:33:44:55') {
          connectedPrinterMac = mac;
          connectedPrinterName = name;
          notifyListeners();
          return;
        }
        final success = await PrintBluetoothThermal.connect(macPrinterAddress: mac);
        if (success) {
          connectedPrinterMac = mac;
          connectedPrinterName = name;
          notifyListeners();
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
    try {
      final isConnected = await PrintBluetoothThermal.connectionStatus;
      if (!isConnected) {
        final reconnected = await PrintBluetoothThermal.connect(macPrinterAddress: connectedPrinterMac!);
        if (!reconnected) return false;
      }
      final bytes = latin1.encode(details + '\n\n\n\n').toList();
      return await PrintBluetoothThermal.writeBytes(bytes);
    } catch (e) {
      debugPrint('Error printing to physical printer: $e');
      return false;
    }
  }

  Future<void> enqueuePrintJob(PrintJob job, {bool forcePhysical = false}) async {
    printJobs.add(job);
    notifyListeners();

    if (connectedPrinterMac != null && (job.target == 'Caja' || forcePhysical)) {
      job.status = 'queued';
      notifyListeners();
      final success = await _printToPhysicalPrinter(job.details);
      job.status = success ? 'printed' : 'failed';
    } else {
      job.status = isOnline ? 'printed' : 'failed';
    }
    notifyListeners();
  }

  // Sync operations manually triggered
  void syncOfflineTransactions() {
    if (isOnline) {
      pendingSyncCount = 0;
      notifyListeners();
    }
  }

  // Format helpers for 58mm thermal printer (32 columns max)
  String formatCenter(String text, {int width = 32}) {
    if (text.length >= width) return text.substring(0, width);
    final leftPadding = (width - text.length) ~/ 2;
    final rightPadding = width - text.length - leftPadding;
    return ' ' * leftPadding + text + ' ' * rightPadding;
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
}
