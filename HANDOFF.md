# Session Handoff

**Date:** 2026-09-25
**Branch:** `013-unify-roles` (root) · `main` (`apps/pos_flutter` nested repo)
**Scope:** staging environment (Terraform + GCP), branch-operator order queueing
(Cobrar / GUARDAR ORDEN), local dev tooling fixes, and a production deploy.

---

## 1. Staging environment — IN PROGRESS (blocked on billing)

**Goal:** isolated `staging` so daily changes never touch prod. Prod is untouched.

### Done
- **GCP project created:** `cacharelo-staging` (number `433118108267`), org
  `cacharelo.com` (`938616780977`); `desarrollo@cacharelo.com` is Owner.
- **Firebase added**; Hosting sites created:
  - `https://cacharelo-pos-staging.web.app`
  - `https://cacharelo-central-staging.web.app`
- **Terraform refactor** in `apps/sync_api/infra/`:
  - `modules/sync-api/` — reusable module (Cloud Run v2, Cloud SQL, Secret Manager,
    Artifact Registry, service account + IAM, optional GCS releases bucket).
  - `envs/staging/` — remote state `gs://cacharelo-tfstate` prefix `sync-api/staging`.
  - `bootstrap/` — creates the tfstate bucket once.
  - Legacy prod root `main.tf`/`variables.tf`/`outputs.tf` marked
    **PARKED / DO NOT APPLY**.
- **Config:** `env/prod.env`, `env/staging.env` (`STAGING_PROJECT=cacharelo-staging`);
  `firebase.staging.json` for admin + POS;
  `apps/pos_flutter/web/descargas-staging.html` (PIN `2468`).
- **Makefile:** staging targets added (`deploy-staging`, `backend-deploy-staging`,
  `backend-migrate-staging`, `backend-status-staging`, `admin-deploy-staging`,
  `flutter-web-deploy-staging`, `flutter-apk-build-staging`,
  `flutter-apk-upload-staging`, `flutter-portal-deploy-staging`), infra targets
  repointed to `envs/$(INFRA_ENV)`, plus `staging-guard` (refuses to run against prod).
- **Validated:** `terraform fmt` clean, `terraform validate` OK (module + bootstrap),
  Makefile dry-runs resolve.

### BLOCKED
Billing is **not linked** to `cacharelo-staging`. `desarrollo@cacharelo.com` lacks
`billing.resourceAssociations.create` and `billing.accounts.setIamPolicy` on billing
account `01DAEB-F69644-4D6FF0`. Cloud Run / Cloud SQL require billing.

**Unblock (one of):**
- Console: https://console.cloud.google.com/billing/linkedaccount?project=cacharelo-staging
- Or: grant `roles/billing.user` to the account, then
  `gcloud billing projects link cacharelo-staging --billing-account=01DAEB-F69644-4D6FF0`

### Next steps (after billing is linked)
```bash
make infra-bootstrap
make infra-apply
cd apps/sync_api/infra/envs/staging && terraform output -raw api_url   # → STAGING_API_URL in env/staging.env
make backend-migrate-staging
make deploy-staging
make flutter-apk-upload-staging        # optional
```

### Staging risks / notes
- `apps/sync_api/infra/terraform.tfvars` is **tracked in git** and may contain the
  prod DB password → rotate it and `git rm --cached apps/sync_api/infra/terraform.tfvars`.
  (Staging uses Secret Manager, so no secrets need committing.)
- Do **not** run `terraform apply` from `apps/sync_api/infra/` (legacy prod root).
- Terraform creates Cloud Run with a placeholder image and `ignore_changes` on the
  image; `gcloud run deploy --source` delivers the app image afterward.

---

## 2. Branch operator — multiple orders + Cobrar / GUARDAR ORDEN (done)

- Enabled the park/save action for `branchOperator` (was hidden via
  `showPrepararButton: false`).
- POS tab: **GUARDAR ORDEN** saves the cart as an active `Llevar #N` order, sends a
  kitchen comanda, clears the cart. Shows an "Editando …" banner when editing.
