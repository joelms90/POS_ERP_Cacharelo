// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter_test/flutter_test.dart';
import 'package:pos_flutter/main.dart';
import 'package:pos_flutter/ui/common/app_state.dart';

void main() {
  testWidgets('Login screen loads smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    final appState = AppState();
    await tester.pumpWidget(MyApp(state: appState));

    // Verify that our login screen loads and displays the branding text.
    expect(find.text('EMPIRE NOIR'), findsOneWidget);
    expect(find.text('INGRESAR CREDENCIAL'), findsOneWidget);
  });
}

