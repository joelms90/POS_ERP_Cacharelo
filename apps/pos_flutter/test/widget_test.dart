// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:pos_flutter/main.dart';
import 'package:pos_flutter/ui/common/app_state.dart';

void main() {
  testWidgets('Login screen loads smoke test', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    PackageInfo.setMockInitialValues(
      appName: 'pos_flutter',
      packageName: 'com.cacharelo.pos',
      version: '1.0.1',
      buildNumber: '3',
      buildSignature: '',
    );
    late AppState appState;
    await tester.runAsync(() async {
      appState = AppState();
      await appState.initializationFuture;
    });
    appState.isTerminalConfigured = true;
    appState.terminalBusinessName = 'Cacharelo Restaurant';
    appState.terminalBranchName = 'Sucursal Centro';

    tester.view.physicalSize = const Size(1920, 1080);
    tester.view.devicePixelRatio = 1.0;

    await tester.pumpWidget(MyApp(state: appState));
    await tester.pump();

    // Verify that our login screen loads and displays the branding text.
    expect(find.text('Cacharelo Restaurant'), findsOneWidget);
    expect(find.text('INGRESAR CREDENCIAL'), findsOneWidget);

    appState.dispose();
    await tester.pumpWidget(const SizedBox());
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}
