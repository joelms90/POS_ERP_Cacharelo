import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:pos_flutter/ui/common/app_state.dart';
import 'package:pos_flutter/ui/encargado/pending_approvals_view.dart';

/// AppState with the spec 019 network calls replaced by in-memory fakes.
class _FakeApprovalsState extends AppState {
  _FakeApprovalsState(this.cortes, this.movements);

  List<Map<String, dynamic>> cortes;
  List<Map<String, dynamic>> movements;
  final List<Map<String, dynamic>> resolved = [];
  final List<Map<String, dynamic>> recounts = [];

  @override
  Future<Map<String, List<Map<String, dynamic>>>?> fetchCashApprovals() async {
    pendingApprovalsCount =
        [...cortes, ...movements].where((i) => i['canAct'] == true).length;
    return {'cortes': cortes, 'movements': movements};
  }

  @override
  Future<bool> resolveCashApproval({
    required String kind,
    required String id,
    required int version,
    required bool approve,
    String? reason,
  }) async {
    resolved.add({
      'kind': kind,
      'id': id,
      'version': version,
      'approve': approve,
      'reason': reason,
    });
    return true;
  }

  @override
  Future<bool> recountShift(String shiftId, double actualAmount,
      {Map<String, num>? denominationCounts, String? notes}) async {
    recounts.add({'id': shiftId, 'amount': actualAmount, 'notes': notes});
    return true;
  }
}

Map<String, dynamic> _corte({
  required String id,
  required String status,
  bool canAct = false,
  String cashierId = 'cashier-1',
  String? closedBy,
}) =>
    {
      'id': id,
      'branchId': 'branch-1',
      'cashierId': cashierId,
      'cashierName': 'Cajera Ana',
      'closedBy': closedBy ?? cashierId,
      'closedAt': '2026-11-22T20:00:00.000Z',
      'reviewStatus': status,
      'counted': 950,
      'cashDifference': -50,
      'openBlocking': status == 'pendiente_n1',
      'version': 3,
      'canAct': canAct,
    };

Widget _host(AppState state, ApprovalsViewMode mode, {bool compact = false}) =>
    MaterialApp(
      home: Scaffold(
        body: PendingApprovalsView(state: state, mode: mode, compact: compact),
      ),
    );

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets(
      'OIS sees actionable cortes and movements and approves with the server version',
      (tester) async {
    final state = _FakeApprovalsState(
      [_corte(id: 'z-1', status: 'pendiente_n1', canAct: true)],
      [
        {
          'id': 'mv-1',
          'type': 'cash-out',
          'amount': 120,
          'reason': 'Gasto operativo: hielo',
          'authorName': 'Cajera Ana',
          'approvalStatus': 'pendiente_n1',
          'createdBy': 'cashier-1',
          'version': 1,
          'canAct': true,
        },
      ],
    )..currentUserId = 'ois-1';

    await tester.pumpWidget(_host(state, ApprovalsViewMode.operator));
    await tester.pumpAndSettle();

    expect(find.text('Por aprobar'), findsOneWidget);
    expect(find.text('Bloquea apertura'), findsOneWidget);
    expect(find.text('APROBAR'), findsNWidgets(2));

    await tester.tap(find.text('APROBAR').first);
    await tester.pumpAndSettle();
    expect(find.textContaining('Aprobación final'), findsOneWidget);
    await tester.tap(find.text('CONFIRMAR'));
    await tester.pumpAndSettle();

    expect(state.resolved.single, containsPair('kind', 'corte'));
    expect(state.resolved.single['version'], 3);
    expect(state.resolved.single['approve'], isTrue);
  });

  testWidgets('rejecting requires a reason and explains the ledger reversal',
      (tester) async {
    final state = _FakeApprovalsState([], [
      {
        'id': 'mv-1',
        'type': 'cash-out',
        'amount': 800,
        'reason': 'Gasto sin comprobante',
        'approvalStatus': 'pendiente_n1',
        'createdBy': 'cashier-1',
        'version': 2,
        'canAct': true,
      },
    ])
      ..currentUserId = 'ois-1';

    await tester.pumpWidget(_host(state, ApprovalsViewMode.operator));
    await tester.pumpAndSettle();
    await tester.tap(find.text('RECHAZAR'));
    await tester.pumpAndSettle();

    expect(find.textContaining('asiento de reverso'), findsOneWidget);
    final confirm = find.widgetWithText(ElevatedButton, 'CONFIRMAR');
    expect(tester.widget<ElevatedButton>(confirm).onPressed, isNull);

    await tester.enterText(find.byType(TextField), 'Sin ticket');
    await tester.pumpAndSettle();
    expect(tester.widget<ElevatedButton>(confirm).onPressed, isNotNull);
    await tester.tap(confirm);
    await tester.pumpAndSettle();

    expect(state.resolved.single, containsPair('approve', false));
    expect(state.resolved.single, containsPair('reason', 'Sin ticket'));
    expect(state.resolved.single, containsPair('kind', 'movement'));
  });

  testWidgets('items the operator cannot resolve show no action buttons',
      (tester) async {
    final state = _FakeApprovalsState(
      [_corte(id: 'z-2', status: 'pendiente_n2')],
      [],
    )..currentUserId = 'ois-1';

    await tester.pumpWidget(_host(state, ApprovalsViewMode.operator));
    await tester.pumpAndSettle();

    expect(find.text('APROBAR'), findsNothing);
    expect(find.text('Pendiente nivel 2 (histórico)'), findsOneWidget);
  });

  testWidgets('cashier compact view renders nothing without own cortes',
      (tester) async {
    final state = _FakeApprovalsState(
      [_corte(id: 'z-3', status: 'pendiente_n1', cashierId: 'someone-else')],
      [],
    )..currentUserId = 'cashier-1';

    await tester
        .pumpWidget(_host(state, ApprovalsViewMode.cashier, compact: true));
    await tester.pumpAndSettle();

    expect(find.text('Mis cortes de caja'), findsNothing);
  });

  testWidgets('cashier sees a rejected corte and recounts it', (tester) async {
    final state = _FakeApprovalsState(
      [_corte(id: 'z-4', status: 'rechazado_n2')],
      [],
    )..currentUserId = 'cashier-1';

    await tester
        .pumpWidget(_host(state, ApprovalsViewMode.cashier, compact: true));
    await tester.pumpAndSettle();

    expect(find.text('Rechazado por supervisor — recontar'), findsOneWidget);
    await tester.tap(find.text('RECONTAR'));
    await tester.pumpAndSettle();
    expect(find.textContaining('revisión final'), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, '1000');
    await tester.pumpAndSettle();
    await tester.tap(find.text('ENVIAR RECONTEO'));
    await tester.pumpAndSettle();

    expect(state.recounts.single, containsPair('id', 'z-4'));
    expect(state.recounts.single['amount'], 1000.0);
  });

  test('cash categories map to the structured codes of the API', () {
    expect(AppState.cashCategoryCode('Gasto operativo'), 'gasto_operativo');
    expect(AppState.cashCategoryCode('Entrega a encargado / Retiro parcial'),
        'entrega_encargado');
    expect(AppState.cashCategoryCode('Otro retiro'), 'otro_egreso');
    expect(AppState.cashCategoryCode('Desconocida'), isNull);
    expect(AppState.shiftReviewLabel('pendiente_n1'),
        'Pendiente de aprobación');
    expect(AppState.movementStatusLabel('rechazado'), 'Rechazado');
  });
}
