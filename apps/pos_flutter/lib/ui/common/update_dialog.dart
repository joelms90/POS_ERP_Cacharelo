import 'dart:async';
import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../../services/version_service.dart';

/// Dialog to show update information and download options
class UpdateDialog extends StatelessWidget {
  final UpdateCheckResult updateResult;

  const UpdateDialog({
    super.key,
    required this.updateResult,
  });

  @override
  Widget build(BuildContext context) {
    final platform = VersionService.getCurrentPlatform();

    return AlertDialog(
      backgroundColor: EmpireColors.onyxSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(
          color: EmpireColors.agedBronze,
          width: 1.5,
        ),
      ),
      title: Row(
        children: [
          Icon(
            updateResult.updateAvailable
                ? Icons.system_update
                : Icons.check_circle,
            color: updateResult.updateAvailable
                ? EmpireColors.champagneGold
                : EmpireColors.successGreen,
            size: 28,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              updateResult.updateAvailable
                  ? 'Actualización Disponible'
                  : 'Versión Actualizada',
              style: const TextStyle(
                color: EmpireColors.textGold,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (updateResult.error != null) ...[
              _buildErrorContent(),
            ] else if (updateResult.updateAvailable) ...[
              _buildUpdateAvailableContent(platform),
            ] else ...[
              _buildUpToDateContent(),
            ],
          ],
        ),
      ),
      actions: [
        if (updateResult.error == null) ...[
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text(
              'Cerrar',
              style: TextStyle(color: EmpireColors.textSecondary),
            ),
          ),
          if (updateResult.updateAvailable) ...[
            if (platform == 'web')
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.of(context).pop();
                  VersionService.reloadWebApp();
                },
                icon: const Icon(Icons.refresh),
                label: const Text(
                  'Recargar App',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: EmpireColors.champagneGold,
                  foregroundColor: EmpireColors.obsidian,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 12,
                  ),
                ),
              )
            else
              ElevatedButton.icon(
                onPressed: () => _handleDownload(context),
                icon: const Icon(Icons.download),
                label: const Text(
                  'Descargar',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: EmpireColors.champagneGold,
                  foregroundColor: EmpireColors.obsidian,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 12,
                  ),
                ),
              ),
          ],
        ] else ...[
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(),
            style: ElevatedButton.styleFrom(
              backgroundColor: EmpireColors.champagneGold,
              foregroundColor: EmpireColors.obsidian,
            ),
            child: const Text('OK'),
          ),
        ],
      ],
    );
  }

  Widget _buildErrorContent() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: EmpireColors.errorRed.withValues(alpha: 0.1),
        border: Border.all(
          color: EmpireColors.errorRed.withValues(alpha: 0.3),
        ),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.error_outline,
            color: EmpireColors.errorRed,
            size: 24,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              updateResult.error!,
              style: const TextStyle(
                color: EmpireColors.errorRed,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUpdateAvailableContent(String platform) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildInfoRow('Versión Actual', updateResult.currentVersion ?? 'Desconocida'),
        const SizedBox(height: 8),
        _buildInfoRow('Nueva Versión', updateResult.latestVersion ?? 'Desconocida'),
        if (updateResult.size != null) ...[
          const SizedBox(height: 8),
          _buildInfoRow('Tamaño', updateResult.size!),
        ],
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: EmpireColors.charcoalSurface,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: EmpireColors.agedBronzeDark,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(
                    Icons.info_outline,
                    color: EmpireColors.champagneGold,
                    size: 18,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Instrucciones:',
                    style: TextStyle(
                      color: EmpireColors.champagneGold,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                VersionService.getUpdateInstructions(),
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 12,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _buildFallbackDownloadLinks(platform),
      ],
    );
  }

  Widget _buildFallbackDownloadLinks(String platform) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: EmpireColors.onyxSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: EmpireColors.agedBronzeDark,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.cloud_download,
                color: EmpireColors.textGold,
                size: 16,
              ),
              SizedBox(width: 8),
              Text(
                'Enlaces de Descarga Directa:',
                style: TextStyle(
                  color: EmpireColors.textGold,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (platform == 'windows') ...[
            _buildFallbackLink(
              'Windows',
              Icons.window,
              'https://storage.googleapis.com/cacharelo-pos-releases/windows/pos_flutter_windows_latest.zip',
            ),
          ] else if (platform == 'android') ...[
            _buildFallbackLink(
              'Android',
              Icons.android,
              'https://storage.googleapis.com/cacharelo-pos-releases/android/pos_flutter_android_latest.apk',
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildFallbackLink(String label, IconData icon, String url) {
    return InkWell(
      onTap: () => VersionService.downloadUpdate(url),
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: EmpireColors.charcoalSurface,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: EmpireColors.agedBronze.withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              color: EmpireColors.champagneGold,
              size: 18,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      color: EmpireColors.textPrimary,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Descargar última versión',
                    style: TextStyle(
                      color: EmpireColors.textSecondary.withValues(alpha: 0.8),
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.open_in_new,
              color: EmpireColors.textSecondary,
              size: 16,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildUpToDateContent() {
    final platform = VersionService.getCurrentPlatform();
    return Column(
      children: [
        _buildInfoRow('Versión Actual', updateResult.currentVersion ?? 'Desconocida'),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: EmpireColors.successGreen.withValues(alpha: 0.1),
            border: Border.all(
              color: EmpireColors.successGreen.withValues(alpha: 0.3),
            ),
            borderRadius: BorderRadius.circular(6),
          ),
          child: const Row(
            children: [
              Icon(
                Icons.check_circle_outline,
                color: EmpireColors.successGreen,
                size: 24,
              ),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Ya tienes la última versión instalada.',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (platform == 'windows' || platform == 'android') ...[
          const SizedBox(height: 16),
          _buildFallbackDownloadLinks(platform),
        ],
      ],
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          '$label:',
          style: const TextStyle(
            color: EmpireColors.textSecondary,
            fontSize: 13,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            color: EmpireColors.textGold,
            fontSize: 13,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Future<void> _handleDownload(BuildContext context) async {
    if (updateResult.downloadUrl == null) {
      return;
    }

    // Show loading indicator
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: EmpireColors.obsidian,
                ),
              ),
              SizedBox(width: 12),
              Text(
                'Abriendo descarga...',
                style: TextStyle(
                  color: EmpireColors.obsidian,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          backgroundColor: EmpireColors.champagneGold,
          duration: Duration(seconds: 2),
        ),
      );
    }

    // Attempt download
    final success = await VersionService.downloadUpdate(updateResult.downloadUrl!);

    if (context.mounted) {
      Navigator.of(context).pop();

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            success
                ? 'Descarga iniciada. Siga las instrucciones de instalación.'
                : 'No se pudo abrir la descarga. Intente nuevamente.',
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
            ),
          ),
          backgroundColor: success
              ? EmpireColors.successGreen
              : EmpireColors.errorRed,
          duration: const Duration(seconds: 3),
        ),
      );
    }
  }
}

/// Widget for update check button and status
class UpdateCheckButton extends StatefulWidget {
  const UpdateCheckButton({super.key});

  @override
  State<UpdateCheckButton> createState() => _UpdateCheckButtonState();
}

class _UpdateCheckButtonState extends State<UpdateCheckButton> {
  bool _isChecking = false;
  UpdateCheckResult? _lastResult;
  Timer? _initialCheckTimer;

  @override
  void initState() {
    super.initState();
    // Perform initial check after a short delay (don't block login)
    _initialCheckTimer = Timer(const Duration(seconds: 2), () {
      if (mounted) {
        _checkForUpdates(silent: true);
      }
    });
  }

  @override
  void dispose() {
    _initialCheckTimer?.cancel();
    super.dispose();
  }

  Future<void> _checkForUpdates({bool silent = false}) async {
    if (_isChecking) return;

    setState(() {
      _isChecking = true;
    });

    try {
      final result = await VersionService.checkForUpdates();

      if (mounted) {
        setState(() {
          _lastResult = result;
          _isChecking = false;
        });

        // Only show dialog on explicit user action (not silent checks)
        if (!silent) {
          _showUpdateDialog(result);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isChecking = false;
        });
      }
    }
  }

  void _showUpdateDialog(UpdateCheckResult result) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (context) => UpdateDialog(updateResult: result),
    );
  }

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: _isChecking ? null : () => _checkForUpdates(silent: false),
      style: TextButton.styleFrom(
        visualDensity: VisualDensity.compact,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_isChecking)
            const SizedBox(
              width: 12,
              height: 12,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: EmpireColors.textGold,
              ),
            )
          else
            Icon(
              _lastResult?.updateAvailable == true
                  ? Icons.system_update
                  : Icons.system_update_outlined,
              size: 14,
              color: _lastResult?.updateAvailable == true
                  ? EmpireColors.champagneGold
                  : EmpireColors.textGold,
            ),
          const SizedBox(width: 6),
          Text(
            _isChecking
                ? 'Verificando...'
                : (_lastResult?.updateAvailable == true
                    ? 'Actualización Disponible'
                    : 'Buscar Actualizaciones'),
            style: TextStyle(
              color: _lastResult?.updateAvailable == true
                  ? EmpireColors.champagneGold
                  : EmpireColors.textGold,
              fontSize: 11,
              fontWeight: _lastResult?.updateAvailable == true
                  ? FontWeight.bold
                  : FontWeight.normal,
              decoration: TextDecoration.underline,
            ),
          ),
        ],
      ),
    );
  }
}
