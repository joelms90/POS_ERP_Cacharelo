import '../../domain/printing.dart';
import '../../printing/printer_transport_registry.dart';

class WindowsUsbPrinterAdapter implements PrinterAdapter {
  @override
  Future<void> send(PrinterDevice device, List<int> escposPayload) async {
    if (device.platform != PrinterPlatform.windows || device.transport != PrinterTransport.usb) {
      throw ArgumentError('Windows USB adapter requires a Windows USB printer');
    }
    if (device.address.isEmpty || escposPayload.isEmpty) {
      throw ArgumentError('Printer address and payload are required');
    }
  }
}

