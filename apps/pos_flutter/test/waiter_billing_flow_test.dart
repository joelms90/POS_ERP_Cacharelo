import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:pos_flutter/services/secure_storage_service.dart';
import 'package:pos_flutter/ui/common/app_state.dart';
import 'package:pos_flutter/ui/waiter/payment_flow_dialog.dart';

class FakeSecureStorageService extends SecureStorageService {
  List<Map<String, dynamic>> pendingSaleSyncJobs = [];

  @override
  Future<Map<String, String>?> getTerminalConfig() async => null;

  @override
  Future<List<Map<String, dynamic>>> getPendingSaleSyncJobs() async =>
      pendingSaleSyncJobs;

  @override
  Future<void> savePendingSaleSyncJobs(List<Map<String, dynamic>> jobs) async {
    pendingSaleSyncJobs = jobs
        .map((job) => Map<String, dynamic>.from(job))
        .toList();
  }

  @override
  Future<Map<String, dynamic>?> getTicketFiscalConfig() async => null;

  @override
  Future<void> saveTicketFiscalConfig(Map<String, dynamic> config) async {}

  @override
  Future<Map<String, String>?> getSavedPrinter() async => null;

  @override
  Future<Map<String, String>?> verifyOfflineCredentials(String pin) async =>
      null;
}

