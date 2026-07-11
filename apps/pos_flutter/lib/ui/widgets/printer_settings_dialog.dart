import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import '../common/colors.dart';
import '../common/app_state.dart';
import 'bluetooth_settings_dialog.dart';
import 'desktop_printer_settings_dialog.dart';

/// Platform-aware printer settings dialog
///
/// On Android/iOS: Shows Bluetooth printer configuration
/// On Desktop (Mac/Windows/Linux): Shows network/system printer configuration
class PrinterSettingsDialog extends StatelessWidget {
  final AppState state;

  const PrinterSettingsDialog({super.key, required this.state});

  static bool get isDesktop {
    if (kIsWeb) return false;
    return Platform.isMacOS || Platform.isWindows || Platform.isLinux;
  }

  static bool get isMobile {
    if (kIsWeb) return false;
    return Platform.isAndroid || Platform.isIOS;
  }

  @override
  Widget build(BuildContext context) {
    // On desktop platforms, show network printer dialog
    if (isDesktop) {
      return DesktopPrinterSettingsDialog(state: state);
    }

    // On mobile platforms, show Bluetooth printer dialog
    if (isMobile) {
      return BluetoothSettingsDialog(state: state);
    }

    // Fallback for web or unknown platforms
    return Dialog(
      backgroundColor: EmpireColors.obsidian,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: EmpireColors.agedBronze, width: 1.5),
      ),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 400, maxHeight: 300),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.print,
                  color: EmpireColors.champagneGold,
                  size: 24,
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'Configuración de Impresora',
                    style: TextStyle(
                      color: EmpireColors.champagneGold,
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: EmpireColors.errorRed.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: EmpireColors.errorRed.withOpacity(0.5)),
              ),
              child: const Text(
                'La configuración de impresoras no está disponible en esta plataforma.\n\nPor favor, usa la aplicación en Android, iOS, Windows, macOS o Linux.',
                style: TextStyle(color: EmpireColors.textPrimary, fontSize: 13),
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(),
              style: ElevatedButton.styleFrom(
                backgroundColor: EmpireColors.charcoalSurface,
                foregroundColor: EmpireColors.textPrimary,
                padding: const EdgeInsets.symmetric(vertical: 14),
                side: const BorderSide(color: EmpireColors.agedBronze),
              ),
              child: const Text('CERRAR', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}
