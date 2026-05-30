import 'isar_collections.dart';

class IsarDatabase {
  IsarDatabase._();

  static final InMemoryLocalStore _store = InMemoryLocalStore();

  static Future<InMemoryLocalStore> open() async {
    // The implementation uses an in-memory store until generated Isar collections are added.
    return _store;
  }

  static Future<void> migrate() async {
    await open();
  }
}