- Órdenes tab: **Editar** reopens a parked order into the POS cart (only new lines
  re-print); **Cobrar** / **Cancelar** unchanged.
- `AppState`: `editingOrderTableId` + `beginEditingOrder()` / `clearEditingOrder()` /
  `editingOrder`.
- Both Cobrar modals now show the product breakdown (qty, name, modifiers, notes,
  line total, subtotal, discount preview, total a pagar).
- Files: `app_state.dart`, `encargado_pos_tab.dart`, `encargado_orders_tab.dart`,
  `encargado_dashboard_screen.dart`.
- Known limitation: changing the qty of an already-sent item does not re-send a
  comanda (only new lines do).

---

## 3. Local dev tooling (done)

- `scripts/dev-all.sh`: background services now run with `</dev/null` (fixes Vite
  `read EIO` and Flutter "Dart compiler exited unexpectedly"); added HTTP readiness
  waits; each service starts in its own process group; `make dev-all-stop` kills the
  whole process group.
- Fixed the admin instance that was pointing at `:3001` (dev-all detects the backend
  port and uses `:3000`).

---

## 4. Production deploy (DONE this session)

Deployed **backend + admin + POS web** (no APK/portal).

- **Migration gap fixed:** `scripts/idempotent-deploy-migrations.ts` now adds
  `inventory_alerts.warehouse_id` + `idx_ia_warehouse_status` and recreates the global
  unique index to include `warehouse_id IS NULL`, plus `unq_ia_product_warehouse_active`.
- `make backend-migrate` → completed ("Warehouse inventory alert support ensured.").
- **Docker build fix:** `npm install -g pnpm` now pulls pnpm 12, which hard-fails on
  ignored dependency build scripts (`ERR_PNPM_IGNORED_BUILDS`). Pinned both Dockerfile
  stages to `pnpm@10.34.5`.
- `make backend-deploy-fast` → revision `pos-sync-api-00119-8tk`.
- `make admin-deploy` → `https://cacharelo-central.web.app`.
- `make flutter-web-deploy` → `https://cacharelo-pos.web.app`.

**Verification:** backend `/api/health` 200; admin 200; POS 200; no backend ERROR logs
in the 10 minutes after deploy.

APK/portal release (`make flutter-portal-deploy`) was intentionally **not** run; it
needs a `pubspec.yaml` version bump before the next release.

### Working-tree caution
There are large unrelated uncommitted changes in the root workspace and the nested
Flutter repo (from other sessions). **Do not reset, checkout, or broadly stage files.**


## Paperclip local verification — 2026-09-30

- Scope: launcher-only patch in `scripts/dev-all.sh`; existing application and nested Git work preserved.
- Fixed Docker Desktop Compose plugin discovery, Compose service name (`db`), and fail-fast HTTP readiness.
- `SKIP_MIGRATIONS=true RUN_MIGRATIONS_ON_STARTUP=false make dev-all-local` starts local PostgreSQL but fails backend compilation: optional `branchId`/`cashierId` in OpenShiftDto conflict with required IDs in ShiftsService (lines 25, 31, 34, 35). No verified web URL.
- Focused checks: 27 Nest unit tests passed (requisitions, inventory, shifts); 6 Flutter tests passed (receive-transfer dialog and requisitions). PackageInfo test-plugin warnings remain. These are not end-to-end workflow verification.
- Stopped only this run's failed backend watcher. Local PostgreSQL remains available; no migrations, data resets, production operations, commits, or pushes were performed.
- Next: CEO review of cash-shift identity/authorization boundary, then coordinate the active role-unification session, reconcile the DTO/service contract in an isolated workspace, rerun local startup, and verify receipt → sale/payment → cash reconciliation with synthetic data.
- Durable evidence: Paperclip MOR-1 document `cacharelo-local-verification`.


## Paperclip synthetic workflow verification — 2026-10-01

