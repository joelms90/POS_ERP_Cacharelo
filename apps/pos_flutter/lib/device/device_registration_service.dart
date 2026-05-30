import '../domain/device_and_auth.dart';
import '../domain/identity.dart';
import '../local_store/isar_collections.dart';

abstract class DeviceRegistrationApi {
  Future<String> registerDevice({required String branchId});
}

class DeviceRegistrationService {
  DeviceRegistrationService(this.store, this.api);

  final InMemoryLocalStore store;
  final DeviceRegistrationApi api;

  Future<POSDevice> ensureRegistered(String branchId) async {
    final existing = store.snapshot.device;
    if (existing != null) return existing;
    final registeredId = await api.registerDevice(branchId: branchId);
    final device = POSDevice(
      deviceId: registeredId.isEmpty ? newUuidV4() : registeredId,
      branchId: branchId,
      registeredAt: DateTime.now().toUtc(),
    );
    store.snapshot.device = device;
    return device;
  }
}

