import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';

/// Metadata for version information from release server
class VersionMetadata {
  final String lastUpdated;
  final String currentVersion;
  final Map<String, PlatformRelease> platforms;

  VersionMetadata({
    required this.lastUpdated,
    required this.currentVersion,
    required this.platforms,
  });

  factory VersionMetadata.fromJson(Map<String, dynamic> json) {
    final platformsMap = <String, PlatformRelease>{};
    final platformsData = json['platforms'] as Map<String, dynamic>? ?? {};

    platformsData.forEach((key, value) {
      platformsMap[key] = PlatformRelease.fromJson(value as Map<String, dynamic>);
    });

    return VersionMetadata(
      lastUpdated: json['lastUpdated'] as String? ?? '',
      currentVersion: json['currentVersion'] as String? ?? '1.0.0',
      platforms: platformsMap,
    );
  }
}

/// Platform-specific release information
class PlatformRelease {
  final String version;
  final String downloadUrl;
  final String size;
  final String commit;
  final String branch;
  final String buildDate;

  PlatformRelease({
    required this.version,
    required this.downloadUrl,
    required this.size,
    required this.commit,
    required this.branch,
    required this.buildDate,
  });

  factory PlatformRelease.fromJson(Map<String, dynamic> json) {
    return PlatformRelease(
      version: json['version'] as String? ?? '',
      downloadUrl: json['downloadUrl'] as String? ?? '',
      size: json['size'] as String? ?? '',
      commit: json['commit'] as String? ?? '',
      branch: json['branch'] as String? ?? '',
      buildDate: json['buildDate'] as String? ?? '',
    );
  }
}

/// Result of version check
class UpdateCheckResult {
  final bool updateAvailable;
  final String? latestVersion;
  final String? currentVersion;
  final String? downloadUrl;
  final String? size;
  final String? error;

  UpdateCheckResult({
    required this.updateAvailable,
    this.latestVersion,
    this.currentVersion,
    this.downloadUrl,
    this.size,
    this.error,
  });
}

/// Service for checking app version and managing updates
class VersionService {
  static const String metadataUrl =
      'https://storage.googleapis.com/cacharelo-pos-releases/metadata.json';

  /// Timeout for HTTP requests
  static const Duration requestTimeout = Duration(seconds: 10);

  /// Cache duration for version checks (1 hour)
  static const Duration cacheDuration = Duration(hours: 1);

  /// Cached metadata
  static VersionMetadata? _cachedMetadata;
  static DateTime? _lastCheck;

  /// Get current platform identifier (web, android, windows, etc.)
  static String getCurrentPlatform() {
    if (kIsWeb) {
      return 'web';
    }

    if (Platform.isAndroid) {
      return 'android';
    }

    if (Platform.isWindows) {
      return 'windows';
    }

    if (Platform.isIOS) {
      return 'ios';
    }

    if (Platform.isMacOS) {
      return 'macos';
    }

    if (Platform.isLinux) {
      return 'linux';
    }

    return 'unknown';
  }

