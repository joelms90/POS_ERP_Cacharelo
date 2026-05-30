import '../domain/printing.dart';
import 'isar_collections.dart';

class PrinterDeviceRepository {
  PrinterDeviceRepository(this.store);

  final InMemoryLocalStore store;

  Future<void> put(PrinterDevice printer) async {
    printer.validateBaselineTransport();
    final index = store.snapshot.printers.indexWhere((item) => item.id == printer.id);
    if (index == -1) {
      store.snapshot.printers.add(printer);
    } else {
      store.snapshot.printers[index] = printer;
    }
  }

  Future<List<PrinterDevice>> enabled() async {
    return store.snapshot.printers.where((item) => item.isEnabled).toList(growable: false);
  }
}

