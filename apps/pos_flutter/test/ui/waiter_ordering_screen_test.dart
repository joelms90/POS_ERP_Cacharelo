import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_flutter/ui/common/app_state.dart';
import 'package:pos_flutter/ui/waiter/waiter_ordering_screen.dart';
import 'package:pos_flutter/ui/waiter/zone_tabs.dart';

void main() {
  testWidgets('WaiterOrderingScreen filters tables by zone tabs', (WidgetTester tester) async {
    final state = AppState();
    await state.initializationFuture;
    state.currentUserRole = UserRole.waiter;
    state.currentUserName = 'Juan (Mesero)';

    // Landscape tablet resolution
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1.0;

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(useMaterial3: true),
        home: WaiterOrderingScreen(state: state),
      ),
    );

    // Initial state: "SALÓN PRINCIPAL" is selected by default
    // Mesa 1 (Salón Principal) is visible, Terraza 1 (Terraza) and Bar 1 (Bar) are not visible
    expect(find.text('Mesa 1'), findsOneWidget);
    expect(find.text('Terraza 1'), findsNothing);
    expect(find.text('Bar 1'), findsNothing);

    // Tap "TERRAZA" tab
    await tester.tap(find.text('TERRAZA'));
    await tester.pumpAndSettle();

    // Now Terraza 1 is visible, Mesa 1 and Bar 1 are not visible
    expect(find.text('Mesa 1'), findsNothing);
    expect(find.text('Terraza 1'), findsOneWidget);
    expect(find.text('Bar 1'), findsNothing);

    // Tap "BAR" tab
    await tester.tap(find.text('BAR'));
    await tester.pumpAndSettle();

    // Now Bar 1 is visible, Mesa 1 and Terraza 1 are not visible
    expect(find.text('Mesa 1'), findsNothing);
    expect(find.text('Terraza 1'), findsNothing);
    expect(find.text('Bar 1'), findsOneWidget);

    // Reset view size
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  testWidgets('ZoneTabs custom zones rendering and tap callback', (WidgetTester tester) async {
    String selectedZone = 'Zone A';
    final List<String> zones = ['Zone A', 'Zone B', 'Zone C'];

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) {
              return ZoneTabs(
                selectedZone: selectedZone,
                zones: zones,
                onZoneChanged: (zone) {
                  setState(() {
                    selectedZone = zone;
                  });
                },
              );
            },
          ),
        ),
      ),
    );

    // Verify all zones rendered
    expect(find.text('ZONE A'), findsOneWidget);
    expect(find.text('ZONE B'), findsOneWidget);
    expect(find.text('ZONE C'), findsOneWidget);

    // Tap ZONE B
    await tester.tap(find.text('ZONE B'));
    await tester.pumpAndSettle();

    expect(selectedZone, equals('Zone B'));
  });
}
