# Implementation Plan: Waiter and Cashier Application Screens

**Branch**: `003-waiter-cashier-screens` | **Date**: 2026-06-02 | **Spec**: [spec.md](file:///Users/joelmorales/web/POS-ERP/specs/003-waiter-cashier-screens/spec.md)

**Input**: Feature specification from `/specs/003-waiter-cashier-screens/spec.md`

## Summary

Implement high-fidelity, high-density touchscreen user interfaces for Waiters (Floor layout, zone selection, categorized menu navigation, item customization dialogs, local cart commitment) and Cashiers (Shift/Drawer controls, table checkout lists, item-based and equal split-billing selectors, payment capture with manual reference codes). Both screens will inherit the "Empire Noir" design language tokens (obsidian backgrounds, Champagne Gold accents, Aged Bronze outline vectors, Bodoni Moda/Inter type scaling) using Flutter's native layout system, operating entirely offline via Isar Database local caching.

## Technical Context

**Language/Version**: 
- Client: Flutter 3.19+, Dart 3.3+

**Primary Dependencies**:
- Frontend: `flutter` SDK, `isar` (offline transactional storage), `uuid` (unique local transaction identifiers), `local_auth` (cached biometric/PIN offline authorization)

**Storage**:
- Local Database (Isar): Utilizes existing `LocalTransaction`, `PrintJob`, and `CachedUserSession` entities. No new database collections are introduced, but UI models will map runtime selections directly into Isar entries.

**Testing**:
- UI Layout: Widget testing (`flutter_test`) to verify zone filtering, cart items calculation, and checkout splits logic.
- Integration: `integration_test` to simulate offline table transitions (Free -> Occupied -> Billing) and print queue triggers.

**Target Platform**: 
- Windows 10 (touch-enabled desktop terminal)
- Android (8" to 10" landscape tablets)

**Project Type**: 
- Landscape Tablet POS UI & Local Controller State Machine

**Performance Goals**:
- Screen transition rendering: < 120ms
- Zone map filter/re-render: < 60ms (avoiding full-screen rebuilds via local Widget state scope)
- Frame rate: Constant 60fps on target tablet hardware

**Constraints**:
- Must be fully functional offline; no synchronous network calls are allowed on the user interaction path.
- Colors and typography must exactly follow design tokens mapped in `THEME_SPEC.md`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Offline continuity**: PASS. Waiters and cashiers can operate all table layouts, carts, item customization, drawer open/close, payment method selection, and receipt/comanda prints without net connection.
- **Local authority**: PASS. Submitting an order or confirming checkout updates local Isar transaction and print job records before displaying success.
- **Sync contract**: PASS. Local sales are tracked with UUID v4 idempotency keys, local versions, and sync states (`pending`, `syncing`, etc.).
- **Cloud role**: PASS. Cloud endpoints process sync transactions asynchronously; PostgreSQL database schemas are unaffected by these UI changes.
- **Verification**: PASS. Widget and integration tests verify offline flow, failed print job retries, and local transaction storage integrity.

## Project Structure

The UI components will reside inside the existing `apps/pos_flutter/` application package structure under `lib/ui`:

```text
apps/pos_flutter/lib/
├── ui/
│   ├── common/
│   │   ├── colors.dart               # Empire Noir palette constants (#0B0B0C, #D4AF37, etc.)
│   │   └── theme.dart                # Bodoni Moda and Inter text theme specifications
│   ├── widgets/
│   │   ├── custom_toast.dart         # Floating ready toast widget for kitchen updates
│   │   ├── table_node.dart           # Interactive graphical coordinate table widget
│   │   ├── menu_card.dart            # High-density food item tile with images and price
│   │   └── offline_status_bar.dart   # Top global bar displaying sync and printer warnings
│   ├── waiter/
│   │   ├── waiter_ordering_screen.dart # Main waiter portal (Floor Map + Cart split screen)
│   │   ├── zone_tabs.dart            # Tab switch for dining rooms (Salón, Terraza, Bar)
│   │   └── modifier_dialog.dart      # Custom items selection dialog
│   └── cashier/
│       ├── cashier_dashboard_screen.dart # Main cashier portal (Shift stats + Tables list)
│       ├── shift_control_panel.dart  # Cash float entry, Corte X/Z controls
│       └── split_checkout_view.dart  # Equal split slider + items checklist split interface
```

**Structure Decision**: 
Integrate screens, custom widgets, and thematic style constants inside `apps/pos_flutter/lib/ui` grouped by sub-directories reflecting roles (`waiter`, `cashier`, `widgets`, `common`). This keeps components isolated, reusable, and easy to maintain.

## Complexity Tracking

*No constitution violations detected. Standard Flutter custom stateful widget architecture.*
