import 'package:flutter_test/flutter_test.dart';
import 'package:pos_flutter/ui/common/uom.dart';

void main() {
  test('translates raw units like the admin web', () {
    expect(uomLabel('piece'), 'pza');
    expect(uomLabel('PACK'), 'paq');
    expect(uomLabel('kg'), 'kg');
    expect(uomLabel(null), 'pza');
    expect(uomLabel(''), 'pza');
    expect(uomLabel('caja'), 'caja');
  });
}
