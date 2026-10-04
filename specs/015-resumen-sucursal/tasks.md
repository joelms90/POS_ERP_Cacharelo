# Tasks: 015-resumen-sucursal — Resumen de Sucursal y Cortes de Caja

**Parent Spec:** `specs/015-resumen-sucursal/spec.md`  
**Target Branches:** `015-resumen-sucursal/pos`, `015-resumen-sucursal/admin`, `015-resumen-sucursal/backend`

---

## Phase 1: Setup & Worktrees
- [ ] **Task 1.1**: Run `./scripts/agent-team.sh setup 015-resumen-sucursal` to establish isolated worktrees.
- [ ] **Task 1.2**: Verify backend endpoints in `apps/sync_api` with focused unit tests.

---

## Phase 2: POS Flutter Client (`apps/pos_flutter`) — Specialist: `codex`
- [ ] **Task 2.1**: Implement `ShiftService` / API methods in `apps/pos_flutter/lib/services/api_service.dart` (`getActiveShift`, `getShiftAuditReport`, `closeShift`, `addShiftTransaction`).
- [ ] **Task 2.2**: Build Corte X audit dialog/screen showing cash, card, and live balance.
- [ ] **Task 2.3**: Build Corte Z close drawer modal with denomination counter ($500, $200, $100, $50, $20, coins) and live discrepancy indicator.
- [ ] **Task 2.4**: Connect thermal printer formatting for Corte X and Corte Z summary receipts.
- [ ] **Task 2.5**: Run `flutter analyze` in `.worktrees/pos/apps/pos_flutter`.

---

## Phase 3: Admin Dashboard (`apps/business_control_tauri`) — Specialist: `opencode` / `claude`
- [ ] **Task 3.1**: Add `getCashShifts` and `getCashShiftAudit` API methods in `apps/business_control_tauri/src/services/api.ts`.
- [ ] **Task 3.2**: Add Cortes de Caja summary view in `DashboardPage.tsx` (or dedicated tab) showing branch filter, cashier, initial float, counted cash, and discrepancies.
- [ ] **Task 3.3**: Add audit detail modal displaying full sales breakdown and cash movements.
- [ ] **Task 3.4**: Run `pnpm build` in `.worktrees/admin/apps/business_control_tauri`.

---

## Phase 4: Quality Gate & Merge
- [ ] **Task 4.1**: Run `./scripts/agent-team.sh check all` (Backend build, Admin build, Flutter analyze).
- [ ] **Task 4.2**: Run `./scripts/agent-team.sh merge 015-resumen-sucursal` into `main`.
- [ ] **Task 4.3**: Update `HANDOFF.md` with release notes and verify clean working tree.
