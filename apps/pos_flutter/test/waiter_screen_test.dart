import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_flutter/ui/common/app_state.dart';
import 'package:pos_flutter/ui/waiter/waiter_ordering_screen.dart';

void main() {
  testWidgets('WaiterOrderingScreen renders tables and info sidebar without crashing', (WidgetTester tester) async {
    final state = AppState();
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
        ),
        home: WaiterOrderingScreen(state: state),
      ),
    );

    // Verify header exists (icon-only controls)
    expect(find.byIcon(Icons.table_bar), findsOneWidget);
    expect(find.byIcon(Icons.settings), findsOneWidget);

    // Verify info sidebar elements exist
    expect(find.text('Estado de Sala'), findsOneWidget);
    expect(find.text('Mesas Libres'), findsOneWidget);

    // Verify zone chips exist
    expect(find.text('SALÓN PRINCIPAL'), findsOneWidget);
    expect(find.text('TERRAZA'), findsOneWidget);
    expect(find.text('BAR'), findsOneWidget);

    // Verify that tables in the default zone are rendered
    expect(find.text('Mesa 1'), findsOneWidget);
    expect(find.text('Mesa 2'), findsOneWidget);
    
    // Reset view size
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  testWidgets('WaiterOrderingScreen full-screen cart flow test', (WidgetTester tester) async {
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
    expect(find.text('\$21.46'), findsOneWidget); // 18.50 + 16% tax = 21.46

    // 5. Confirm order
    expect(find.text('CONFIRMAR PEDIDO'), findsOneWidget);
    await tester.tap(find.text('CONFIRMAR PEDIDO'));
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
}
