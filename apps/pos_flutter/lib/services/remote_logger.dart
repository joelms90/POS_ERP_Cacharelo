import 'dart:async';
import 'dart:collection';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Ships client-side errors to `POST {apiUrl}/logs` so production issues can
/// be investigated per branch (sucursal) without access to the device.
///
/// Captures:
///  * uncaught Flutter/framework and async errors ([install]),
///  * failed HTTP calls (via `logged_http.dart`),
///  * existing `debugPrint` lines that look like errors (the app already
///    reports most handled failures that way), and
///  * a rolling trail of the last debugPrint lines as breadcrumbs.
///
/// Entries are queued in SharedPreferences, so they survive offline periods
/// and app restarts and are sent once the API is reachable again.
class RemoteLogger with WidgetsBindingObserver {
  RemoteLogger._();
  static final RemoteLogger instance = RemoteLogger._();

  static const _storageKey = 'remote_logger_queue_v1';
  static const _maxQueue = 200;
  static const _maxBreadcrumbs = 40;
  static const _dedupeWindow = Duration(minutes: 5);
  static final RegExp _errorLike = RegExp(
    r'(\berror\b|exception|\bfailed\b|\bfail[oó]\b|no se pudo|❌)',
    caseSensitive: false,
  );

  /// Supplies branch/user/device info at the moment an entry is created.
  Map<String, Object?> Function()? contextProvider;

  /// Supplies the API base URL (…/api). Nothing is sent while it is null.
  String? Function()? apiUrlProvider;

  /// Injectable for tests.
  http.Client? clientOverride;

  final List<Map<String, Object?>> _queue = [];
  final ListQueue<String> _breadcrumbs = ListQueue();
  final Map<String, DateTime> _recent = {};
  Timer? _periodic;
  Timer? _debounce;
  bool _flushing = false;
  bool _installed = false;
  bool _capturing = false;

  @visibleForTesting
  List<Map<String, Object?>> get pending => List.unmodifiable(_queue);

  @visibleForTesting
  void resetForTest() {
    _queue.clear();
    _breadcrumbs.clear();
    _recent.clear();
    _periodic?.cancel();
    _debounce?.cancel();
    _flushing = false;
  }

