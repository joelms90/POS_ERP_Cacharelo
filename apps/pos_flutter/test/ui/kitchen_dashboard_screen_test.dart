import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_flutter/ui/common/app_state.dart';
import 'package:pos_flutter/ui/kitchen/kitchen_dashboard_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets(
      'KitchenDashboardScreen hides KDS error banner when no sync parse error exists',
      (
    WidgetTester tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    late AppState state;
    await tester.runAsync(() async {
      state = AppState();
      await state.initializationFuture;
    });
    state.currentUserRole = UserRole.kitchen;
    state.currentUserName = 'Carlos (Cocina)';
    state.isOnline = false;
    state.lastSyncError = null;

    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1.0;

    await tester.pumpWidget(
      MaterialApp(
        home: KitchenDashboardScreen(state: state),
      ),
    );

    expect(find.textContaining('FALLO DE CONEXIÓN/PARSEO KDS'), findsNothing);
    expect(find.text('PANTALLA DE COCINA (KDS)'), findsOneWidget);

    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  testWidgets('KitchenDashboardScreen shows KDS error banner for parse errors',
      (
    WidgetTester tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    late AppState state;
    await tester.runAsync(() async {
      state = AppState();
      await state.initializationFuture;
    });
    state.currentUserRole = UserRole.kitchen;
    state.currentUserName = 'Carlos (Cocina)';
    state.lastSyncError = 'FormatException: unexpected payload';

    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1.0;

    await tester.pumpWidget(
      MaterialApp(
        home: KitchenDashboardScreen(state: state),
      ),
    );

    expect(find.textContaining('FALLO DE CONEXIÓN/PARSEO KDS'), findsOneWidget);
    expect(find.textContaining('FormatException: unexpected payload'),
        findsOneWidget);

    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}
