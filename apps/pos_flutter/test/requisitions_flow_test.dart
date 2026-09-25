import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:pos_flutter/services/secure_storage_service.dart';
import 'package:pos_flutter/models/local_requisition.dart';
import 'package:pos_flutter/ui/common/app_state.dart';
import 'package:pos_flutter/ui/requisitions/create_requisition.dart';

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
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('Requisition Model Tests', () {
    test('LocalBranchRequisition serializes and deserializes correctly', () {
      final item1 = LocalBranchRequisitionItem(
        id: 'item-1',
        requisitionId: 'req-1',
        productId: 'prod-1',
        quantityRequested: 10.0,
      );

      final requisition = LocalBranchRequisition(
        id: 'req-1',
        fromBranchId: 'branch-1',
        toWarehouseId: 'warehouse-1',
        status: 'pending_approval',
        notes: 'Please ship ASAP',
        createdAt: DateTime(2026, 7, 18),
        syncState: 'pending',
        items: [item1],
      );

      final map = requisition.toMap();
      expect(map['id'], equals('req-1'));
      expect(map['fromBranchId'], equals('branch-1'));
      expect(map['toWarehouseId'], equals('warehouse-1'));
      expect(map['status'], equals('pending_approval'));
      expect(map['notes'], equals('Please ship ASAP'));
      expect(map['syncState'], equals('pending'));
      expect(map['items'].length, equals(1));

      final decoded = LocalBranchRequisition.fromMap(map);
      expect(decoded.id, equals('req-1'));
      expect(decoded.notes, equals('Please ship ASAP'));
      expect(decoded.syncState, equals('pending'));
      expect(decoded.items.length, equals(1));
      expect(decoded.items[0].id, equals('item-1'));
      expect(decoded.items[0].quantityRequested, equals(10.0));
    });
  });

  group('Requisitions Cache & Storage Tests', () {
    late FakeSecureStorage fakeStorage;
    late SecureStorageService secureStorageService;

    setUp(() {
      fakeStorage = FakeSecureStorage();
      secureStorageService = SecureStorageService(secureStorage: fakeStorage);
    });

    test('savePendingRequisitions and getPendingRequisitions flow', () async {
      final listBefore = await secureStorageService.getPendingRequisitions();
      expect(listBefore, isEmpty);

      final itemMap = {
        'id': 'item-1',
        'requisitionId': 'req-1',
        'productId': 'prod-1',
        'quantityRequested': 5.0,
      };

      final reqMap = {
        'id': 'req-1',
        'fromBranchId': 'branch-1',
        'toWarehouseId': 'warehouse-1',
        'status': 'pending_approval',
        'notes': 'Test note',
        'createdAt': DateTime.now().toIso8601String(),
        'syncState': 'pending',
        'items': [itemMap],
      };

      await secureStorageService.savePendingRequisitions([reqMap]);

      final listAfter = await secureStorageService.getPendingRequisitions();
      expect(listAfter.length, equals(1));
      expect(listAfter[0]['id'], equals('req-1'));
      expect(listAfter[0]['notes'], equals('Test note'));
      expect(listAfter[0]['items'].length, equals(1));
    });
  });

  group('Requisitions UI Widget Tests', () {
    late AppState state;
    late FakeSecureStorage fakeStorage;

    setUp(() async {
      fakeStorage = FakeSecureStorage();
      state = AppState(secureStorageService: SecureStorageService(secureStorage: fakeStorage));
      await state.initializationFuture;
    });

    testWidgets('RequisitionsScreen renders empty state correctly', (WidgetTester tester) async {
      await tester.runAsync(() async {
        await tester.pumpWidget(
          MaterialApp(
            home: RequisitionsScreen(state: state),
          ),
        );
        await Future.delayed(const Duration(milliseconds: 100));
        await tester.pump();
      });

      expect(find.text('Sin Requisiciones'), findsOneWidget);
      expect(find.text('Presione el botón + para solicitar insumos.'), findsOneWidget);
      expect(find.byType(FloatingActionButton), findsOneWidget);
    });

    testWidgets('CreateRequisitionScreen renders form fields correctly', (WidgetTester tester) async {
      // Mock some warehouses and ingredients in AppState
      state.cachedWarehouses = [
        {'id': 'wh-1', 'name': 'Central Bodega'}
      ];
      state.cachedIngredients = [
        {'id': 'prod-1', 'name': 'Harina de Trigo', 'sku': 'HAR-01'}
      ];
      state.terminalBranchId = 'branch-1';

      await tester.pumpWidget(
        MaterialApp(
          home: CreateRequisitionScreen(state: state),
        ),
      );

      // Verify page titles and sections
      expect(find.text('Nueva Requisición'), findsOneWidget);
      expect(find.text('Bodega Destino'), findsNothing);
      expect(find.text('Insumos Solicitados'), findsOneWidget);
      expect(find.text('Notas / Comentarios'), findsOneWidget);
      expect(find.text('Cancelar creación'), findsOneWidget);
      expect(find.text('Enviar Requisición'), findsOneWidget);
    });
  });
}
