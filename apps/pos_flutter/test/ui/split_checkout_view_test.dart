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
          item: const MenuItem(id: '101', name: 'Plato A', price: 20.00, category: 'Comida'),
          quantity: 1,
          isSent: true,
          assignedGuest: 'P1',
        ),
        OrderItem(
          item: const MenuItem(id: '102', name: 'Bebida B', price: 10.00, category: 'Bebidas'),
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

  testWidgets('SplitCheckoutView calculates equal split math and handles cash received', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1.0;

    await tester.pumpWidget(createViewUnderTest(onSuccess: () {}));
    await tester.pumpAndSettle();

    // 1. Initial State: Equal split, splitCount = 1
    // Total subtotal = 20 + 10 = 30.00
    // Tax = 30.00 * 0.16 = 4.80
    // Total = 34.80
    expect(find.text('\$30.00'), findsAtLeastNWidgets(1));
    expect(find.text('\$4.80'), findsOneWidget);
    expect(find.text('\$34.80'), findsOneWidget);

    // 2. Click increment split count
    await tester.tap(find.byIcon(Icons.add_circle_outline));
    await tester.pumpAndSettle();

    // Now splitCount = 2
    // Subtotal per person = 30 / 2 = 15.00
    // Tax = 15 * 0.16 = 2.40
    // Total = 17.40
    expect(find.text('\$15.00'), findsAtLeastNWidgets(1));
    expect(find.text('\$2.40'), findsOneWidget);
    expect(find.text('\$17.40'), findsOneWidget);

    // 3. Test discount (10%)
    // Subtotal = 15.00
    // Discount = 1.50
    // Subtotal after discount = 13.50
    // Tax = 13.50 * 0.16 = 2.16
    // Total = 15.66
    await tester.tap(find.text('10%'));
    await tester.pumpAndSettle();

    expect(find.text('\$15.00'), findsAtLeastNWidgets(1));
    expect(find.text('-\$1.50'), findsOneWidget);
    expect(find.text('\$2.16'), findsOneWidget);
    expect(find.text('\$15.66'), findsOneWidget);

    // 4. Test Cash received and change math
    final cashInputFinder = find.widgetWithText(TextField, 'Monto Recibido');
    expect(cashInputFinder, findsOneWidget);

    await tester.enterText(cashInputFinder, '20.00');
    await tester.pumpAndSettle();

    // Change = 20.00 - 15.66 = 4.34
    expect(find.text('\$4.34'), findsNWidgets(2));

    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  testWidgets('SplitCheckoutView calculates split by items math', (WidgetTester tester) async {
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

    // Subtotal = 20.00
    // Tax = 3.20
    // Total = 23.20
    expect(find.text('\$20.00'), findsAtLeastNWidgets(1));
    expect(find.text('\$3.20'), findsOneWidget);
    expect(find.text('\$23.20'), findsOneWidget);

    // Select by comensal P2 (which has Bebida B)
    // Guest selector button 'P2 👨' (Wait, P2 is female/F so it is P2 👩)
    await tester.tap(find.widgetWithText(ChoiceChip, 'P2 👩'));
    await tester.pumpAndSettle();

    // Now both Plato A and Bebida B are selected
    // Subtotal = 30.00
    // Tax = 4.80
    // Total = 34.80
    expect(find.text('\$30.00'), findsAtLeastNWidgets(1));
    expect(find.text('\$4.80'), findsOneWidget);
    expect(find.text('\$34.80'), findsOneWidget);

    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}
