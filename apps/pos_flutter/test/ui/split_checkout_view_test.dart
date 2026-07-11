import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_flutter/ui/common/app_state.dart';
import 'package:pos_flutter/ui/cashier/split_checkout_view.dart';

void main() {
  late AppState state;
  late TableModel mockTable;

  setUp(() {
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

      // 1. Initial State: Equal split, splitCount = 1
      // Total price includes IVA: 20 + 10 = 30.00
      // Net subtotal = 30 / 1.16 = 25.86
      // Included IVA = 4.14
      expect(find.text('\$25.86'), findsAtLeastNWidgets(1));
      expect(find.text('\$4.14'), findsOneWidget);
      expect(find.text('\$30.00'), findsAtLeastNWidgets(1));

      // 2. Click increment split count
      await tester.tap(find.byIcon(Icons.add_circle_outline));
      await tester.pumpAndSettle();

      // Now splitCount = 2
      // Gross per person = 30 / 2 = 15.00
      // Net subtotal = 12.93
      // Included IVA = 2.07
      expect(find.text('\$12.93'), findsAtLeastNWidgets(1));
      expect(find.text('\$2.07'), findsOneWidget);
      expect(find.text('\$15.00'), findsAtLeastNWidgets(1));

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
    await tester.tap(find.text('POR ARTÍCULOS'));
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
}