void main() {
  late AppState state;
  late TableModel occupiedTable;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    state = AppState(secureStorageService: FakeSecureStorageService());
    await state.initializationFuture;
    // Use Mesa 5 which has items and occupied state by default in mock data
    occupiedTable = state.tables.firstWhere((t) => t.id == 5);
  });

  Widget createDialogUnderTest() {
    return MaterialApp(
      home: Scaffold(
        body: PaymentFlowDialog(table: occupiedTable, state: state),
      ),
    );
  }

  testWidgets('PaymentFlowDialog loads Cash default and processes printing', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(createDialogUnderTest());

    // Verify dialog header
    expect(find.text('Cobrar - Mesa 5'), findsOneWidget);

    // Verify Cash (Efectivo) is selected by default
    expect(find.text('PAGO EN CAJA'), findsOneWidget);
    expect(find.text('IMPRIMIR TICKET'), findsOneWidget);

    // Click IMPRIMIR TICKET
    await tester.ensureVisible(find.text('IMPRIMIR TICKET'));
    await tester.tap(find.text('IMPRIMIR TICKET'));
    await tester.pumpAndSettle();

    // Verify print job is queued
    expect(state.printJobs.isNotEmpty, true);
    final printJob = state.printJobs.last;
    expect(printJob.title, contains('Pre-Cuenta - Mesa 5'));
    expect(printJob.details, contains('=== PRE-CUENTA ==='));
    expect(printJob.details, contains('Lasagna Bolognesa'));

    // Verify table state is updated to TableState.billing (Por Cobrar)
    expect(occupiedTable.state, TableState.billing);
  });

  testWidgets('PaymentFlowDialog Card validation and submission', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(createDialogUnderTest());

    // Switch to Card (Tarjeta)
    await tester.tap(find.text('TARJETA'));
    await tester.pumpAndSettle();

    // Verify card components are shown
    expect(find.text('Seleccione el tipo de tarjeta:'), findsOneWidget);
    expect(
      find.text('Últimos 4 dígitos del voucher bancario:'),
      findsOneWidget,
    );

    // Confirm that the payment button is disabled initially
    final processButtonFinder = find.text('PROCESAR PAGO');
    var button = tester.widget<ElevatedButton>(
      find.ancestor(
        of: processButtonFinder,
        matching: find.byType(ElevatedButton),
      ),
    );
    expect(button.onPressed, isNull); // Disabled

    // Select Card brand: Visa
    await tester.tap(find.text('Visa'));
    await tester.pumpAndSettle();

    // Fill in 3 digits (invalid voucher)
    await tester.enterText(find.byType(TextField), '123');
    await tester.pumpAndSettle();

    // Verify still disabled
    button = tester.widget<ElevatedButton>(
      find.ancestor(
        of: processButtonFinder,
        matching: find.byType(ElevatedButton),
      ),
    );
    expect(button.onPressed, isNull);

    // Fill in exactly 4 digits
    await tester.enterText(find.byType(TextField), '1234');
    await tester.pumpAndSettle();

    // Verify now enabled
    button = tester.widget<ElevatedButton>(
      find.ancestor(
        of: processButtonFinder,
        matching: find.byType(ElevatedButton),
      ),
    );
    expect(button.onPressed, isNotNull);

    // Tap PROCESAR PAGO
    await tester.ensureVisible(find.text('PROCESAR PAGO'));
    await tester.tap(find.text('PROCESAR PAGO'));
    await tester.pumpAndSettle();

    // Verify print job queued
    expect(
      state.printJobs.any(
        (j) => j.title.contains('Ticket Pago Tarjeta - Mesa 5'),
      ),
      true,
    );
    final printJob = state.printJobs.firstWhere(
      (j) => j.title.contains('Ticket Pago Tarjeta - Mesa 5'),
    );
    expect(printJob.details, contains('=== COMPROBANTE PAGO ==='));
    expect(printJob.details, contains('Visa'));
    expect(printJob.details, contains('**** 1234'));

    // Verify table transitions to cleaning and items are cleared (checkout completed)
    expect(occupiedTable.state, TableState.cleaning);
    expect(occupiedTable.items.isEmpty, true);
  });

  test(
    'checkout stores closed sale locally when sync is unavailable',
    () async {
      final fakeStorage = FakeSecureStorageService();
      final state = AppState(secureStorageService: fakeStorage);
      await state.initializationFuture;

      state.currentUserId = '22222222-2222-4222-8222-222222222222';
      state.currentUserName = 'Maria Mesera';
      state.terminalBranchId = '11111111-1111-4111-8111-111111111111';
      state.isTerminalConfigured = false;

      final table = TableModel(
        id: 99,
        remoteId: '33333333-3333-4333-8333-333333333333',
        label: 'Mesa Sync',
        shape: TableShape.square,
        zone: 'Salon',
        x: 0.1,
        y: 0.1,
        state: TableState.billing,
        guests: 1,
        items: [
          OrderItem(
            item: const MenuItem(
              id: '44444444-4444-4444-8444-444444444444',
              name: 'Cafe',
              price: 25,
              category: 'Bebidas',
            ),
            quantity: 2,
            isSent: true,
          ),
        ],
      );
      state.tables = [table];
      final productId = table.items.single.item.id;

      state.checkoutTable(
        table.id,
        discount: 0,
        paymentMethod: 'Efectivo',
        refCode: 'Efectivo',
        cashReceived: 60,
        cashChange: 10,
      );
      await Future<void>.delayed(const Duration(milliseconds: 50));

      final ticket = state.printJobs.last.details;
      expect(ticket, contains('TICKET DE COMPRA'));
      expect(ticket, contains('RFC: CACX010101ABC'));
      expect(ticket, contains('Av. Principal 123, Centro,'));
      expect(ticket, contains('Mexico'));
      expect(ticket, contains('Operacion:'));
      expect(ticket, contains('IVA (16%):'));
      expect(ticket, contains('IVA incluido en precios al'));
      expect(ticket, contains('publico.'));
      expect(ticket, contains('TOTAL PAGADO:'));
      expect(ticket, contains('Recibido:'));
      expect(ticket, contains('\$60.00'));
      expect(ticket, contains('Cambio:'));
      expect(ticket, contains('\$10.00'));

      expect(fakeStorage.pendingSaleSyncJobs, hasLength(1));
      expect(state.pendingSyncCount, 1);

      final payload =
          fakeStorage.pendingSaleSyncJobs.single['payload']
              as Map<String, dynamic>;
      final order = (payload['orders'] as List).single as Map<String, dynamic>;
      final payment =
          (payload['payments'] as List).single as Map<String, dynamic>;
      final item =
          (payload['orderItems'] as List).single as Map<String, dynamic>;

      expect(order['state'], 'closed');
      expect(order['branchId'], state.terminalBranchId);
      expect(order['tableId'], table.remoteId);
      expect(order['waiterId'], state.currentUserId);
      expect(order['subtotal'], '43.10');
      expect(order['tax'], '6.90');
      expect(order['total'], '50.00');
      expect(payment['paymentMethod'], 'cash');
      expect(payment['referenceCode'], isNull);
      expect(item['productId'], productId);
      expect(item['price'], '21.55');
    },
  );
}
