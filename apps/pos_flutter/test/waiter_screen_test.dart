import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:pos_flutter/services/secure_storage_service.dart';
import 'package:pos_flutter/ui/common/app_state.dart';
import 'package:pos_flutter/ui/waiter/waiter_ordering_screen.dart';

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
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets(
    'WaiterOrderingScreen renders tables and info sidebar without crashing',
    (WidgetTester tester) async {
      late AppState state;
      await tester.runAsync(() async {
        state = AppState();
        await state.initializationFuture;
      });
      // Force waiter role
      state.currentUserRole = UserRole.waiter;
      state.currentUserName = 'Juan (Mesero)';

      // Set screen size to a typical tablet layout to avoid overflow in tests
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1.0;

      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: NoSplash.splashFactory,
          ),
          home: WaiterOrderingScreen(state: state),
        ),
      );
      await tester.pump(const Duration(milliseconds: 300));

      // Verify header exists (icon-only controls)
      expect(find.byIcon(Icons.table_bar), findsOneWidget);
      expect(find.byIcon(Icons.settings), findsOneWidget);

      // Toggle info sidebar open to verify elements
      await tester.tap(find.byIcon(Icons.help_outline));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Estado de Sala'), findsOneWidget);
      expect(find.text('Mesas Libres'), findsOneWidget);

      // Open zone popup menu to verify zones exist
      await tester.tap(find.text('Salón Principal'));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Salón Principal'),
          findsNWidgets(2)); // Header + popup item
      expect(find.text('Terraza'), findsOneWidget);
      expect(find.text('Bar'), findsOneWidget);
      // Close popup by tapping outside
      await tester.tapAt(const Offset(10, 10));
      await tester.pump(const Duration(milliseconds: 300));

      // Verify that tables in the default zone are rendered
      expect(find.text('Mesa 1'), findsOneWidget);
      expect(find.text('Mesa 2'), findsOneWidget);

      // Reset view size
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    },
  );

  testWidgets('WaiterOrderingScreen full-screen cart flow test', (
    WidgetTester tester,
  ) async {
    final state = AppState();
    state.currentUserRole = UserRole.waiter;
    state.currentUserName = 'Juan (Mesero)';

    // Use typical landscape tablet resolution
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1.0;

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(
          useMaterial3: true,
          splashFactory: NoSplash.splashFactory,
        ),
        home: WaiterOrderingScreen(state: state),
      ),
    );

    // 1. Select Mesa 1
    await tester.tap(find.text('Mesa 1'));
    await tester.pumpAndSettle();

    // Verify ordering screen loads
    expect(find.text('MESA 1'), findsOneWidget);
    expect(find.text('VER COMANDA (0) - \$0.00'), findsOneWidget);

    // 2. Select an item (Lasagna Bolognesa)
    expect(find.text('Lasagna Bolognesa'), findsOneWidget);
    await tester.tap(find.text('Lasagna Bolognesa'));
    await tester.pumpAndSettle();

    // Verify modifier dialog opens
    expect(find.text('Cantidad'), findsOneWidget);
    expect(find.text('AGREGAR ÍTEM'), findsOneWidget);

    // 3. Confirm adding item to comanda
    await tester.tap(find.text('AGREGAR ÍTEM'));
    await tester.pumpAndSettle();

    // Verify FAB count and total updated
    expect(find.text('VER COMANDA (1) - \$18.50'), findsOneWidget);

    // 4. Tap FAB to open full-screen cart
    await tester.tap(find.text('VER COMANDA (1) - \$18.50'));
    await tester.pumpAndSettle();

    // Verify full screen cart features
    expect(find.text('MESA 1'), findsOneWidget);
    expect(find.text('Lasagna Bolognesa'), findsOneWidget);
    expect(find.text('TOTAL DE COMANDA'), findsOneWidget);
    expect(find.text('\$18.50'), findsAtLeastNWidgets(1));

    // 5. Confirm order
    expect(find.text('CONFIRMAR PEDIDO'), findsOneWidget);
    await tester.tap(find.text('CONFIRMAR PEDIDO'));
    await tester.pumpAndSettle();

    // Verify dialog is shown and confirm order
    expect(find.text('Confirmar Envío'), findsOneWidget);
    expect(find.text('ENVIAR COMANDA (SIN IMPRIMIR)'), findsOneWidget);
    await tester.tap(find.text('ENVIAR COMANDA (SIN IMPRIMIR)'));

    // Use pump instead of pumpAndSettle to avoid timing out on SnackBar duration
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Verify order is submitted and we're back to tables layout
    expect(find.byIcon(Icons.table_bar), findsOneWidget);
    expect(find.text('Mesa 1'), findsOneWidget);

    // Reset view size
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  testWidgets(
    'WaiterOrderingScreen guest selector and seat-based ordering test',
    (WidgetTester tester) async {
      final state = AppState();
      state.currentUserRole = UserRole.waiter;
      state.currentUserName = 'Juan (Mesero)';

      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1.0;

      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: NoSplash.splashFactory,
          ),
          home: WaiterOrderingScreen(state: state),
        ),
      );

      // 1. Tap Mesa 1
      await tester.tap(find.text('Mesa 1'));
      await tester.pumpAndSettle();

      // 2. Verify default guest P1 exists
      expect(find.text('P1'), findsOneWidget);
      expect(find.text('👨'), findsOneWidget); // Default male emoji for P1

      // 3. Add guest P2
      await tester.tap(find.text('Pax'));
      await tester.pumpAndSettle();

      // Verify P2 is added
      expect(find.text('P2'), findsOneWidget);

      // 4. Tap on P2 again to cycle gender from Male ('M' -> 👨) to Female ('F' -> 👩)
      await tester.tap(find.text('P2'));
      await tester.pumpAndSettle();

      // Let's verify female emoji 👩 is rendered on the screen
      expect(find.text('👩'), findsOneWidget);

      // 5. Select P1 as active guest
      await tester.tap(find.text('P1'));
      await tester.pumpAndSettle();

      // Now tap Lasagna Bolognesa to add it for P1
      await tester.tap(find.text('Lasagna Bolognesa'));
      await tester.pumpAndSettle();

      // In modifier dialog, verify P1 is selected
      expect(find.text('P1 👨'), findsOneWidget);
      await tester.tap(find.text('AGREGAR ÍTEM'));
      await tester.pumpAndSettle();

      // Select P2 as active guest
      await tester.tap(find.text('P2'));
      await tester.pumpAndSettle();

      // Tap Fettuccine Alfredo to add it for P2
      await tester.tap(find.text('Fettuccine Alfredo'));
      await tester.pumpAndSettle();

      // In modifier dialog, verify P2 is selected
      expect(find.text('P2 👩'), findsOneWidget);
      await tester.tap(find.text('AGREGAR ÍTEM'));
      await tester.pumpAndSettle();

      // Verify FAB count and total updated (18.50 + 16.00 = 34.50)
      expect(find.text('VER COMANDA (2) - \$34.50'), findsOneWidget);

      // Tap FAB to open cart
      await tester.tap(find.text('VER COMANDA (2) - \$34.50'));
      await tester.pumpAndSettle();

      // Verify guest badges in cart items
      expect(find.text('P1 👨'), findsOneWidget);
      expect(find.text('P2 👩'), findsOneWidget);

      // Reset view size
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    },
  );

  testWidgets('WaiterOrderingScreen remove guest dialog test', (
    WidgetTester tester,
  ) async {
    final state = AppState();
    state.currentUserRole = UserRole.waiter;
    state.currentUserName = 'Juan (Mesero)';

    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1.0;

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(
          useMaterial3: true,
          splashFactory: NoSplash.splashFactory,
        ),
        home: WaiterOrderingScreen(state: state),
      ),
    );

    // 1. Tap Mesa 1
    await tester.tap(find.text('Mesa 1'));
    await tester.pumpAndSettle();

    // 2. Add guest P2
    await tester.tap(find.text('Pax'));
    await tester.pumpAndSettle();

    // Select P2 as active guest
    await tester.tap(find.text('P2'));
    await tester.pumpAndSettle();

    // Add an item (Lasagna Bolognesa) for P2
    await tester.tap(find.text('Lasagna Bolognesa'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('AGREGAR ÍTEM'));
    await tester.pumpAndSettle();

    // 3. Attempt to remove guest P2 (which has orders)
    await tester.tap(find.byIcon(Icons.remove));
    await tester.pumpAndSettle();

    // 4. Verify warning modal is shown
    expect(find.text('Quitar Comensal P2'), findsOneWidget);
    expect(find.text('ELIMINAR PEDIDOS'), findsOneWidget);
    expect(find.text('CANCELAR'), findsOneWidget);

    // 5. Select "Reassign to P1" (ChoiceChip/ActionChip label is P1 👨)
    expect(find.text('P1 👨'), findsOneWidget);
    await tester.tap(find.text('P1 👨'));
    await tester.pumpAndSettle();

    // Verify guest P2 is removed
    expect(find.text('P2'), findsNothing);

    // Tap to view cart
    await tester.tap(find.text('VER COMANDA (1) - \$18.50'));
    await tester.pumpAndSettle();

    // Verify Lasagna is now assigned to P1 👨
    expect(find.text('P1 👨'), findsOneWidget);

    // Reset view size
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  testWidgets('WaiterOrderingScreen request billing (Por Cobrar) flow test', (
    WidgetTester tester,
  ) async {
    final state = AppState();
    state.currentUserRole = UserRole.waiter;
    state.currentUserName = 'Juan (Mesero)';

    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1.0;

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(
          useMaterial3: true,
          splashFactory: NoSplash.splashFactory,
        ),
        home: WaiterOrderingScreen(state: state),
      ),
    );

    // 1. Tap Mesa 5 (Occupied Table)
    await tester.tap(find.text('Mesa 5'));
    await tester.pumpAndSettle();

    // 2. Open Cart Sidebar
    await tester.tap(find.textContaining('VER COMANDA'));
    await tester.pumpAndSettle();

    // 3. Verify COBRAR CUENTA button is visible
    expect(find.text('COBRAR CUENTA'), findsOneWidget);

    // 4. Tap COBRAR CUENTA
    await tester.tap(find.text('COBRAR CUENTA'));
    await tester.pumpAndSettle();

    // 4b. Dialog is shown, tap "IMPRIMIR TICKET" to choose Cash (Efectivo) flow
    expect(find.text('IMPRIMIR TICKET'), findsOneWidget);
    await tester.tap(find.text('IMPRIMIR TICKET'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    // 5. Verify we are back to floor map
    expect(find.byIcon(Icons.table_bar), findsOneWidget);
    expect(find.text('Mesa 5'), findsOneWidget);

    // Verify table state is billing
    final table5 = state.tables.firstWhere((t) => t.label == 'Mesa 5');
    expect(table5.state, TableState.billing);

    // Reset view size
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  testWidgets(
    'WaiterOrderingScreen does not double-print already sent items flow test',
    (WidgetTester tester) async {
      final fakeStorage = FakeSecureStorage();
      final secureStorageService = SecureStorageService(
        secureStorage: fakeStorage,
      );
      final state = AppState(secureStorageService: secureStorageService);
      state.currentUserRole = UserRole.waiter;
      state.currentUserName = 'Juan (Mesero)';
      await state.connectToPrinter('00:11:22:33:44:55', 'Test Printer');

      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1.0;

      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            splashFactory: NoSplash.splashFactory,
          ),
          home: WaiterOrderingScreen(state: state),
        ),
      );

      // 1. Select Mesa 1
      await tester.tap(find.text('Mesa 1'));
      await tester.pumpAndSettle();

      // 2. Add Lasagna Bolognesa for P1
      await tester.tap(find.text('Lasagna Bolognesa'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('AGREGAR ÍTEM'));
      await tester.pumpAndSettle();

      // 3. Confirm order first time
      await tester.tap(find.textContaining('VER COMANDA'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('CONFIRMAR PEDIDO'));
      await tester.pumpAndSettle();
      expect(find.text('Confirmar Envío'), findsOneWidget);
      expect(find.text('ENVIAR E IMPRIMIR COMANDA'), findsOneWidget);
      await tester.tap(find.text('ENVIAR E IMPRIMIR COMANDA'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // Verify print job is created for Lasagna
      expect(state.printJobs.length, 1);
      expect(state.printJobs.first.details, contains('Lasagna Bolognesa'));

      // Clear print jobs to isolate the next confirmation
      state.printJobs.clear();

      // 4. Select Mesa 1 again
      await tester.tap(find.text('Mesa 1'));
      await tester.pumpAndSettle();

      // 5. Add Fettuccine Alfredo for P1
      await tester.tap(find.text('Fettuccine Alfredo'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('AGREGAR ÍTEM'));
      await tester.pumpAndSettle();

      // 6. Confirm order second time
      await tester.tap(find.textContaining('VER COMANDA'));
      await tester.pumpAndSettle();

      // Verify both items are in the cart list
      expect(find.text('Lasagna Bolognesa'), findsOneWidget);
      expect(find.text('Fettuccine Alfredo'), findsOneWidget);

      await tester.tap(find.text('CONFIRMAR PEDIDO'));
      await tester.pumpAndSettle();
      expect(find.text('Confirmar Envío'), findsOneWidget);
      expect(find.text('ENVIAR E IMPRIMIR COMANDA'), findsOneWidget);
      await tester.tap(find.text('ENVIAR E IMPRIMIR COMANDA'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // 7. Verify print job is created ONLY for the new item (Fettuccine Alfredo) and NOT Lasagna
      expect(state.printJobs.length, 1);
      expect(state.printJobs.first.details, contains('Fettuccine Alfredo'));
      expect(
        state.printJobs.first.details,
        isNot(contains('Lasagna Bolognesa')),
      );

      // Reset view size
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    },
  );

  testWidgets('WaiterOrderingScreen Enviar e Imprimir comanda flow test', (
    WidgetTester tester,
  ) async {
    final fakeStorage = FakeSecureStorage();
    final secureStorageService = SecureStorageService(
      secureStorage: fakeStorage,
    );
    final state = AppState(secureStorageService: secureStorageService);
    state.currentUserRole = UserRole.waiter;
    state.currentUserName = 'Juan (Mesero)';
    await state.connectToPrinter('00:11:22:33:44:55', 'Test Printer');

    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1.0;

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(
          useMaterial3: true,
          splashFactory: NoSplash.splashFactory,
        ),
        home: WaiterOrderingScreen(state: state),
      ),
    );

    // Select Mesa 1
    await tester.tap(find.text('Mesa 1'));
    await tester.pumpAndSettle();

    // Add Lasagna Bolognesa
    await tester.tap(find.text('Lasagna Bolognesa'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('AGREGAR ÍTEM'));
    await tester.pumpAndSettle();

    // Confirm order with printing
    await tester.tap(find.textContaining('VER COMANDA'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('CONFIRMAR PEDIDO'));
    await tester.pumpAndSettle();

    expect(find.text('Confirmar Envío'), findsOneWidget);
    expect(find.text('ENVIAR E IMPRIMIR COMANDA'), findsOneWidget);
    await tester.tap(find.text('ENVIAR E IMPRIMIR COMANDA'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Verify print job is created and marked as printed (since printer is connected and forcePhysical: true)
    expect(state.printJobs.length, 1);
    expect(state.printJobs.first.details, contains('Lasagna Bolognesa'));
    expect(state.printJobs.first.details, contains('Mesa 1'));
    expect(state.printJobs.first.details, contains('Persona 1'));
    expect(state.printJobs.first.status, 'printed');

    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  testWidgets(
      'WaiterOrderingScreen table checkout/cleaning and reuse clears cart items',
      (
    WidgetTester tester,
  ) async {
    final state = AppState();
    state.currentUserRole = UserRole.waiter;
    state.currentUserName = 'Juan (Mesero)';

    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1.0;

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(
          useMaterial3: true,
          splashFactory: NoSplash.splashFactory,
        ),
        home: WaiterOrderingScreen(state: state),
      ),
    );

    // 1. Select Mesa 1
    await tester.tap(find.text('Mesa 1'));
    await tester.pumpAndSettle();

    // 2. Add Lasagna Bolognesa
    await tester.tap(find.text('Lasagna Bolognesa'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('AGREGAR ÍTEM'));
    await tester.pumpAndSettle();

    // 3. Confirm/Submit order
    await tester.tap(find.textContaining('VER COMANDA'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('CONFIRMAR PEDIDO'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('ENVIAR COMANDA (SIN IMPRIMIR)'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Mesa 1 is now occupied. Let's verify it has 1 item.
    final table1 = state.tables.firstWhere((t) => t.label == 'Mesa 1');
    expect(table1.items.length, 1);

    // 4. Pay the table (checkout)
    state.checkoutTable(
      table1.id,
      discount: 0,
      paymentMethod: 'Efectivo',
      refCode: 'Efectivo',
      cashReceived: 50.0,
      cashChange: 0.0,
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Table should now be in cleaning state and have 0 items.
    expect(table1.state, TableState.cleaning);
    expect(table1.items.isEmpty, true);

    // 5. Clean the table (Waiter marks as free by tapping it)
    await tester.tap(find.text('Mesa 1'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Verify it changed to free
    expect(table1.state, TableState.free);

    // 6. Select Mesa 1 again
    await tester.tap(find.text('Mesa 1'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // 7. Verify the new cart starts completely empty
    expect(find.textContaining('VER COMANDA (0)'), findsOneWidget);

    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}
