import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_flutter/ui/common/app_state.dart';
import 'package:pos_flutter/ui/widgets/table_node.dart';

void main() {
  testWidgets('TableNode renders free circle table and triggers onTap', (WidgetTester tester) async {
    bool tapped = false;
    final table = TableModel(
      id: 1,
      label: 'Mesa 1',
      shape: TableShape.circle,
      zone: 'Salón',
      x: 0.5,
      y: 0.5,
      state: TableState.free,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TableNode(
            table: table,
            onTap: () => tapped = true,
          ),
        ),
      ),
    );

    // Verify label and state icon
    expect(find.text('Mesa 1'), findsOneWidget);
    expect(find.byIcon(Icons.table_restaurant_outlined), findsOneWidget);
    expect(find.textContaining('pax'), findsNothing);

    // Tap table
    await tester.tap(find.text('Mesa 1'));
    await tester.pump();
    expect(tapped, isTrue);
  });

  testWidgets('TableNode renders occupied square table with pax count', (WidgetTester tester) async {
    final table = TableModel(
      id: 2,
      label: 'Mesa 2',
      shape: TableShape.square,
      zone: 'Salón',
      x: 0.5,
      y: 0.5,
      state: TableState.occupied,
      guests: 4,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TableNode(
            table: table,
            onTap: () {},
          ),
        ),
      ),
    );

    // Verify label, occupied icon, and guest count
    expect(find.text('Mesa 2'), findsOneWidget);
    expect(find.byIcon(Icons.person), findsOneWidget);
    expect(find.text('4 pax'), findsOneWidget);
  });

  testWidgets('TableNode renders billing table with ScaleTransition pulse', (WidgetTester tester) async {
    final table = TableModel(
      id: 3,
      label: 'Mesa 3',
      shape: TableShape.circle,
      zone: 'Salón',
      x: 0.5,
      y: 0.5,
      state: TableState.billing,
      guests: 2,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TableNode(
            table: table,
            onTap: () {},
          ),
        ),
      ),
    );

    // Verify label, billing icon, and scale transition wrapping the table label
    expect(find.text('Mesa 3'), findsOneWidget);
    expect(find.byIcon(Icons.receipt_long), findsOneWidget);
    expect(
      find.ancestor(
        of: find.text('Mesa 3'),
        matching: find.byType(ScaleTransition),
      ),
      findsOneWidget,
    );
  });

  testWidgets('TableNode renders cleaning state', (WidgetTester tester) async {
    final table = TableModel(
      id: 4,
      label: 'Mesa 4',
      shape: TableShape.square,
      zone: 'Salón',
      x: 0.5,
      y: 0.5,
      state: TableState.cleaning,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TableNode(
            table: table,
            onTap: () {},
          ),
        ),
      ),
    );

    // Verify label and cleaning icon
    expect(find.text('Mesa 4'), findsOneWidget);
    expect(find.byIcon(Icons.cleaning_services_outlined), findsOneWidget);
  });
}
