import 'dart:convert';

import 'package:http/http.dart' as http;

import '../domain/sync_operation.dart';

class SyncApiResponse {
  const SyncApiResponse({
    required this.statusCode,
    required this.body,
  });

  final int statusCode;
  final Map<String, Object?> body;
}

class SyncApiClient {
  SyncApiClient({
    required this.baseUri,
    http.Client? client,
  }) : client = client ?? http.Client();

  final Uri baseUri;
  final http.Client client;

  Future<SyncApiResponse> submit(SyncOperation operation) async {
    final response = await client.post(
      baseUri.resolve('/v1/sync/transactions'),
      headers: {
        'content-type': 'application/json',
        'Idempotency-Key': operation.idempotencyKey,
      },
      body: jsonEncode(operation.payload),
    );
    return SyncApiResponse(
      statusCode: response.statusCode,
      body: response.body.isEmpty
          ? <String, Object?>{}
          : jsonDecode(response.body) as Map<String, Object?>,
    );
  }
}

