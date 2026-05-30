class POSDevice {
  const POSDevice({
    required this.deviceId,
    required this.branchId,
    required this.registeredAt,
  });

  final String deviceId;
  final String branchId;
  final DateTime registeredAt;
}

class CachedUserSession {
  const CachedUserSession({
    required this.userId,
    required this.roleIds,
    required this.pinHash,
    required this.cachedAt,
    required this.expiresAt,
  });

  final String userId;
  final Set<String> roleIds;
  final String pinHash;
  final DateTime cachedAt;
  final DateTime expiresAt;

  bool get isActive => DateTime.now().isBefore(expiresAt);

  bool allows(String permission) {
    if (!isActive) return false;
    return roleIds.contains('admin') || roleIds.contains(permission);
  }
}

