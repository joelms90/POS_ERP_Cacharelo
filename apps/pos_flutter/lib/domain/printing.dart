enum PrintJobType { receipt, kitchenOrder, shiftReport }

enum PrintJobState { queued, printing, printed, failed }

enum PrinterPlatform { windows, android }

enum PrinterTransport { usb, bluetooth, network }

class PrinterCapabilities {
  const PrinterCapabilities({
    required this.paperWidth,
    required this.encoding,
    this.cutter = false,
    this.cashDrawer = false,
  });

  final String paperWidth;
  final String encoding;
  final bool cutter;
  final bool cashDrawer;
}

class PrinterDevice {
  const PrinterDevice({
    required this.id,
    required this.name,
    required this.platform,
    required this.transport,
    required this.address,
    required this.capabilities,
    this.isEnabled = true,
  });

  final String id;
  final String name;
  final PrinterPlatform platform;
  final PrinterTransport transport;
  final String address;
  final PrinterCapabilities capabilities;
  final bool isEnabled;

  void validateBaselineTransport() {
    if (platform == PrinterPlatform.windows && transport != PrinterTransport.usb) {
      throw ArgumentError('Windows printers must use USB transport');
    }
    if (platform == PrinterPlatform.android && transport == PrinterTransport.usb) {
      throw ArgumentError('Android printers must use Bluetooth or network transport');
    }
  }
}

class PrintJob {
  const PrintJob({
    required this.id,
    required this.transactionId,
    required this.printerDeviceId,
    required this.jobType,
    required this.escposPayload,
    required this.state,
    required this.attemptCount,
    this.lastError,
  });

  final String id;
  final String transactionId;
  final String printerDeviceId;
  final PrintJobType jobType;
  final List<int> escposPayload;
  final PrintJobState state;
  final int attemptCount;
  final String? lastError;

  PrintJob markFailed(String error) => PrintJob(
        id: id,
        transactionId: transactionId,
        printerDeviceId: printerDeviceId,
        jobType: jobType,
        escposPayload: escposPayload,
        state: PrintJobState.failed,
        attemptCount: attemptCount + 1,
        lastError: error,
      );

  PrintJob markPrinted() => PrintJob(
        id: id,
        transactionId: transactionId,
        printerDeviceId: printerDeviceId,
        jobType: jobType,
        escposPayload: escposPayload,
        state: PrintJobState.printed,
        attemptCount: attemptCount + 1,
        lastError: lastError,
      );
}

