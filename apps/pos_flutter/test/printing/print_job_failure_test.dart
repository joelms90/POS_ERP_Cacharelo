import 'package:flutter_test/flutter_test.dart';
import 'package:pos_erp_offline_pos/domain/printing.dart';

void main() {
  test('print failure marks job failed without changing transaction id', () {
    const job = PrintJob(
      id: 'job-1',
      transactionId: 'tx-1',
      printerDeviceId: 'printer-1',
      jobType: PrintJobType.receipt,
      escposPayload: [27, 64],
      state: PrintJobState.queued,
      attemptCount: 0,
    );

    final failed = job.markFailed('offline');

    expect(failed.transactionId, 'tx-1');
    expect(failed.state, PrintJobState.failed);
  });
}

