import 'package:flutter_test/flutter_test.dart';
import 'package:pos_erp_offline_pos/domain/printing.dart';
import 'package:pos_erp_offline_pos/platform/android/android_bluetooth_printer_adapter.dart';

void main() {
  test('android bluetooth adapter accepts android bluetooth printer', () async {
    final adapter = AndroidBluetoothPrinterAdapter();
    const printer = PrinterDevice(
      id: 'p1',
      name: 'BT',
      platform: PrinterPlatform.android,
      transport: PrinterTransport.bluetooth,
      address: '00:11:22',
      capabilities: PrinterCapabilities(paperWidth: '58mm', encoding: 'cp437'),
    );

    await adapter.send(printer, [27, 64]);
  });
}

