import '../domain/printing.dart';
import '../local_store/print_job_repository.dart';
import 'printer_transport_registry.dart';

class PrintRetryService {
  PrintRetryService({
    required this.printJobs,
    required this.registry,
  });

  final PrintJobRepository printJobs;
  final PrinterTransportRegistry registry;

  Future<PrintJob> retry(PrintJob job, PrinterDevice printer) async {
    try {
      await registry.resolve(printer.platform, printer.transport).send(printer, job.escposPayload);
      final printed = job.markPrinted();
      await printJobs.put(printed);
      return printed;
    } catch (error) {
      final failed = job.markFailed(error.toString());
      await printJobs.put(failed);
      return failed;
    }
  }
}

