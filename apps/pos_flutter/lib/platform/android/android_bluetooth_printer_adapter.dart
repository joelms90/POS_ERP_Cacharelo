import '../../domain/printing.dart';
import '../../printing/printer_transport_registry.dart';

class AndroidBluetoothPrinterAdapter implements PrinterAdapter {
  @override
  Future<void> send(PrinterDevice device, List<int> escposPayload) async {
    if (device.platform != PrinterPlatform.android ||
        device.transport != PrinterTransport.bluetooth) {
      throw ArgumentError('Android Bluetooth adapter requires an Android Bluetooth printer');
    }
    if (device.address.isEmpty || escposPayload.isEmpty) {
      throw ArgumentError('Bluetooth address and payload are required');
    }
  }
}

