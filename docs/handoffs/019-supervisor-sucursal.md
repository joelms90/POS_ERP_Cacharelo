# Handoff — Supervisor de sucursal, Fase 1 (`019-supervisor-sucursal`)

- **Date:** 2026-11-22
- **Last agent:** Claude Code (Opus 5.5)
- **Worktree:** `/Users/joelmorales/web/POS-ERP/.worktrees/supervisor-sucursal`
- **Branch:** `019-supervisor-sucursal`. Local only: **not pushed, not deployed, not merged**. The owner reviews and merges locally.
- **Spec / plan / model / tasks:** `specs/019-supervisor-sucursal/{spec,plan,data-model,tasks}.md`

## 1. Goal

Add the `branch_supervisor` role and, first, the approval of cash: Corte Z (two levels) and cash-ins/outs (one level). Every correction is recorded in an append-only cash ledger and an audit log.

## 2. Final rules implemented

| Item | Rule |
|---|---|
| Corte Z | N1 = OIS (`branch_operator`) of the branch; if the OIS closed it, N1 = assigned supervisor (S-3), and the owner may also take that N1 acting as supervisor. N2 = assigned supervisor or owner (S-2). C-1 confirmed (2026-11-23): the same supervisor may resolve N2 (approve or adjust) and the owner audits the log afterwards; approving one's own corte is still forbidden. |
| Rejection | N1 rejection → the corte author recounts → back to N1. N2 rejection → cashier/OIS recounts → straight back to N2 (S-5), or the supervisor approves with an adjustment. |
| Cash-in / cash-out | Counts in cash from the moment it is recorded; approved only at N1 (S-1). Supervisor/owner can cancel or adjust until the corte has final approval. |
| Ledger (S-4) | `cash_transactions` is append-only. Reject/cancel insert a reversal entry dated now and attributed to the original shift; adjust = reversal + `ajuste` entry. `close_snapshot` is never rewritten; post-close entries are shown apart, and figures are frozen in `approval_snapshot` at N2. |
| No substitution (S-6) | Supervisor/owner never act at N1 for a cashier item. |
| Opening block (D-4, C-2) | No new shift while the last corte of the branch is `pendiente_n1`/`rechazado_n1`. Owner emergency unblock (P-2). Behind `CASH_APPROVALS_ENFORCE_OPEN_BLOCK=true` (off by default). |
| Debts (D-8, P-1) | An approved shortage creates a `cashier_debts` row (audited only; voided on reopen). |
| Notifications (D-6) | Persistent, read over REST (`/notifications`). No push. |
| Supervisor scope (D-1, D-9, P-3) | Several assigned branches; sees only cash supervision (cortes, movements, audit log) of those branches. No sales reports and no inventory reports. |

C-1 and C-2 are constants in `apps/sync_api/src/modules/supervision/cash-approval.config.ts`. C-1 is confirmed (same supervisor may resolve N2; owner audits later); C-2 is still **to be confirmed by the owner**.

## 3. What was built

| Layer | What | Main files |
|---|---|---|
| Backend | Role + `BUSINESS_CONTROL_ROLES`; schema and idempotent migration (step 21); pure rules + config; `AuditModule` (audit log, notifications, supervisor scope); shifts: review status on close, ledger entries, MV-05 guard, recount, opening block; supervision API (inbox, detail with adjusted expected, N1/N2 actions with version CAS, movement approve/reject/cancel/adjust with reversals and impact preview, reopen, unblock, debts, audit log, assignments, branches); `/notifications`; guards on previously unguarded report endpoints; ledger-aware reconciliation in reports. | `src/modules/supervision/*`, `src/modules/audit/*`, `src/modules/shifts/*`, `src/modules/reports/*`, `src/database/schema.ts`, `migrations/0022_supervisor_cash_approvals.sql`, `scripts/idempotent-deploy-migrations.ts` |
| Admin web | Supervision nav group + bell; approvals inbox; Corte Z review panel (expected at close + post-close adjustments = adjusted expected, grouped movements, actions with impact shown before confirming); notifications, debts, audit log (CSV), supervisor assignments pages; `branch_supervisor` in Administrators; role-union tabs; supervisor-restricted reports using server reconciliation. | `src/pages/supervision/*`, `src/App.tsx`, `src/components/templates/AdminLayout.tsx`, `src/pages/ReportsPage.tsx`, `src/services/api.ts` |
| POS Flutter | Caja → "Por aprobar" for the OIS (approve/reject with reason, recount); cashier panel shows own cortes in review and "Recontar"; structured category + `clientUuid` on movements; statuses in Corte X/Z tickets; Corte Z result shows its review status; blocked opening jumps to the inbox. | `lib/ui/encargado/pending_approvals_view.dart`, `lib/ui/common/app_state.dart`, `lib/ui/encargado/encargado_caja_tab.dart`, `lib/ui/cashier/shift_control_panel.dart` |

