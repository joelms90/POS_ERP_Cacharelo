/// Drop-in replacement for `package:http/http.dart` top-level helpers that
/// reports failed requests to [RemoteLogger].
///
/// Usage: `import '../../services/logged_http.dart' as http;` — every
/// `http.get/post/put/patch/delete` call and `http.Response` type keeps
/// working unchanged.
library;

import 'dart:convert';

import 'package:http/http.dart' as http;

import 'remote_logger.dart';

export 'package:http/http.dart' hide get, post, put, patch, delete, head, read, readBytes;

Future<http.Response> get(Uri url, {Map<String, String>? headers}) =>
    _tracked('GET', url, () => http.get(url, headers: headers));

Future<http.Response> head(Uri url, {Map<String, String>? headers}) =>
    _tracked('HEAD', url, () => http.head(url, headers: headers));

Future<http.Response> post(Uri url, {Map<String, String>? headers, Object? body, Encoding? encoding}) =>
    _tracked('POST', url, () => http.post(url, headers: headers, body: body, encoding: encoding));

Future<http.Response> put(Uri url, {Map<String, String>? headers, Object? body, Encoding? encoding}) =>
    _tracked('PUT', url, () => http.put(url, headers: headers, body: body, encoding: encoding));

Future<http.Response> patch(Uri url, {Map<String, String>? headers, Object? body, Encoding? encoding}) =>
    _tracked('PATCH', url, () => http.patch(url, headers: headers, body: body, encoding: encoding));

Future<http.Response> delete(Uri url, {Map<String, String>? headers, Object? body, Encoding? encoding}) =>
    _tracked('DELETE', url, () => http.delete(url, headers: headers, body: body, encoding: encoding));

Future<String> read(Uri url, {Map<String, String>? headers}) => http.read(url, headers: headers);

Future<List<int>> readBytes(Uri url, {Map<String, String>? headers}) => http.readBytes(url, headers: headers);

/// Status codes that are normal app flow rather than bugs.
const _expectedStatuses = {401, 404};

Future<http.Response> _tracked(String method, Uri url, Future<http.Response> Function() send) async {
  final logger = RemoteLogger.instance;
  final watch = Stopwatch()..start();
  final path = url.path;
  try {
    final response = await send();
    watch.stop();
    logger.breadcrumb('$method $path → ${response.statusCode} (${watch.elapsedMilliseconds}ms)');
    final status = response.statusCode;
    if (status >= 400 && !_expectedStatuses.contains(status)) {
      final body = response.body;
      logger.log(
        status >= 500 ? 'error' : 'warn',
        'HTTP $status $method $path',
        route: url.hasQuery ? '$path?${url.query}' : path,
        httpMethod: method,
        httpStatus: status,
        context: {
          'kind': 'http_response',
          'durationMs': watch.elapsedMilliseconds,
          'host': url.host,
          'responseBody': body.length > 500 ? '${body.substring(0, 500)}…' : body,
        },
      );
    }
    return response;
  } catch (e, stack) {
    watch.stop();
    logger.breadcrumb('$method $path ✗ ${e.runtimeType} (${watch.elapsedMilliseconds}ms)');
    logger.log(
      'warn',
      'HTTP network failure $method $path: ${e.runtimeType}',
      stack: stack,
      route: path,
      httpMethod: method,
      context: {
        'kind': 'http_exception',
        'durationMs': watch.elapsedMilliseconds,
        'host': url.host,
        'error': e.toString(),
      },
    );
    rethrow;
  }
}
