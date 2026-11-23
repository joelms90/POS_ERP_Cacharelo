import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:pos_flutter/ui/common/app_state.dart';
import 'package:pos_flutter/ui/warehouse/warehouse_dashboard_screen.dart';

/// Serves canned "Salidas" data and records the warehouse actions taken.
class _OutboundAppState extends AppState {
  final List<String> delivered = [];

  @override
  Future<List<Map<String, dynamic>>> fetchWarehousesList() async => [
        {'id': 'wh-1', 'name': 'Bodega Central'},
      ];

  @override
  Future<List<Map<String, dynamic>>> fetchWarehouseOutboundRequisitions() async => [
        _req('req-approved', 'approved', 'Sucursal Centro', approved: 3),
        _req('req-transit', 'in_transit', 'Sucursal Norte', dispatched: 2),
        _req('req-delivered', 'delivered', 'Sucursal Sur', dispatched: 1),
      ];

  final List<String> purchased = [];

  @override
  Future<List<Map<String, dynamic>>> fetchWarehouseStock(
          {String? warehouseId}) async =>
      [
        {'productId': 'p-1', 'productName': 'Harina', 'uom': 'piece', 'quantity': '100.000'},
        {'productId': 'p-2', 'productName': 'Aceite', 'uom': 'l', 'quantity': '2.500'},
      ];

  @override
  Future<List<Map<String, dynamic>>> fetchWarehousePurchaseOrders() async => [
        _po('po-1', 'authorized', 'OC-001'),
        _po('po-2', 'purchased', 'OC-002'),
        _po('po-3', 'partially_received', 'OC-003', received: 4),
      ];

  @override
  Future<String?> markPurchaseOrderPurchased(
      {required String poId, String? documentNumber, String? notes}) async {
    purchased.add('$poId:${documentNumber ?? ''}');
    return null;
  }

  static Map<String, dynamic> _po(String id, String status, String number,
          {double received = 0}) =>
      {
        'id': id,
        'status': status,
        'poNumber': number,
        'providerName': 'Harinas del Sur',
        'orderDate': '2026-11-23T10:00:00Z',
        'items': [
          {
            'productId': 'p-1',
            'productName': 'Harina',
            'unit': 'kg',
            'quantityOrdered': '10.000',
            'quantityReceived': received.toStringAsFixed(3),
            'unitCostEstimated': '10.00',
          }
        ],
      };

  @override
  Future<String?> deliverRequisition(
      {required String requisitionId, String? notes}) async {
    delivered.add(requisitionId);
    return null;
  }

  static Map<String, dynamic> _req(String id, String status, String branch,
          {double approved = 0, double dispatched = 0}) =>
      {
        'id': id,
        'status': status,
        'fromBranchName': branch,
        'createdAt': '2026-11-23T10:00:00Z',
        'items': [
          {
            'productId': 'p-1',
            'productName': 'Harina',
            'unit': 'kg',
            'quantityRequested': '4.000',
            'quantityApproved': approved.toStringAsFixed(3),
            'quantityDispatched':
                dispatched == 0 ? null : dispatched.toStringAsFixed(3),
          }
        ],
      };
}

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
      expect(find.text('Compras y Entradas'), findsOneWidget);
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

      expect(find.text('No hay salidas autorizadas'), findsOneWidget);
    });

    testWidgets(
        'Salidas groups authorized requisitions by step and marks one delivered',
        (tester) async {
      tester.view.physicalSize = const Size(1400, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      final appState = _OutboundAppState();

      await tester.pumpWidget(
        MaterialApp(home: WarehouseDashboardScreen(state: appState)),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Salidas (Sucursales)'));
      await tester.pumpAndSettle();

      expect(find.text('Por surtir (1)'), findsOneWidget);
      expect(find.text('En camino (1)'), findsOneWidget);
      expect(
          find.text('Entregadas · esperando confirmación de la sucursal (1)'),
          findsOneWidget);

      // Bodega fulfils the approved quantity (3), not the requested one (4).
      expect(find.text('Harina: 3 kg'), findsOneWidget);
      expect(find.text('Surtir y Despachar'), findsOneWidget);
      expect(find.text('Poner en Espera'), findsOneWidget);
      expect(find.text('La sucursal confirmará lo recibido.'), findsOneWidget);

      await tester.tap(find.text('Marcar Entregada'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirmar entrega'));
      await tester.pumpAndSettle();

      expect(appState.delivered, ['req-transit']);
    });

    testWidgets(
        'Compras y Entradas shows authorized OCs by step and marks one purchased',
        (tester) async {
      tester.view.physicalSize = const Size(1400, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      final appState = _OutboundAppState();

      await tester.pumpWidget(
        MaterialApp(home: WarehouseDashboardScreen(state: appState)),
      );
      await tester.pumpAndSettle();

      expect(find.text('Por comprar (1)'), findsOneWidget);
      expect(find.text('Comprada · en camino a bodega (1)'), findsOneWidget);
      expect(find.text('Recibidas en parte (1)'), findsOneWidget);
      // Pending quantity, not the ordered one, for the partial OC.
      expect(find.text('Harina: 6 kg'), findsOneWidget);
      expect(find.text('Marcar Comprada'), findsOneWidget);
      expect(find.text('Registrar Entrada'), findsNWidgets(2));

      await tester.tap(find.text('Marcar Comprada'));
      await tester.pumpAndSettle();
      await tester.enterText(
          find.widgetWithText(TextField, 'Ticket / factura (opcional)'), 'TK-9');
      await tester.tap(find.text('Confirmar compra'));
      await tester.pumpAndSettle();

      expect(appState.purchased, ['po-1:TK-9']);
    });

    testWidgets('Inventario de Bodega shows the unit label, not the raw value',
        (tester) async {
      final appState = _OutboundAppState();
      await tester.pumpWidget(
        MaterialApp(home: WarehouseDashboardScreen(state: appState)),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Inventario de Bodega'));
      await tester.pumpAndSettle();

      expect(find.text('100 pza'), findsOneWidget);
      expect(find.text('2.5 l (Bajo)'), findsOneWidget);
      expect(find.textContaining('piece'), findsNothing);
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
