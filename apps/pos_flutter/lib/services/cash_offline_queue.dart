/// Spec 019 (D-5) — offline queue for cash movements and Corte Z.
///
/// Jobs are persisted and sent strictly in FIFO order so that a Corte Z is
/// never sent before the movements of its shift. The server is idempotent by
/// `clientUuid`, so a job can be retried safely after a timeout.
library;

/// Outcome of sending one job.
enum CashJobResult {
  /// Accepted by the server (or already accepted before): remove it.
  sent,

  /// Network/timeout/5xx/401: keep it and stop, to preserve order.
  retryLater,

  /// Rejected by a business rule (4xx): remove it and report it to the user.
  rejected,
}

class CashJobOutcome {
  final CashJobResult result;
  final String? message;
  final Map<String, dynamic>? response;

  const CashJobOutcome(this.result, {this.message, this.response});
}

typedef CashJobSender = Future<CashJobOutcome> Function(
    Map<String, dynamic> job);

class CashOfflineQueue {
  CashOfflineQueue({
    required Future<List<Map<String, dynamic>>> Function() load,
    required Future<void> Function(List<Map<String, dynamic>> jobs) save,
  })  : _load = load,
        _save = save;

  final Future<List<Map<String, dynamic>>> Function() _load;
  final Future<void> Function(List<Map<String, dynamic>> jobs) _save;
  final List<Map<String, dynamic>> _jobs = [];
  bool _flushing = false;

  /// Pending jobs (kind `movement` or `close`), oldest first.
  List<Map<String, dynamic>> get jobs => List.unmodifiable(_jobs);

  /// Jobs the server rejected, kept until the user dismisses them.
  List<Map<String, dynamic>> get rejected => List.unmodifiable(
      _jobs.where((job) => job['status'] == 'rejected').toList());

  int get pendingCount =>
      _jobs.where((job) => job['status'] != 'rejected').length;

  Future<void> restore() async {
    final stored = await _load();
    _jobs
      ..clear()
      ..addAll(stored);
  }

  Future<void> enqueue(Map<String, dynamic> job) async {
    _jobs.add({...job, 'status': 'pending'});
    await _save(_jobs);
  }

  bool hasPendingClose(String shiftId) => _jobs.any((job) =>
      job['status'] == 'pending' &&
      job['kind'] == 'close' &&
      job['shiftId'] == shiftId);

  /// Signed effect of the queued (not yet sent) movements of a shift.
  double pendingCashEffect(String shiftId) {
    double total = 0;
    for (final job in _jobs) {
      if (job['status'] != 'pending' ||
          job['kind'] != 'movement' ||
          job['shiftId'] != shiftId) {
        continue;
      }
      final payload = job['payload'] as Map? ?? const {};
      final amount = double.tryParse(payload['amount']?.toString() ?? '') ?? 0;
      total += payload['type'] == 'cash-in' ? amount : -amount;
    }
    return total;
  }

  /// Sends pending jobs of [userId] in order. Jobs of other users wait for
  /// their own session (the server only accepts a cashier's own shift).
  /// Returns the outcomes of the jobs handled in this run.
  Future<List<CashJobOutcome>> flush({
    required String? userId,
    required CashJobSender send,
  }) async {
    if (_flushing || userId == null) return const [];
    _flushing = true;
    final outcomes = <CashJobOutcome>[];
    try {
      for (final job in List<Map<String, dynamic>>.from(_jobs)) {
        if (job['status'] != 'pending') continue;
        if (job['userId'] != userId) {
          // Keep the order of this user's jobs, but do not let another user's
          // job block them: their shifts are independent.
          continue;
        }
        final outcome = await send(job);
        outcomes.add(outcome);
        if (outcome.result == CashJobResult.retryLater) break;
        final index =
            _jobs.indexWhere((j) => j['clientUuid'] == job['clientUuid']);
        if (index < 0) continue;
        if (outcome.result == CashJobResult.sent) {
          _jobs.removeAt(index);
        } else {
          _jobs[index] = {
            ..._jobs[index],
            'status': 'rejected',
            'error': outcome.message ?? 'Rechazado por el servidor.',
          };
        }
        await _save(_jobs);
      }
    } finally {
      _flushing = false;
    }
    return outcomes;
  }

  Future<void> dismissRejected() async {
    _jobs.removeWhere((job) => job['status'] == 'rejected');
    await _save(_jobs);
  }

  Future<void> clear() async {
    _jobs.clear();
    await _save(_jobs);
  }
}
