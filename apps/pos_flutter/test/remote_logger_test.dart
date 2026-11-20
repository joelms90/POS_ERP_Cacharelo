import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:pos_flutter/services/remote_logger.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final logger = RemoteLogger.instance;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    logger.resetForTest();
    logger.clientOverride = null;
    logger.apiUrlProvider = () => 'https://api.test/api';
    logger.contextProvider = () => {'branchId': 'branch-1', 'branchName': 'Centro', 'userName': 'Ana'};
  });

  test('queues entries with branch context and breadcrumbs', () {
    logger.breadcrumb('opened POS tab');
    logger.error('Boom', stack: StackTrace.current);

    final entry = logger.pending.single;
    expect(entry['source'], 'pos_flutter');
    expect(entry['level'], 'error');
    expect(entry['branchName'], 'Centro');
    expect((entry['breadcrumbs'] as List).single, contains('opened POS tab'));
    expect(entry['stack'], isNotNull);
  });

  test('promotes error-looking debugPrint lines and ignores normal ones', () {
    logger.onDebugPrint('SyncOperators loaded 5 operators.');
    logger.onDebugPrint('Error syncing operators: SocketException');
    expect(logger.pending, hasLength(1));
    expect(logger.pending.single['level'], 'warn');
  });

  test('dedupes repeats of the same issue into a counter', () {
    for (var i = 0; i < 5; i++) {
      logger.log('error', 'Order $i failed with 500');
    }
    expect(logger.pending, hasLength(1));
    expect((logger.pending.single['context'] as Map)['repeatCount'], 5);
  });

  test('flush posts the batch and clears the queue', () async {
    late Map<String, dynamic> sent;
    logger.clientOverride = MockClient((req) async {
      expect(req.url.toString(), 'https://api.test/api/logs');
      sent = jsonDecode(req.body) as Map<String, dynamic>;
      return http.Response('{"accepted":1}', 202);
    });
    logger.error('Printer not found');
    await logger.flush();

    expect(logger.pending, isEmpty);
    final entries = sent['entries'] as List;
    expect(entries.single['message'], 'Printer not found');
    expect((entries.single as Map).containsKey('_key'), isFalse);
  });

  test('keeps entries when the API is unreachable', () async {
    logger.clientOverride = MockClient((_) async => throw http.ClientException('offline'));
    logger.error('Sale sync failed');
    await logger.flush();
    expect(logger.pending, hasLength(1));
  });
}
