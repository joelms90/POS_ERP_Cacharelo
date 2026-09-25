# Implementation Plan: Unified Operational Roles

**Branch**: `013-unify-roles` | **Date**: 2026-09-24 | **Spec**: [spec.md](spec.md)

## Summary

Create one canonical operational permission catalog for the Nest API, Business Control dashboard, and Flutter POS. Migrate `encargado` and `responsable` to `branch_operator`; add `warehouse_purchasing_operator`; retain specialized service roles. API checks are authoritative; clients hide unavailable actions. Requisitions cannot be self-approved and receiving discrepancies require an auditable note.

## Technical Context

**Language/Version**: TypeScript/NestJS, React/TypeScript, Flutter/Dart.  
**Storage**: Existing user role arrays, purchase orders, requisitions, transfers, receipts, and inventory audit records.  
**Testing**: Nest tests, dashboard build, Flutter analysis and targeted widget/unit tests.  
**Target Platform**: Cloud API, Business Control web dashboard, offline-capable Flutter POS.  
**Constraints**: Existing sales, payments, and offline requisition creation remain operable. API authorization is authoritative. Legacy users remain mapped.

## Constitution Check

- **Offline continuity**: PASS. Sales, payments, preparation, and requisition creation remain local; shared-transfer reception visibly requires sync.
- **Local authority**: PASS. Role changes preserve local POS data and pending operations.
- **Sync contract**: PASS. Requisitions retain stable IDs; duplicate receptions and self-approval are rejected.
- **Cloud role**: PASS. API coordinates authorization and inventory auditing.
- **Verification**: PASS. Tests cover authorization, self-approval, mismatch notes, and legacy mapping.

## Design Decisions

1. Named roles are bundles of capabilities. A user may hold several bundles but selects one active operational role in Flutter.
2. Dashboard management roles (`owner`, `inventory_admin`, `support_tech`) retain management scope and receive explicit capabilities.
3. The API prevents a requester from approving, rejecting, or dispatching their own requisition. Owner overrides need a reason.
4. Supplier or transfer quantity/cost mismatches require a note; only accepted quantity enters stock.
5. `encargado` and `responsable` remain login aliases for `branch_operator` during migration.

## Project Structure

```text
apps/sync_api/src/modules/{auth,requisitions,purchase-orders,inventory}/
apps/business_control_tauri/src/{App.tsx,components/organisms/UserForm.tsx,pages/}
apps/pos_flutter/lib/{ui/common/app_state.dart,ui/}
specs/013-unify-roles/{research,data-model,contracts,quickstart,tasks}.md
```

**Structure Decision**: The backend owns authorization. The web dashboard and Flutter POS consume canonical roles and reflect server-authorized actions.
