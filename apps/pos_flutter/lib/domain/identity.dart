import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:uuid/uuid.dart';

const _uuid = Uuid();

String newUuidV4() => _uuid.v4();

String canonicalPayloadHash(Map<String, Object?> payload) {
  final normalized = _normalize(payload);
  return sha256.convert(utf8.encode(jsonEncode(normalized))).toString();
}

Object? _normalize(Object? value) {
  if (value is Map) {
    final entries = value.entries.toList()
      ..sort((a, b) => a.key.toString().compareTo(b.key.toString()));
    return {
      for (final entry in entries) entry.key.toString(): _normalize(entry.value),
    };
  }
  if (value is Iterable) {
    return value.map(_normalize).toList(growable: false);
  }
  return value;
}

bool looksLikeUuidV4(String value) {
  final pattern = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    caseSensitive: false,
  );
  return pattern.hasMatch(value);
}