## 4. Verification

- **Backend:** `npx tsc --noEmit` and `npm run build` OK. `npx jest`: 262 passed, 18 skipped (the integration suite), stable over 20 consecutive full runs.
- **Integration (real DB):** `SUPERVISION_IT_DATABASE_URL=postgres://pos_user:pos_password@localhost:5432/pos_dev npx jest src/modules/supervision/supervision.integration.spec.ts` → 18/18. It covers the full chain over HTTP, reversals, immutability triggers, reports, the opening block and unblock, and C-1. It creates an isolated business and deletes it afterwards.
- **Local migration:** `scripts/idempotent-deploy-migrations.ts` ran twice against the local docker DB only. Historical net cash was unchanged (`cash_effect` = legacy sum), and the triggers were verified.
- **Admin:** `npx tsc --noEmit` and `vite build` OK. `e2e/supervision-approvals.spec.ts` passes against the local stack: a supervisor approves the pending movement and the Corte Z at N1, then the owner approves N2; the test verifies the final status, both approvers and the movement status through the API. `e2e/navigation.spec.ts` still passes.
  - Seed: `apps/sync_api/scripts/seed-supervision-e2e.ts` (`npm run db:seed-supervision-e2e`) idempotently creates the E2E owner (`owner.e2e@cacharelo.com`), supervisor (`supervisor.e2e@cacharelo.com`), branch, assignment and a pending Corte Z with a pending cash-in on the local Cafetería business. It refuses to run against a non-local DB unless `E2E_ALLOW_REMOTE_DB=1`.
  - Run: `cd apps/business_control_tauri && pnpm test:e2e -- e2e/supervision-approvals.spec.ts` (the Playwright config starts API :3000 and Vite :1420; use `BASE_URL`/`E2E_API_URL` to target another local port).
  - Bug fixed while testing: the supervisor used to mount the `personal` tab for one render before the tab guard kicked in; its `/users` call returned 401 and the frontend logged the session out. `App.tsx` now derives the effective tab from `allowedTabs` before rendering.
- **POS:** `flutter test` → the same 15 failures as baseline `main`, none new; the 6 new tests in `test/ui/pending_approvals_view_test.dart` pass. `flutter analyze` is clean on every touched file; the project run exits 0 with 154 pre-existing infos/warnings.

## 5. Not done / known gaps

1. **Done since the first handoff:** POS offline queue (T306) and legacy `X-Admin-Token` access to the guarded reports. The `pubspec.yaml` version (now `1.0.1+43`, bumped by the repo pre-commit hook) does not conflict: `main` is still on `+41`.
2. **Done since the last handoff:** Admin E2E browser test against the local stack (`e2e/supervision-approvals.spec.ts`), plus the local seed script and the supervisor tab/session bug fix described in §4.
3. **Lint:** about 30 `no-unsafe-*` warnings in the new backend files (lint is not part of `make check-all`).
4. **Data-reset scripts:** they opt in with `set_config('app.allow_cash_ledger_purge','on',…)`. This is intended, not a defect.

## 6. Next steps (owner)

1. Review the branch and merge locally (`git log main..019-supervisor-sucursal`).
2. C-1 is confirmed (same supervisor may resolve N2; owner audits later). Confirm C-2 (spec §15.2), or change the constant.
3. Decide on the offline queue (T306) before rollout to sucursales with poor connectivity.
4. Deploy only with approval, following `docs/pre-deployment-checklist.md`:
   - migration (step 21);
   - backend with the block flag off;
   - admin;
   - POS on every terminal;
   - then `CASH_APPROVALS_ENFORCE_OPEN_BLOCK=true`.
5. Create supervisors in Administradores (role "Supervisor de sucursal") and assign branches in Supervisores.
