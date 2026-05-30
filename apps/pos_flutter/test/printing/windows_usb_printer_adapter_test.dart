import 'package:flutter_test/flutter_test.dart';
import 'package:pos_erp_offline_pos/domain/printing.dart';
import 'package:pos_erp_offline_pos/platform/windows/windows_usb_printer_adapter.dart';

void main() {
  test('windows usb adapter accepts windows usb printer', () async {
    final adapter = WindowsUsbPrinterAdapter();
    const printer = PrinterDevice(
      id: 'p1',
      name: 'USB',
      platform: PrinterPlatform.windows,
      transport: PrinterTransport.usb,
      address: 'USB001',
      capabilities: PrinterCapabilities(paperWidth: '58mm', encoding: 'cp437'),
    );

    await adapter.send(printer, [27, 64]);
  });
}

