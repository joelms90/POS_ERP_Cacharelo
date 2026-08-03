import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:pos_flutter/ui/common/app_state.dart';
import 'package:pos_flutter/ui/cashier/split_checkout_view.dart';

void main() {
  late AppState state;
  late TableModel mockTable;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    state = AppState();
    mockTable = TableModel(
      id: 99,
      label: 'Mesa 99',
      shape: TableShape.circle,
      zone: 'Terraza',
      x: 0.5,
      y: 0.5,
      state: TableState.occupied,
      guests: 2,
      guestGenders: ['M', 'F'],
      items: [
        OrderItem(
          item: const MenuItem(
            id: '101',
            name: 'Plato A',
            price: 20.00,
            category: 'Comida',
          ),
          quantity: 1,
          isSent: true,
          assignedGuest: 'P1',
        ),
        OrderItem(
          item: const MenuItem(
            id: '102',
            name: 'Bebida B',
            price: 10.00,
            category: 'Bebidas',
          ),
          quantity: 1,
          isSent: true,
          assignedGuest: 'P2',
        ),
      ],
    );
    state.tables = [mockTable];
  });

  Widget createViewUnderTest({required VoidCallback onSuccess}) {
    return MaterialApp(
      home: Scaffold(
        body: SplitCheckoutView(
          table: mockTable,
          state: state,
          onCancel: () {},
          onSuccess: onSuccess,
        ),
      ),
    );
  }

  testWidgets(
    'SplitCheckoutView calculates equal split math and handles cash received',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1.0;

      await tester.pumpWidget(createViewUnderTest(onSuccess: () {}));
      await tester.pumpAndSettle();

      // Open Equal Split Screen
      await tester.tap(find.text('DIVISIÓN\nEQUITATIVA'));
      await tester.pumpAndSettle();

      // 1. Initial State: Equal split default splitCount = 2
      // Total price includes IVA: 20 + 10 = 30.00
      // 30 / 2 = 15.00 per person
      expect(find.textContaining('15.00'), findsAtLeastNWidgets(1));

      // 2. Click increment split count
      await tester.tap(find.byIcon(Icons.add_circle_outline).first);
      await tester.pumpAndSettle();

      // Now splitCount = 3
      // 30 / 3 = 10.00 per person
      expect(find.textContaining('10.00'), findsAtLeastNWidgets(1));

      // 3. Test discount (10%)
      // Net subtotal = 12.93
      // Net discount = 1.29
      // Gross total after discount = 13.50
      // Included IVA = 1.86
      await tester.tap(find.text('10%'));
      await tester.pumpAndSettle();

      expect(find.text('\$12.93'), findsAtLeastNWidgets(1));
      expect(find.text('-\$1.29'), findsOneWidget);
      expect(find.text('\$1.86'), findsOneWidget);
      expect(find.text('\$13.50'), findsOneWidget);

      // 4. Test Cash received and change math
      final cashInputFinder = find.widgetWithText(TextField, 'Monto Recibido');
      expect(cashInputFinder, findsOneWidget);

      await tester.enterText(cashInputFinder, '20.00');
      await tester.pumpAndSettle();

      // Change = 20.00 - 13.50 = 6.50
      expect(find.text('\$6.50'), findsNWidgets(2));

      // 5. Quick cash buttons should set exact, add denominations, and clear.
      await tester.tap(find.text('Exacto \$13.50'));
      await tester.pumpAndSettle();
      expect(find.text('\$0.00'), findsAtLeastNWidgets(1));

      await tester.tap(find.widgetWithText(OutlinedButton, 'Limpiar'));
      await tester.pumpAndSettle();

      await tester.drag(find.byType(ListView).first, const Offset(0, -240));
      await tester.pumpAndSettle();

      await tester.tap(find.text('+\$20'));
      await tester.tap(find.text('+\$50'));
      await tester.pumpAndSettle();
      expect(find.text('\$56.50'), findsNWidgets(2));

      await tester.tap(find.widgetWithText(OutlinedButton, 'Limpiar'));
      await tester.pumpAndSettle();
      expect(find.text('\$0.00'), findsAtLeastNWidgets(1));

      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    },
  );

  testWidgets('SplitCheckoutView calculates split by items math', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1.0;

    await tester.pumpWidget(createViewUnderTest(onSuccess: () {}));
    await tester.pumpAndSettle();

    // Switch to "POR ARTÍCULOS"
    await tester.tap(find.text('POR\nARTÍCULOS'));
    await tester.pumpAndSettle();

    // Verify subtotal starts at $0.00 since no items are selected
    expect(find.text('\$0.00'), findsAtLeastNWidgets(1));

    // Select Plato A (CheckboxListTile corresponding to index 0)
    // CheckboxListTile for Plato A should be tappable
    await tester.tap(find.text('Plato A'));
    await tester.pumpAndSettle();

    // Gross = 20.00
    // Net subtotal = 17.24
    // Included IVA = 2.76
    expect(find.text('\$17.24'), findsAtLeastNWidgets(1));
    expect(find.text('\$2.76'), findsOneWidget);
    expect(find.text('\$20.00'), findsAtLeastNWidgets(1));

    // Select by comensal P2 (which has Bebida B)
    // Guest selector button 'P2 👨' (Wait, P2 is female/F so it is P2 👩)
    await tester.tap(find.widgetWithText(ChoiceChip, 'P2 👩'));
    await tester.pumpAndSettle();

    // Now both Plato A and Bebida B are selected
    // Gross = 30.00
    // Net subtotal = 25.86
    // Included IVA = 4.14
    expect(find.text('\$25.86'), findsAtLeastNWidgets(1));
    expect(find.text('\$4.14'), findsOneWidget);
    expect(find.text('\$30.00'), findsAtLeastNWidgets(1));

    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  testWidgets('SplitCheckoutView handles equal split multi-payment lifecycle', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1.0;

    int successCount = 0;
    await tester.pumpWidget(createViewUnderTest(onSuccess: () {
      successCount++;
    }));
    await tester.pumpAndSettle();

    // Open Equal Split Screen
    await tester.tap(find.text('DIVISIÓN\nEQUITATIVA'));
    await tester.pumpAndSettle();

    // 1. Initial total is $30.00. Default splitCount is 2 ($15.00 per person).
    expect(find.textContaining('15.00'), findsAtLeastNWidgets(1));

    // Set split count to 3 ($10.00 per person).
    await tester.tap(find.byIcon(Icons.add_circle_outline).first);
    await tester.pumpAndSettle();
    expect(find.textContaining('10.00'), findsAtLeastNWidgets(1));

    // 2. Default payment is Efectivo. Enter cash received.
    final cashInputFinder = find.widgetWithText(TextField, 'Monto Recibido');
    expect(cashInputFinder, findsOneWidget);

    await tester.enterText(cashInputFinder, '20.00');
    await tester.pumpAndSettle();

    final pagarBtn = find.widgetWithText(ElevatedButton, 'PROCESAR COBRO');
    expect(pagarBtn, findsOneWidget);

    await tester.tap(pagarBtn);
    await tester.pumpAndSettle();

    // Clear SnackBar so it doesn't block the bottom buttons
    ScaffoldMessenger.of(tester.element(find.byType(SplitCheckoutView))).clearSnackBars();
    await tester.pumpAndSettle();

    // Verification:
    // - Equal split payment of $10.00 processed.
    // - Table state should still be billing/occupied (not closed).
    // - splitCount in equal split is decremented to 2.
    // - The new amount per part should still be $10.00 (since original divisor 3 is preserved).
    expect(mockTable.state, TableState.billing);
    expect(find.text('\$10.00'), findsAtLeastNWidgets(1));

    // Process second payment.
    await tester.enterText(cashInputFinder, '20.00');
    await tester.pumpAndSettle();
    await tester.tap(pagarBtn);
    await tester.pumpAndSettle();

    ScaffoldMessenger.of(tester.element(find.byType(SplitCheckoutView))).clearSnackBars();
    await tester.pumpAndSettle();

    expect(mockTable.state, TableState.billing);
    expect(find.text('\$10.00'), findsAtLeastNWidgets(1));

    // Process final payment.
    await tester.enterText(cashInputFinder, '20.00');
    await tester.pumpAndSettle();
    await tester.tap(pagarBtn);
    await tester.pumpAndSettle();

    // After the third/final payment:
    // - Table should be closed (TableState.cleaning).
    // - onSuccess should have been called.
    expect(mockTable.state, TableState.cleaning);
    expect(successCount, 1);

    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  testWidgets('SplitCheckoutView disables payment button when no items selected in item-split mode', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1.0;

    await tester.pumpWidget(createViewUnderTest(onSuccess: () {}));
    await tester.pumpAndSettle();

    // Switch to "POR ARTÍCULOS"
    await tester.tap(find.text('POR\nARTÍCULOS'));
    await tester.pumpAndSettle();

    // Verify helper instruction card is shown
    expect(
      find.textContaining('Seleccione artículos'),
      findsOneWidget,
    );

    // Verify PROCESAR COBRO button is disabled
    final pagarBtn = tester.widget<ElevatedButton>(
      find.widgetWithText(ElevatedButton, 'PROCESAR COBRO'),
    );
    expect(pagarBtn.onPressed, isNull);

    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}
