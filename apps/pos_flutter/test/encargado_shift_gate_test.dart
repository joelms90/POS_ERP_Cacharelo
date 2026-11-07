import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:pos_flutter/ui/common/app_state.dart';
import 'package:pos_flutter/ui/encargado/encargado_dashboard_screen.dart';
import 'package:pos_flutter/services/secure_storage_service.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('Encargado Shift Gate and Persistence Tests', () {
    testWidgets(
        'When shift is closed (isShiftOpen == false), starts on Caja tab and blocks other functions',
        (tester) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final appState = AppState();
      appState.currentUserRole = UserRole.branchOperator;
      appState.currentUserName = 'Operador Sucursal';
      appState.isShiftOpen = false;

      await tester.pumpWidget(
        MaterialApp(
          home: EncargadoDashboardScreen(
            state: appState,
            showFullFeatures: false,
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 200));

      // Expect to be directly on Caja tab with shift opening prompt
      expect(find.text('APERTURA DE TURNO DE CAJA'), findsOneWidget);
      expect(find.text('ABRIR TURNO / CAJA'), findsOneWidget);

      // Attempt to tap POS tab
      await tester.tap(find.text('POS'));
      await tester.pump(const Duration(milliseconds: 200));

      // Verify that shift locked SnackBar appears
      expect(
        find.text(
            'Debe aperturar su turno en Caja con el fondo inicial para operar la sucursal.'),
        findsOneWidget,
      );

      // Still on Caja tab (APERTURA DE TURNO DE CAJA is still visible)
      expect(find.text('APERTURA DE TURNO DE CAJA'), findsOneWidget);
    });

    testWidgets(
        'When shift is already open (isShiftOpen == true), starts on POS with full access',
        (tester) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final appState = AppState();
      appState.currentUserRole = UserRole.branchOperator;
      appState.currentUserName = 'Operador Sucursal';
      appState.isShiftOpen = true;
      appState.activeShiftId = 'shift-12345';
      appState.cashDrawerAmount = 1000.0;

      await tester.pumpWidget(
        MaterialApp(
          home: EncargadoDashboardScreen(
            state: appState,
            showFullFeatures: false,
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 200));

      // Verify we are NOT on shift opening view
      expect(find.text('APERTURA DE TURNO DE CAJA'), findsNothing);

      // POS tab is active
      expect(find.text('Buscar producto...'), findsOneWidget);

      // Tapping Órdenes is permitted without blocking
      await tester.tap(find.text('Órdenes'));
      await tester.pump(const Duration(milliseconds: 200));

      expect(
        find.text(
            'Debe aperturar su turno en Caja con el fondo inicial para operar la sucursal.'),
        findsNothing,
      );
    });

    testWidgets(
        'When shift transitions from closed to open, automatically switches to POS',
        (tester) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final appState = AppState();
      appState.currentUserRole = UserRole.branchOperator;
      appState.currentUserName = 'Operador Sucursal';
      appState.isShiftOpen = false;

      await tester.pumpWidget(
        MaterialApp(
          home: EncargadoDashboardScreen(
            state: appState,
            showFullFeatures: false,
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.text('APERTURA DE TURNO DE CAJA'), findsOneWidget);

      // Simulate shift being opened
      appState.isShiftOpen = true;
      appState.activeShiftId = 'new-shift-abc';
      appState.notifyListeners();
      await tester.pump(const Duration(milliseconds: 200));

      // Expect to be moved to POS view automatically
      expect(find.text('APERTURA DE TURNO DE CAJA'), findsNothing);
      expect(find.text('Buscar producto...'), findsOneWidget);
    });

    test('SecureStorageService preserves and clears active shift cache correctly',
        () async {
      final storage = SecureStorageService();

      await storage.saveActiveShift(
        shiftId: 'shift-xyz-789',
        branchId: 'branch-1',
        cashierId: 'user-operator-1',
        initialFloat: 500.0,
        cashDrawerAmount: 750.0,
      );

      final cached = await storage.getActiveShift();
      expect(cached, isNotNull);
      expect(cached!['shiftId'], 'shift-xyz-789');
      expect(cached['branchId'], 'branch-1');
      expect(cached['cashierId'], 'user-operator-1');
      expect(cached['isOpen'], true);
      expect(cached['initialFloat'], 500.0);
      expect(cached['cashDrawerAmount'], 750.0);

      // Clear cache on close shift
      await storage.clearActiveShift();
      final afterClear = await storage.getActiveShift();
      expect(afterClear, isNull);
    });
  });
}