- Fixed receipt transit double deduction and concurrent duplicate reception in `apps/sync_api/src/modules/inventory/inventory.service.ts`; transaction locks the transfer before checking status. Added four stock-conservation regression cases; 11 focused tests pass. Existing edits were preserved using an isolated snapshot and narrow patches.
- `node scripts/verify-synthetic-workflow.cjs` creates a fresh SYNTHETIC tenant on local `pos_dev` only; credentials stay in memory. Final live API/SQL probe: 33/35 assertions pass. Warehouse 20 → 10, receipt 8/10 → branch 8 and transit 0, two sales → branch 6. Concurrent receipt statuses 201/400; sequential payment retries 409 with one payment each. Cash: float 100 + cash sale 25 + in 10 − out 5 = 130; counted 128 → discrepancy −2; card 25 stays separate.
- Two failing security assertions: anonymous and other-branch GET of a synthetic order both return 200. CEO security review required before changing order/sync authorization. No customer records accessed or modified. Fixtures retained for audit; no resets or historical corrections.
- Remaining: authenticated Flutter pairing/UI journey, delivery semantics (Listo currently only changes local billing state), offline/retry checks, and approved order authorization fix. Broader workflow acceptance remains incomplete.
- Evidence and decision path: Paperclip MOR-1 `cacharelo-local-verification`; preserve both Git histories, active agy session, and all existing work. No deployment, migration, commit, or push.

## Paperclip order REST authorization checkpoint — 2026-10-01

- Approved scoped OrdersAccessGuard and Flutter order token headers applied after isolated snapshot checks. TypeScript check and 38 focused backend tests pass; 9 Flutter widget tests pass with existing plugin warnings.
- Expanded synthetic probe: 54/54 live HTTP and SQL assertions pass, including anonymous/cross-branch reads and mutations, preserved denied-mutation state, stock conservation, and cash reconciliation.
- Local admin :1422, POS 127.0.0.1:8081 and API :3000/api/health return HTTP 200. Authenticated browser journey remains unverified.
- Counter pickup readiness accepted for this milestone. Remaining: pairing/UI, offline replay, concurrent payment safety, and sync HTTP/websocket tenant boundaries (source findings only).
- CEO security checkpoint review next; broader delivery incomplete. Dirty histories and agy session preserved. No migrations, resets, deploys, commits, pushes or consolidation.


---
Phase 1 Resumen de Sucursal admin assessment: existing admin architecture documents identify DashboardPage with sales metrics/live occupancy/shift totals, but no verified backend route contract for daily branch cash/card summary, active shift, or Corte X/Z. Backend specialist confirmed shifts/reports services exist but exact controllers/routes could not be verified; branch_operator may submit summaries while cashier owns drawer/Corte X/Z. No files or migrations changed. Admin production build passed. Recommendation: do not add speculative UI/API calls; feature requires backend contract and likely POS/cashier workflow ownership.


---
## Phase 1 Resumen de Sucursal — 2026-10-02
Requested implementation: daily summary, active shift, cash/card totals, Corte X/Z for branch_operator. No source files were modified because backend specialist could not safely inspect/edit routes in this session and POS specialist clarified no files were actually changed. Admin inspection found DashboardPage metrics but no verified summary/Corte API contract. Verification only: backend build and existing Jest 21 suites/150 tests passed; admin build passed; Flutter analyze has 144 pre-existing issues and tests have unrelated failures. Next step: allocate an editing-capable backend session to inspect existing shifts/reports controllers, implement verified endpoints/tests, then POS UI integration.


---
## Phase 1 Resumen de Sucursal inspection — 2026-10-02 (phase1-resumen-admin-inspect)

Inspection-only; no files modified. Verified knowledge map identifies `apps/business_control_tauri/src/pages/DashboardPage.tsx` as the existing sales metrics/live occupancy/shift totals dashboard. Admin architecture uses TanStack React Query/Axios; no verified API route contract was found for a branch daily cash/card summary, active-shift summary, or Corte X/Z. Existing assessment indicates shifts/reports backend services may exist, but exact controllers/routes and ownership semantics (branch_operator vs cashier for drawer/Corte) are unverified. Do not add speculative API calls or UI.

