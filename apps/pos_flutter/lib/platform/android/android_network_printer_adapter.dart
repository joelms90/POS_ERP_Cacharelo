import '../../domain/printing.dart';
import '../../printing/printer_transport_registry.dart';

class AndroidNetworkPrinterAdapter implements PrinterAdapter {
  @override
  Future<void> send(PrinterDevice device, List<int> escposPayload) async {
    if (device.platform != PrinterPlatform.android ||
        device.transport != PrinterTransport.network) {
      throw ArgumentError('Android network adapter requires an Android network printer');
    }
    if (!device.address.contains(':') || escposPayload.isEmpty) {
      throw ArgumentError('Network printer address must be host:port and payload is required');
    }
  }
}

