import 'dart:io';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
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

  static bool get isMobileNative {
    if (kIsWeb) return false;
    return Platform.isAndroid || Platform.isIOS;
  }

  @override
  Widget build(BuildContext context) {
    // On native mobile (Android/iOS app), show Bluetooth printer dialog
    if (isMobileNative) {
      return BluetoothSettingsDialog(state: state);
    }

    // On Web and Desktop (Windows/Mac/Linux), show System / Paper Width / Online Station printer dialog!
    return DesktopPrinterSettingsDialog(state: state);
  }
}
