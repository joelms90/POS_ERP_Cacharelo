import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:pos_flutter/services/cash_offline_queue.dart';
import 'package:pos_flutter/ui/common/app_state.dart';
import 'package:pos_flutter/ui/encargado/pending_approvals_view.dart';

Map<String, dynamic> _movement(String id, String user, String type, num amount,
        {String shift = 'shift-1'}) =>
    {
      'kind': 'movement',
      'clientUuid': id,
      'shiftId': shift,
      'userId': user,
      'payload': {'type': type, 'amount': amount.toStringAsFixed(2)},
    };

Map<String, dynamic> _close(String id, String user,
        {String shift = 'shift-1'}) =>
    {
      'kind': 'close',
      'clientUuid': id,
      'shiftId': shift,
      'userId': user,
      'payload': {'actualAmount': '100.00'},
    };

void main() {
  late List<Map<String, dynamic>> stored;
  late CashOfflineQueue queue;

  setUp(() {
    stored = [];
    queue = CashOfflineQueue(
      load: () async =>
          stored.map((j) => Map<String, dynamic>.from(j)).toList(),
      save: (jobs) async =>
          stored = jobs.map((j) => Map<String, dynamic>.from(j)).toList(),
    );
  });

  test('sends a user\'s jobs in FIFO order: movements before their Corte Z',
      () async {
    await queue.enqueue(_movement('m1', 'u1', 'cash-out', 50));
    await queue.enqueue(_movement('m2', 'u1', 'cash-in', 20));
    await queue.enqueue(_close('c1', 'u1'));
    final sent = <String>[];
    await queue.flush(
      userId: 'u1',
      send: (job) async {
        sent.add(job['clientUuid'] as String);
        return const CashJobOutcome(CashJobResult.sent);
      },
    );
    expect(sent, ['m1', 'm2', 'c1']);
    expect(queue.pendingCount, 0);
    expect(stored, isEmpty);
  });

  test('stops at the first network failure and keeps the order for the retry',
      () async {
    await queue.enqueue(_movement('m1', 'u1', 'cash-out', 50));
    await queue.enqueue(_close('c1', 'u1'));
    final sent = <String>[];
    await queue.flush(
      userId: 'u1',
      send: (job) async {
        sent.add(job['clientUuid'] as String);
        return const CashJobOutcome(CashJobResult.retryLater);
      },
    );
    expect(sent, ['m1'], reason: 'the Corte Z must not overtake its movement');
    expect(queue.jobs.map((j) => j['clientUuid']), ['m1', 'c1']);
  });

  test('a business rejection is kept apart and does not block the rest',
      () async {
    await queue.enqueue(_movement('m1', 'u1', 'cash-out', 5000));
    await queue.enqueue(_close('c1', 'u1'));
    await queue.flush(
      userId: 'u1',
      send: (job) async => job['clientUuid'] == 'm1'
          ? const CashJobOutcome(CashJobResult.rejected,
              message: 'Esperado negativo')
          : const CashJobOutcome(CashJobResult.sent),
    );
    expect(queue.pendingCount, 0);
    expect(queue.rejected.single['clientUuid'], 'm1');
    expect(queue.rejected.single['error'], 'Esperado negativo');
    await queue.dismissRejected();
    expect(queue.jobs, isEmpty);
  });

  test(
      'only the logged-in user\'s jobs are sent; others wait for their session',
      () async {
    await queue.enqueue(_movement('a1', 'cashier-a', 'cash-in', 10));
    await queue.enqueue(_movement('b1', 'cashier-b', 'cash-in', 10));
    final sent = <String>[];
    await queue.flush(
      userId: 'cashier-b',
      send: (job) async {
        sent.add(job['clientUuid'] as String);
        return const CashJobOutcome(CashJobResult.sent);
      },
    );
    expect(sent, ['b1']);
    expect(queue.jobs.single['clientUuid'], 'a1');
    expect(
        await queue.flush(
            userId: null,
            send: (_) async => const CashJobOutcome(CashJobResult.sent)),
        isEmpty);
  });

  test('survives a restart and reports pending effects and closes per shift',
      () async {
    await queue.enqueue(_movement('m1', 'u1', 'cash-out', 80));
    await queue.enqueue(_movement('m2', 'u1', 'cash-in', 30));
    await queue.enqueue(_movement('m3', 'u1', 'cash-in', 999, shift: 'other'));
    await queue.enqueue(_close('c1', 'u1'));

    final restored =
        CashOfflineQueue(load: () async => stored, save: (_) async {});
    await restored.restore();
    expect(restored.pendingCount, 4);
    expect(restored.pendingCashEffect('shift-1'), -50);
    expect(restored.hasPendingClose('shift-1'), isTrue);
    expect(restored.hasPendingClose('other'), isFalse);
  });

  test('provisional Corte Z marks the estimate and the unsynced movements', () {
    final report = AppState.buildProvisionalCorteReport(
      shiftId: 'shift-1',
      cashierName: 'Ana',
      branchName: 'Centro',
      initialFloat: 500,
      actualAmount: 940,
      localExpectedCash: 950,
      closedAt: DateTime.utc(2026, 11, 22, 21),
      queuedMovements: [
        {'type': 'cash-out', 'amount': '50.00', 'reason': 'Hielo'},
      ],
    );
    expect(report['provisional'], isTrue);
    expect(report['summary']['cashDifference'], -10);
    expect(report['cashMovements'].single['approvalStatus'], 'pendiente_sync');
    expect(
        AppState.shiftReviewLabel('pendiente_sync'), contains('sin conexión'));

    final unknown = AppState.buildProvisionalCorteReport(
      shiftId: 'shift-1',
      cashierName: null,
      branchName: null,
      initialFloat: 0,
      actualAmount: 100,
      localExpectedCash: null,
      closedAt: DateTime.utc(2026),
    );
    expect(unknown['summary']['cashDifference'], isNull);
  });

  testWidgets('the inbox lists offline operations the server rejected',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final state = _RejectedJobsState([
      {
        ..._movement('m1', 'u1', 'cash-out', 120),
        'status': 'rejected',
        'error': 'Cannot add transactions to a closed shift.',
      },
    ])
      ..currentUserId = 'u1';

    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: PendingApprovalsView(
            state: state, mode: ApprovalsViewMode.cashier, compact: true),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Operaciones sin conexión rechazadas por el servidor'),
        findsOneWidget);
    expect(find.textContaining('Retiro de \$120.00'), findsOneWidget);
    await tester.tap(find.text('ENTENDIDO'));
    await tester.pumpAndSettle();
    expect(find.text('Operaciones sin conexión rechazadas por el servidor'),
        findsNothing);
  });
}

/// Avoids the platform-backed secure storage, which never completes in tests.
class _RejectedJobsState extends AppState {
  _RejectedJobsState(this._rejected);

  List<Map<String, dynamic>> _rejected;

  @override
  List<Map<String, dynamic>> get rejectedCashJobs => _rejected;

  @override
  Future<void> dismissRejectedCashJobs() async {
    _rejected = [];
    notifyListeners();
  }

  @override
  Future<Map<String, List<Map<String, dynamic>>>?> fetchCashApprovals() async =>
      {'cortes': [], 'movements': []};
}
