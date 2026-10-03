---
type: "app"
title: "Flutter POS Multiplatform Application"
description: "Architecture, state management, local database, and compilation targets for apps/pos_flutter."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "pos"
  - "flutter"
  - "dart"
  - "drift"
  - "riverpod"
  - "apps"
sources:
  - "apps/pos_flutter/pubspec.yaml"
  - "apps/pos_flutter/lib/ui/common/app_state.dart"
---

# Flutter POS Multiplatform Application

The **Flutter POS Application** (`apps/pos_flutter`) is the operational front-line application used by waiters, cashiers, kitchen staff, and branch managers on Android tablets and web browsers.

---

## 1. Tech Stack & Architecture

- **Framework**: Flutter 3.x (Dart 3.x)
- **State Management**: Flutter Riverpod / ChangeNotifier (`AppState`)
- **Local Persistence**: Drift (SQLite) for offline data caching
- **Platforms**:
  - Web POS: `https://cacharelo-pos.web.app`
  - Android APK: Tablet builds for Samsung / generic POS hardware
  - Public Download Portal: `https://cacharelo-pos.web.app/descargas.html` (PIN: `9876`)

---

## 2. Key Modules & Screens

```text
apps/pos_flutter/lib/
├── ui/
│   ├── common/
│   │   ├── app_state.dart       # Unified global operational state & branch context
│   │   └── widgets/             # Reusable modal dialogs, buttons, numpads
│   ├── auth/                    # PIN pad authentication & tablet branch binding
│   ├── tables/                  # Visual floor plan (Mesa grid, occupancy state)
│   ├── order/                   # Menu item selection, guest assignments, modifiers
│   ├── kds/                     # Kitchen/Bar ticket display screen
│   ├── cashier/                 # Cash drawer opening/closing, payments, Corte X/Z
│   └── branch_operator/         # Branch Requisitions, Inbound Transfer Reception, Daily Summary
└── services/
    ├── api_service.dart         # HTTP REST client to sync_api
    ├── sync_service.dart        # Background sync queue & socket connection
    └── printer_service.dart     # Raw ESC/POS thermal printer communication
```

---

## 3. Versioning Protocol

Whenever making major changes to the Flutter POS:
1. Increment the version in `apps/pos_flutter/pubspec.yaml` (e.g. `version: 1.0.1+2` ➔ `version: 1.0.2+3`).
2. Run `make flutter-portal-deploy` to build the Android APK, sync the release bucket (`gs://cacharelo-pos-releases/`), update `descargas.html`, and deploy web assets to Firebase.

---

## 4. Key Verification Commands

```bash
# Analyze Dart code for syntax or type errors
cd apps/pos_flutter && flutter analyze

# Run unit and widget test suites
cd apps/pos_flutter && flutter test

# Deploy Web POS
make flutter-web-deploy
```
