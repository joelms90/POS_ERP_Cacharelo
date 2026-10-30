import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:pos_flutter/ui/common/app_state.dart';
import 'package:pos_flutter/ui/warehouse/warehouse_dashboard_screen.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('WarehouseDashboardScreen Widget Tests', () {
    testWidgets('renders warehouse header, tabs, and operator profile without crashing',
        (tester) async {
      final appState = AppState();

      await tester.pumpWidget(
        MaterialApp(
          home: WarehouseDashboardScreen(state: appState),
        ),
      );

      await tester.pumpAndSettle();

      // Verify warehouse header is present
      expect(find.text('ALMACÉN & BODEGA CENTRAL'), findsOneWidget);
      expect(find.text('Operaciones de Custodia, Entradas y Salidas'), findsOneWidget);

      // Verify 3 distinct navigation tabs
      expect(find.text('Entradas (Proveedores)'), findsOneWidget);
      expect(find.text('Salidas (Sucursales)'), findsOneWidget);
      expect(find.text('Inventario de Bodega'), findsOneWidget);

      // Verify NO store/POS artifacts are rendered
      expect(find.text('Mesas'), findsNothing);
      expect(find.text('Corte de Caja'), findsNothing);
      expect(find.text('Comanda'), findsNothing);
    });

    testWidgets('switching to Inventario de Bodega tab renders search bar and barcode scan icon',
        (tester) async {
      final appState = AppState();

      await tester.pumpWidget(
        MaterialApp(
          home: WarehouseDashboardScreen(state: appState),
        ),
      );

      await tester.pumpAndSettle();

      // Tap on Tab 3 (Inventario de Bodega)
      await tester.tap(find.text('Inventario de Bodega'));
      await tester.pumpAndSettle();

      // Barcode / text search input should be visible
      expect(find.byIcon(Icons.qr_code_scanner), findsOneWidget);
      expect(
        find.text('Escanear código de barras o buscar por nombre / SKU…'),
        findsOneWidget,
      );
    });

    testWidgets('switching to Salidas tab renders requisitions dispatch view',
        (tester) async {
      final appState = AppState();

      await tester.pumpWidget(
        MaterialApp(
          home: WarehouseDashboardScreen(state: appState),
        ),
      );

      await tester.pumpAndSettle();

      // Tap on Tab 2 (Salidas / Sucursales)
      await tester.tap(find.text('Salidas (Sucursales)'));
      await tester.pumpAndSettle();

      expect(find.text('No hay requisiciones pendientes de surtir'), findsOneWidget);
    });

    testWidgets('confirms costs and monetary values are never exposed to warehouse operators',
        (tester) async {
      final appState = AppState();

      await tester.pumpWidget(
        MaterialApp(
          home: WarehouseDashboardScreen(state: appState),
        ),
      );

      await tester.pumpAndSettle();

      // Tap on Tab 3 (Inventario de Bodega)
      await tester.tap(find.text('Inventario de Bodega'));
      await tester.pumpAndSettle();

      // No cost labels or cost prefixes should exist
      expect(find.textContaining('Costo prom'), findsNothing);
      expect(find.textContaining('Costo unitario'), findsNothing);
      expect(find.textContaining('Valor inventario'), findsNothing);
    });
  });
}