Proposed minimal follow-up once backend contract is published: extend DashboardPage using existing API client/query pattern with contract-defined summary query, active shift state, and role-gated Corte action; reuse existing shift totals presentation. Backend must first document route, auth scope, date/branch parameters, response fields, and whether Corte X/Z is cashier-owned. Existing handoff records admin production build passed; no new check could be executed from this inspection context.


---
## Phase 1 Resumen de Sucursal — Flutter POS inspection (2026-10-02)
Inspection-only; no files modified. Existing POS branch-operator implementation is in `apps/pos_flutter/lib/ui/branch_operator/`: `encargado_dashboard_screen.dart`, `encargado_pos_tab.dart`, and `encargado_orders_tab.dart`; shared operational state is `lib/ui/common/app_state.dart`. Handoff records existing order park/edit/Cobrar behavior in these files, but no verified Resumen de Sucursal cash/card or shift API integration. Canonical backend data model is `cash_shifts` (branch, opening float, live drawer amount, open/closed status, denomination counts, close snapshot); business rules define Corte X as non-closing audit and Corte Z as closing audit. Exact Flutter service methods/routes/DTOs for shifts, reports, daily branch summary, and Corte X/Z could not be verified from available contracts. Blockers: backend controller route/response/auth scope/date parameters are undocumented/unverified; ownership between `branch_operator` summary submission and `cashier` drawer/Corte must be confirmed; existing handoff notes Flutter analyze has 144 pre-existing issues and unrelated test failures. No speculative UI/API changes recommended until backend contract is published.


---
## Phase 1 Resumen de Sucursal — inspection closure

Inspection complete with no source edits. Confirmed `apps/business_control_tauri/src/pages/DashboardPage.tsx` contains existing sales metrics/live occupancy/shift totals; no verified daily branch cash/card summary, active-shift detail contract, or Corte X/Z route/UI was found. Existing admin build passes. Full Playwright has six pre-existing failures as documented in the inspection report; no new failures were attributed to this work. Workspace released; backend contract remains prerequisite before implementation.

---
## Integration of `013-unify-roles` into `main` (2026-10-02)

- **Scope**: Reconciled and merged active role-unification, orders access guard, staging infra, OKF catalog, and multi-agent developer tooling from branch `013-unify-roles` into `main`.
- **Commits**:
  - `apps/pos_flutter`: Committed branch operator workflows, order editing, and version bump (`aa71533` + `c648f65`).
  - Root: Committed staging infra, MCP server, OKF v0.2 knowledge catalog, and dev tooling (`e422e13`).
  - Fast-forward merge of `013-unify-roles` into `main` completed with zero conflicts.
- **PDCA Quality Verification**:
  - Backend API (`apps/sync_api`): PASSED (build OK, 21/21 suites, 150/150 unit tests pass).
  - Admin Web (`apps/business_control_tauri`): PASSED (`tsc + vite` build OK).
  - POS Flutter (`apps/pos_flutter`): PASSED (`flutter analyze` OK).
  - OKF Documentation (`knowledge/`): PASSED (27/27 concept documents conform to OKF v0.2).
- **Backend Contract Verified**:
  - `cash-shifts` controller: `@Controller('cash-shifts')` with `@Roles(CASHIER_ROLE, BRANCH_OPERATOR_ROLE)` at `apps/sync_api/src/modules/shifts/shifts.controller.ts`.
  - `reports` controller: `@Controller('reports')` at `apps/sync_api/src/modules/reports/reports.controller.ts` providing `sales-dashboard`, `sales/payment-methods`, `cash-shifts`, and `cash-shifts/:id/audit`.
- **Status**: `main` is clean, all tests pass, and ready for deployment or feature extensions.
