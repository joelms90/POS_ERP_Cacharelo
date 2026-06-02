# Quickstart Guide: Waiter and Cashier Application Screens

This guide describes how to run and test the Waiter and Cashier screen implementations.

---

## 1. Running the Screens in Mock Mode

To preview the UI layouts and transitions without connecting to a live local database or network:
1. Open the project in your IDE or editor.
2. In the Flutter entrypoint file (`apps/pos_flutter/lib/main.dart`), switch the home widget to run in demonstration mode:
   ```dart
   void main() {
     runApp(const PosDemoApp());
   }
   ```
3. Run the application from your terminal:
   ```bash
   cd apps/pos_flutter
   flutter run -d chrome --web-renderer canvaskit
   ```
   *(Or target an Android emulator/device or Windows native platform).*

---

## 2. Running UI Widget Tests

We use Flutter widget tests to verify screen layouts, state transitions, and splits validation logic.

To execute the tests:
```bash
cd apps/pos_flutter
flutter test test/ui/waiter_ordering_screen_test.dart
flutter test test/ui/split_checkout_view_test.dart
```

---

## 3. UI Verification Checklist

When previewing or testing the screens, verify the following visual behaviors:
- [ ] Obsidian Background (`#0B0B0C`) covers the full viewport without layout flickering.
- [ ] Champagne Gold buttons and highlights scale cleanly to 48dp+ tap targets.
- [ ] Table layout coordinates render correctly inside the zone mapping boundaries.
- [ ] Cart additions update subtotal and tax calculation instantly.
- [ ] Split billing displays correct totals per split when N-splits or item checklists are selected.
- [ ] Offline warnings are displayed prominently in the status header when network simulation is turned off.
