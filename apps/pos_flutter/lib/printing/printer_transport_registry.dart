import '../domain/printing.dart';

abstract class PrinterAdapter {
  Future<void> send(PrinterDevice device, List<int> escposPayload);
}

class PrinterTransportRegistry {
  final Map<String, PrinterAdapter> _adapters = {};

  void register(PrinterPlatform platform, PrinterTransport transport, PrinterAdapter adapter) {
    _adapters[_key(platform, transport)] = adapter;
  }

  PrinterAdapter resolve(PrinterPlatform platform, PrinterTransport transport) {
    final adapter = _adapters[_key(platform, transport)];
    if (adapter == null) {
      throw StateError('No printer adapter registered for ${platform.name}/${transport.name}');
    }
    return adapter;
  }

  String _key(PrinterPlatform platform, PrinterTransport transport) {
    return '${platform.name}:${transport.name}';
  }
}