  /// Get current app version from package info
  static Future<String> getCurrentVersion() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      return packageInfo.version;
    } catch (e) {
      // Fallback version if package_info fails
      return '1.0.0';
    }
  }

  /// Fetch version metadata from server
  static Future<VersionMetadata?> fetchMetadata({bool forceRefresh = false}) async {
    // Return cached data if still valid
    if (!forceRefresh &&
        _cachedMetadata != null &&
        _lastCheck != null &&
        DateTime.now().difference(_lastCheck!) < cacheDuration) {
      return _cachedMetadata;
    }

    try {
      final response = await http
          .get(Uri.parse(metadataUrl))
          .timeout(requestTimeout);

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        _cachedMetadata = VersionMetadata.fromJson(json);
        _lastCheck = DateTime.now();
        return _cachedMetadata;
      } else {
        return null;
      }
    } catch (e) {
      // Network error or timeout
      return null;
    }
  }

  /// Check if an update is available for the current platform
  static Future<UpdateCheckResult> checkForUpdates() async {
    try {
      final metadata = await fetchMetadata();

      if (metadata == null) {
        return UpdateCheckResult(
          updateAvailable: false,
          error: 'No se pudo conectar al servidor de actualizaciones',
        );
      }

      final platform = getCurrentPlatform();
      final platformRelease = metadata.platforms[platform];

      if (platformRelease == null) {
        return UpdateCheckResult(
          updateAvailable: false,
          error: 'No hay actualizaciones disponibles para esta plataforma',
        );
      }

      final currentVersion = await getCurrentVersion();
      final latestVersion = platformRelease.version;

      // For now, we'll compare version strings directly
      // In production, you might want more sophisticated version comparison
      final updateAvailable = _isNewerVersion(latestVersion, currentVersion);

      return UpdateCheckResult(
        updateAvailable: updateAvailable,
        latestVersion: latestVersion,
        currentVersion: currentVersion,
        downloadUrl: platformRelease.downloadUrl,
        size: platformRelease.size,
      );
    } catch (e) {
      return UpdateCheckResult(
        updateAvailable: false,
        error: 'Error al verificar actualizaciones: $e',
      );
    }
  }

  /// Compare version strings using semver-like comparison.
  /// Handles both plain semver (1.0.0) and date-stamped versions (v1.0.0-20260718-183459).
  static bool _isNewerVersion(String latest, String current) {
    final latestClean = latest.replaceAll('v', '').split('-')[0];
    final currentClean = current.replaceAll('v', '').split('-')[0];

    final latestParts = latestClean
        .split('.')
        .map((p) => int.tryParse(p) ?? 0)
        .toList();
    final currentParts = currentClean
        .split('.')
        .map((p) => int.tryParse(p) ?? 0)
        .toList();

    while (latestParts.length < 3) {
      latestParts.add(0);
    }
    while (currentParts.length < 3) {
      currentParts.add(0);
    }

    for (int i = 0; i < 3; i++) {
      if (latestParts[i] > currentParts[i]) return true;
      if (latestParts[i] < currentParts[i]) return false;
    }

    // Base versions are equal. Check if latest has a date/build suffix
    // that current doesn't (indicating a newer build of the same version).
    final latestHasSuffix = latest.contains('-');
    final currentHasSuffix = current.contains('-');

    if (latestHasSuffix && !currentHasSuffix) return true;
    if (!latestHasSuffix && currentHasSuffix) return false;
    if (latestHasSuffix && currentHasSuffix) {
      final latestSuffix = latest.split('-').skip(1).join('-');
      final currentSuffix = current.split('-').skip(1).join('-');
      return latestSuffix.compareTo(currentSuffix) > 0;
    }

    return false;
  }

  /// Download/open update based on platform
  static Future<bool> downloadUpdate(String downloadUrl) async {
    try {
      final uri = Uri.parse(downloadUrl);
      // Call launchUrl directly to bypass Android 11+ package visibility query restrictions
      return await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
    } catch (e) {
      print('Error launching download URL: $e');
      return false;
    }
  }

  /// Get platform-specific update instructions
  static String getUpdateInstructions() {
    final platform = getCurrentPlatform();

    switch (platform) {
      case 'web':
        return 'La aplicación web se actualiza automáticamente. '
               'Presione "Recargar" para asegurar que tiene la última versión.';

      case 'android':
        return '1. Descargue el archivo APK\n'
               '2. Abra el archivo descargado\n'
               '3. Permita la instalación de fuentes desconocidas si es necesario\n'
               '4. Siga las instrucciones en pantalla';

      case 'windows':
        return '1. Descargue el archivo ZIP\n'
               '2. Cierre esta aplicación\n'
               '3. Extraiga el contenido del ZIP\n'
               '4. Reemplace los archivos existentes\n'
               '5. Ejecute pos_flutter.exe';

      default:
        return 'Descargue e instale la actualización siguiendo las instrucciones específicas de su plataforma.';
    }
  }

  /// Reload web app (web platform only)
  static void reloadWebApp() {
    if (kIsWeb) {
      // For web, we'll use url_launcher to navigate to the current URL
      // which effectively reloads the app
      final currentUrl = Uri.base;
      launchUrl(currentUrl, mode: LaunchMode.platformDefault);
    }
  }

  /// Clear cached metadata (useful for testing)
  static void clearCache() {
    _cachedMetadata = null;
    _lastCheck = null;
  }
}
