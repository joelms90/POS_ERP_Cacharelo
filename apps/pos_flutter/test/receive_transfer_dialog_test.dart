import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:pos_flutter/services/secure_storage_service.dart';
import 'package:pos_flutter/ui/common/app_state.dart';
import 'package:pos_flutter/ui/encargado/operator_operations_tabs.dart';

class FakeSecureStorage implements FlutterSecureStorage {
  final Map<String, String> _storage = {};

  @override
  Future<String?> read({
    required String key,
    aOptions,
    iOptions,
    lOptions,
    webOptions,
    mOptions,
    wOptions,
  }) async {
    return _storage[key];
  }

  @override
  Future<void> write({
    required String key,
    required String? value,
    aOptions,
    iOptions,
    lOptions,
    webOptions,
    mOptions,
    wOptions,
  }) async {
    if (value == null) {
      _storage.remove(key);
    } else {
      _storage[key] = value;
    }
  }

  @override
  Future<void> delete({
    required String key,
    aOptions,
    iOptions,
    lOptions,
    webOptions,
    mOptions,
    wOptions,
  }) async {
    _storage.remove(key);
  }

  @override
  noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ReceiveTransferDialog Widget Tests', () {
    late AppState state;
    late FakeSecureStorage fakeStorage;

    setUp(() async {
      fakeStorage = FakeSecureStorage();
      state = AppState(
          secureStorageService: SecureStorageService(secureStorage: fakeStorage));
      await state.initializationFuture;

      state.cachedIngredients = [
        {'id': 'prod-1', 'name': 'Harina de Trigo', 'sku': 'HAR-01'},
        {'id': 'prod-2', 'name': 'Azúcar Morena', 'sku': 'AZU-02'},
        {'id': 'prod-3', 'name': 'Café en Grano', 'sku': 'CAF-03'},
      ];
    });

    testWidgets('Displays initial products, allows removal and adding via searchbox',
        (WidgetTester tester) async {
      final transfer = {
        'id': '12345678-abcd-ef01-2345-6789abcdef01',
      };
      final initialItems = [
        {
          'productId': 'prod-1',
          'productName': 'Harina de Trigo',
          'sku': 'HAR-01',
          'quantity': 5.0,
        },
        {
          'productId': 'prod-2',
          'productName': 'Azúcar Morena',
          'sku': 'AZU-02',
          'quantity': 3.0,
        },
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ReceiveTransferDialog(
              state: state,
              transfer: transfer,
              initialItems: initialItems,
            ),
          ),
        ),
      );

      // Verify title & products rendered
      expect(find.text('Recibir productos'), findsOneWidget);
      expect(find.text('Traspaso #12345678'), findsOneWidget);
      expect(find.text('Harina de Trigo'), findsOneWidget);
      expect(find.text('Azúcar Morena'), findsOneWidget);
      expect(find.textContaining('Enviado: 5'), findsOneWidget);
      expect(find.textContaining('Enviado: 3'), findsOneWidget);

      // 1. Remove Azúcar Morena
      final deleteButtons = find.byIcon(Icons.delete_outline);
      expect(deleteButtons, findsNWidgets(2));
      await tester.tap(deleteButtons.last);
      await tester.pumpAndSettle();

      expect(find.text('Azúcar Morena'), findsNothing);
      expect(find.text('Harina de Trigo'), findsOneWidget);

      // 2. Open Add Product dialog
      final addBtn = find.text('Agregar producto');
      expect(addBtn, findsOneWidget);
      await tester.tap(addBtn);
      await tester.pumpAndSettle();

      // Search dialog should be visible
      expect(find.text('Buscar Producto / Insumo'), findsOneWidget);
      expect(find.text('Café en Grano'), findsOneWidget);

      // 3. Search and select Café en Grano
      await tester.enterText(find.byType(TextField).first, 'café');
      await tester.pumpAndSettle();

      expect(find.text('Café en Grano'), findsOneWidget);
      await tester.tap(find.text('Café en Grano'));
      await tester.pumpAndSettle();

      // Tap 'Agregar'
      final dialogAddButton = find.widgetWithText(TextButton, 'Agregar');
      expect(dialogAddButton, findsOneWidget);
      await tester.tap(dialogAddButton);
      await tester.pumpAndSettle();

      // Verify Café en Grano was added to the receipt list
      expect(find.text('Café en Grano'), findsOneWidget);
      expect(find.textContaining('Producto extra agregado'), findsOneWidget);
      expect(find.text('Harina de Trigo'), findsOneWidget);
    });

    testWidgets('Requires discrepancy note when items are removed or differ',
        (WidgetTester tester) async {
      final transfer = {
        'id': '12345678-abcd-ef01-2345-6789abcdef01',
      };
      final initialItems = [
        {
          'productId': 'prod-1',
          'productName': 'Harina de Trigo',
          'sku': 'HAR-01',
          'quantity': 5.0,
        },
      ];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ReceiveTransferDialog(
              state: state,
              transfer: transfer,
              initialItems: initialItems,
            ),
          ),
        ),
      );

      // Change quantity from 5 to 3
      final qtyInput = find.widgetWithText(TextField, '5');
      await tester.enterText(qtyInput, '3');
      await tester.pumpAndSettle();

      // Tap 'Aceptar recepción' without entering a note
      await tester.tap(find.text('Aceptar recepción'));
      await tester.pumpAndSettle();

      // Expect snackbar warning about required note
      expect(find.textContaining('Registra una nota de diferencia obligatoria'),
          findsOneWidget);
    });
  });
}