  /// Hooks global error handlers. Call once from `main()` after
  /// `WidgetsFlutterBinding.ensureInitialized()`.
  Future<void> install() async {
    if (_installed) return;
    _installed = true;

    final previousFlutterError = FlutterError.onError;
    FlutterError.onError = (details) {
      previousFlutterError?.call(details);
      error(
        details.exceptionAsString(),
        stack: details.stack,
        context: {
          'kind': 'flutter_error',
          if (details.library != null) 'library': details.library,
          if (details.context != null) 'widgetContext': details.context.toString(),
        },
        level: details.silent ? 'warn' : 'error',
      );
    };

    final previousPlatformError = PlatformDispatcher.instance.onError;
    PlatformDispatcher.instance.onError = (exception, stack) {
      error(exception.toString(), stack: stack, context: {'kind': 'uncaught_async'}, level: 'fatal');
      return previousPlatformError?.call(exception, stack) ?? true;
    };

    final originalDebugPrint = debugPrint;
    debugPrint = (String? message, {int? wrapWidth}) {
      originalDebugPrint(message, wrapWidth: wrapWidth);
      if (message != null) onDebugPrint(message);
    };

    WidgetsBinding.instance.addObserver(this);
    await _restore();
    _periodic = Timer.periodic(const Duration(seconds: 60), (_) => flush());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      flush();
    }
  }

  /// Adds a breadcrumb and promotes error-looking lines to `warn` entries.
  @visibleForTesting
  void onDebugPrint(String message) {
    breadcrumb(message);
    if (_capturing) return;
    if (_errorLike.hasMatch(message)) {
      log('warn', message, context: {'kind': 'debug_print'});
    }
  }

  void breadcrumb(String message) {
    final ts = DateTime.now().toIso8601String().substring(11, 19);
    final line = message.length > 300 ? '${message.substring(0, 300)}…' : message;
    _breadcrumbs.addLast('$ts $line');
    while (_breadcrumbs.length > _maxBreadcrumbs) {
      _breadcrumbs.removeFirst();
    }
  }

  void error(
    Object message, {
    StackTrace? stack,
    Map<String, Object?>? context,
    String level = 'error',
  }) {
    log(level, message.toString(), stack: stack, context: context);
  }

  void log(
    String level,
    String message, {
    StackTrace? stack,
    String? route,
    String? httpMethod,
    int? httpStatus,
    Map<String, Object?>? context,
  }) {
    if (_capturing) return; // never recurse from inside the logger
    _capturing = true;
    try {
      final dedupeKey = '$level|${route ?? ''}|${_normalize(message)}';
      final now = DateTime.now();
      _recent.removeWhere((_, t) => now.difference(t) > _dedupeWindow);
      final last = _recent[dedupeKey];
      if (last != null) {
        // Same issue already queued recently: bump its counter instead.
        for (final e in _queue.reversed) {
          if (e['_key'] == dedupeKey) {
            final ctx = Map<String, Object?>.from((e['context'] as Map?) ?? {});
            ctx['repeatCount'] = ((ctx['repeatCount'] as int?) ?? 1) + 1;
            e['context'] = ctx;
            break;
          }
        }
        return;
      }
      _recent[dedupeKey] = now;

      Map<String, Object?> base = {};
      try {
        base = contextProvider?.call() ?? {};
      } catch (_) {}

      _queue.add({
        '_key': dedupeKey,
        'source': 'pos_flutter',
        'level': level,
        'message': message,
        if (stack != null) 'stack': stack.toString(),
        'occurredAt': now.toUtc().toIso8601String(),
        'platform': kIsWeb ? 'web' : defaultTargetPlatform.name,
        if (route != null) 'route': route,
        if (httpMethod != null) 'httpMethod': httpMethod,
        if (httpStatus != null) 'httpStatus': httpStatus,
        if (context != null && context.isNotEmpty) 'context': context,
        'breadcrumbs': _breadcrumbs.toList(),
        ...base.map((k, v) => MapEntry(k, v?.toString())),
      });
      while (_queue.length > _maxQueue) {
        _queue.removeAt(0);
      }
      _persist();

      if (level == 'error' || level == 'fatal') {
        _debounce?.cancel();
        _debounce = Timer(const Duration(seconds: 3), flush);
      }
    } finally {
      _capturing = false;
    }
  }

  /// Sends queued entries. Safe to call often; failures keep the queue.
  Future<void> flush() async {
    if (_flushing || _queue.isEmpty) return;
    final apiUrl = apiUrlProvider?.call();
    if (apiUrl == null || apiUrl.isEmpty) return;

    _flushing = true;
    final batch = _queue.take(50).toList();
    try {
      final payload = batch.map((e) => Map.of(e)..remove('_key')).toList();
      final client = clientOverride ?? http.Client();
      try {
        final response = await client
            .post(
              Uri.parse('${apiUrl.replaceAll(RegExp(r'/+$'), '')}/logs'),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({'entries': payload}),
            )
            .timeout(const Duration(seconds: 10));
        // 2xx: stored. 4xx: payload will never be accepted; drop it too.
        if (response.statusCode < 500) {
          _queue.removeWhere((e) => batch.any((b) => identical(b, e)));
          await _persist();
        }
      } finally {
        if (clientOverride == null) client.close();
      }
    } catch (_) {
      // Offline or API down: keep entries for the next attempt.
    } finally {
      _flushing = false;
    }
  }

  static String _normalize(String message) => message
      .toLowerCase()
      .replaceAll(RegExp(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'), '<id>')
      .replaceAll(RegExp(r'\d+'), '<n>');

  Future<void> _persist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_storageKey, jsonEncode(_queue));
    } catch (_) {}
  }

  Future<void> _restore() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_storageKey);
      if (raw == null) return;
      final stored = (jsonDecode(raw) as List).whereType<Map>().map((e) => Map<String, Object?>.from(e));
      _queue.insertAll(0, stored);
      while (_queue.length > _maxQueue) {
        _queue.removeAt(0);
      }
    } catch (_) {}
  }
}
