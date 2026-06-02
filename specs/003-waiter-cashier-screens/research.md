# Research & Technical Decisions: Waiter and Cashier Application Screens

This document summarizes the design patterns, layouts, and state management mechanisms chosen for implementing the waiter and cashier screens in Flutter.

---

## 1. Graphical Coordinate Map (Floor Plan)

### Technical Approach
To implement a custom floor plan where tables can be placed dynamically:
- **Layout**: Use a `LayoutBuilder` combined with a `Stack` and `Positioned` widgets. This allows rendering tables at exact percentage-based coordinates (`x` and `y` between `0.0` and `1.0`), ensuring the floor map scales gracefully on different tablet aspect ratios (16:9, 16:10).
- **Table Representation**: Render tables as custom widgets (`TableNode`) representing circles or rounded rectangles using `BoxDecoration`.
- **Drag-and-Drop Editor**: For a future administrator mode, tables can wrap in a `GestureDetector(onPanUpdate: ...)` to mutate coordinates. For version 1, coordinates will be loaded from a local JSON asset (`assets/floor_plan_mesa.json`).

### Alternatives Considered
- **Structured Grid Layout**: Rejected because the user selected the graphical floor plan to match physical layout representation for intuitive seating management.
- **Custom Painter Floor Map**: Rejected because interactive hit-testing and animating states of individual tables are much simpler using standard Flutter widgets rather than raw canvas pixels.

---

## 2. Kitchen Ready Notifications

### Technical Approach
To notify waiters when orders are ready:
- **Ready Badge**: A badge overlay on the "Ready" tab of the ordering dashboard, subscribing to local stream updates.
- **Floating Toast Notification**: Implement using Flutter's native `Overlay` and `OverlayEntry`. This allows a toast notification card to slide in over any active screen and fade out after 5 seconds without interrupting the waiter's active order cart.

---

## 3. Split Billing UI

### Technical Approach
To calculate equal and item-based splits:
- **Equal Splits**: A simple arithmetic division of `finalAmount / N`, bound to a `Slider` or numerical input.
- **Item-based Splits**: A checkbox state is attached to each `CartItem` row. The cashier checks the items they wish to pay on the current sub-bill. The system sums these items, applies proportional tax/discounts, and generates a new sub-bill `LocalTransaction` queued in Isar.

---

## 4. State Management and Offline Continuity

- **State Management**: Use standard `ValueNotifier` and `ChangeNotifier` to drive local UI controller states (e.g. `FloorMapController`, `CartController`). This avoids heavy external boilerplate while preserving reactive UI updates.
- **Offline Writes**: When the waiter clicks "Confirmar Comanda" or the cashier clicks "Completar Cobro", the controller calls `LocalTransactionRepository.save()` to write the record to Isar synchronously. Only after Isar confirms the write does the UI transition to success and trigger print/sync workers.
