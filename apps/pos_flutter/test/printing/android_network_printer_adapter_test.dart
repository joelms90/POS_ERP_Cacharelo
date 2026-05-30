import 'package:flutter_test/flutter_test.dart';
import 'package:pos_erp_offline_pos/domain/printing.dart';
import 'package:pos_erp_offline_pos/platform/android/android_network_printer_adapter.dart';

void main() {
  test('android network adapter accepts host port address', () async {
    final adapter = AndroidNetworkPrinterAdapter();
    const printer = PrinterDevice(
      id: 'p1',
      name: 'LAN',
      platform: PrinterPlatform.android,
      transport: PrinterTransport.network,
      address: '192.168.1.20:9100',
      capabilities: PrinterCapabilities(paperWidth: '80mm', encoding: 'cp437'),
    );

    await adapter.send(printer, [27, 64]);
  });
}

