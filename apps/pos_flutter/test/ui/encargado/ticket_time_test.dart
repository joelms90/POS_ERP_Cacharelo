import 'package:flutter_test/flutter_test.dart';
import 'package:pos_flutter/ui/encargado/encargado_caja_tab.dart';

void main() {
  test('ticket time is shown in local time, not the raw UTC string', () {
    const utc = '2026-11-23T14:31:00.000Z';
    final local = DateTime.parse(utc).toLocal();
    final expected = '${local.hour.toString().padLeft(2, '0')}:'
        '${local.minute.toString().padLeft(2, '0')}';
    expect(formatTicketTime(utc), expected);
  });

  test('missing or invalid timestamps render empty', () {
    expect(formatTicketTime(null), '');
    expect(formatTicketTime('not-a-date'), '');
  });
}
