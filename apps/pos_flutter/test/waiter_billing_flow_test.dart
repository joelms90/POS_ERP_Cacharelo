import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_flutter/ui/common/app_state.dart';
import 'package:pos_flutter/ui/waiter/payment_flow_dialog.dart';

void main() {
  late AppState state;
  late TableModel occupiedTable;

  setUp(() {
    state = AppState();
    // Use Mesa 5 which has items and occupied state by default in mock data
    occupiedTable = state.tables.firstWhere((t) => t.id == 5);
  });

  Widget createDialogUnderTest() {
    return MaterialApp(
      home: Scaffold(
        body: PaymentFlowDialog(
          table: occupiedTable,
          state: state,
        ),
      ),
    );
  }

  testWidgets('PaymentFlowDialog loads Cash default and processes printing', (WidgetTester tester) async {
    await tester.pumpWidget(createDialogUnderTest());

    // Verify dialog header
    expect(find.text('Cobrar - Mesa 5'), findsOneWidget);

    // Verify Cash (Efectivo) is selected by default
    expect(find.text('PAGO EN CAJA'), findsOneWidget);
    expect(find.text('IMPRIMIR TICKET'), findsOneWidget);

    // Click IMPRIMIR TICKET
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

  testWidgets('PaymentFlowDialog Card validation and submission', (WidgetTester tester) async {
    await tester.pumpWidget(createDialogUnderTest());

    // Switch to Card (Tarjeta)
    await tester.tap(find.text('TARJETA'));
    await tester.pumpAndSettle();

    // Verify card components are shown
    expect(find.text('Seleccione el tipo de tarjeta:'), findsOneWidget);
    expect(find.text('Últimos 4 dígitos del voucher bancario:'), findsOneWidget);

    // Confirm that the payment button is disabled initially
    final processButtonFinder = find.text('PROCESAR PAGO');
    var button = tester.widget<ElevatedButton>(
      find.ancestor(of: processButtonFinder, matching: find.byType(ElevatedButton)),
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
      find.ancestor(of: processButtonFinder, matching: find.byType(ElevatedButton)),
    );
    expect(button.onPressed, isNull);

    // Fill in exactly 4 digits
    await tester.enterText(find.byType(TextField), '1234');
    await tester.pumpAndSettle();

    // Verify now enabled
    button = tester.widget<ElevatedButton>(
      find.ancestor(of: processButtonFinder, matching: find.byType(ElevatedButton)),
    );
    expect(button.onPressed, isNotNull);

    // Tap PROCESAR PAGO
    await tester.tap(find.text('PROCESAR PAGO'));
    await tester.pumpAndSettle();

    // Verify print job queued
    expect(state.printJobs.any((j) => j.title.contains('Ticket Pago Tarjeta - Mesa 5')), true);
    final printJob = state.printJobs.firstWhere((j) => j.title.contains('Ticket Pago Tarjeta - Mesa 5'));
    expect(printJob.details, contains('=== COMPROBANTE PAGO ==='));
    expect(printJob.details, contains('Visa'));
    expect(printJob.details, contains('**** 1234'));

    // Verify table transitions to cleaning and items are cleared (checkout completed)
    expect(occupiedTable.state, TableState.cleaning);
    expect(occupiedTable.items.isEmpty, true);
  });
}
