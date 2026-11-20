import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_flutter/ui/widgets/app_version_badge.dart';

void main() {
  Widget buildBadge({String? branchName}) {
    return MaterialApp(
      home: Scaffold(
        body: Center(
          child: AppVersionBadge(version: 'v1.2.3', branchName: branchName),
        ),
      ),
    );
  }

  testWidgets('shows only the version when no sucursal is configured', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(buildBadge());

    expect(find.text('v1.2.3'), findsOneWidget);
    expect(find.byIcon(Icons.location_on_outlined), findsNothing);
    expect(find.bySemanticsLabel('Versión v1.2.3'), findsOneWidget);
  });

  testWidgets('shows the configured sucursal with the version', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(buildBadge(branchName: 'Cacharelo Centro'));

    expect(find.text('Cacharelo Centro'), findsOneWidget);
    expect(find.byIcon(Icons.location_on_outlined), findsOneWidget);
    expect(
      find.bySemanticsLabel('Versión v1.2.3, Sucursal Cacharelo Centro'),
      findsOneWidget,
    );
  });

  testWidgets('omits blank sucursal names', (WidgetTester tester) async {
    await tester.pumpWidget(buildBadge(branchName: '   '));

    expect(find.byIcon(Icons.location_on_outlined), findsNothing);
    expect(find.bySemanticsLabel('Versión v1.2.3'), findsOneWidget);
  });

  testWidgets('truncates a long sucursal name without rendering overflow', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 180,
            child: AppVersionBadge(
              version: 'v1.2.3',
              branchName:
                  'Sucursal Cacharelo Centro Histórico con Nombre Muy Largo',
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
  });
}
