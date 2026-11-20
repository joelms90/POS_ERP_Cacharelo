# Implementation Plan: Active Sucursal in App Version Badge

**Branch**: `017-sucursal-version` | **Date**: 2026-11-20 | **Spec**: [spec.md](spec.md)

## Summary

Show the configured terminal's sucursal in the same compact area as the Flutter POS application version. The branch name already exists in locally persisted terminal configuration, so the feature extends the reusable version badge and supplies the existing state to each configured role screen. It requires no API, storage, schema, or synchronization change.

## Technical Context

**Language/Version**: Dart / Flutter POS client.  
**Primary Dependencies**: Flutter Material widgets and existing `AppState` terminal configuration.  
**Storage**: Existing encrypted terminal configuration; display-only read of the cached branch name.  
**Testing**: Flutter analyzer plus focused widget tests for configured, unconfigured, and long-name layouts.  
**Target Platform**: Flutter mobile, desktop, and web POS role dashboards.  
**Project Type**: Offline-capable POS client.  
**Performance Goals**: No added network requests; the label renders as part of normal widget build.  
**Constraints**: Preserve offline operation, omit unknown branch names, prevent compact headers from overflowing, and expose the full context to assistive technology.  
**Scale/Scope**: One reusable version display and the existing waiter, cashier, branch-operator, kitchen, and configured-login placements.

## Constitution Check

- **Offline continuity**: PASS. The label reads terminal data already available locally and does not gate any operational flow.
- **Local authority**: PASS. No user-facing transaction or synchronized entity is created or changed.
- **Sync contract**: PASS. This feature neither produces nor consumes synchronization operations.
- **Cloud role**: PASS. No cloud endpoint, database, or migration is involved.
- **Verification**: PASS. Widget scenarios cover configured and unconfigured state and narrow layouts; `flutter analyze` verifies the client integration.

## Research

See [research.md](research.md). The selected approach is to enhance the shared badge with an optional display value sourced from the cached terminal configuration.

## Project Structure

### Documentation

```text
specs/017-sucursal-version/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/version-badge.md
├── quickstart.md
└── tasks.md
```

### Source Code

```text
apps/pos_flutter/
├── lib/ui/widgets/app_version_badge.dart
├── lib/ui/common/app_state.dart
├── lib/ui/{waiter,cashier,encargado,kitchen}/
└── test/ui/widgets/
```

**Structure Decision**: Keep presentation in the existing reusable version badge and supply it from the already-present application state at each existing placement. No new model or service is needed.

## Complexity Tracking

No constitution violations or additional complexity are required.
