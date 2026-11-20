# Handoff — Production Logging per Sucursal (`feat/prod-logging`)

- **Date:** 2026-11-20
- **Last agent:** Claude Code (Opus 5.5)
- **Worktree:** `/Users/joelmorales/web/POS-ERP/.worktrees/prod-logging`. Work here; the main checkout is used by other sessions.
- **Branch:** `feat/prod-logging`. Local only, **not pushed, not deployed**.
- **Feature commit:** `52f363d feat: production diagnostics log pipeline per sucursal`

## 1. Goal

The owner needs to investigate issues that clients report from each sucursal, mainly in the Flutter POS and the admin site `https://cacharelo-central.web.app/`. Any agent (Claude, Codex, agy, opencode) should be able to answer "were there issues today?", find the cause and, when it is easy, fix it.

## 2. What is done

| Layer | What | Files |
|---|---|---|
| Backend (NestJS) | `app_logs` table, created lazily on first use and also in the idempotent migration. Public `POST /api/logs` intake: max 50 entries per request, 600 per IP per 10 min, size limits, PIN/password/token redaction. `ServerErrorsInterceptor` records every 5xx (4xx are ignored). Admin endpoints `GET /api/admin/logs`, `/summary` (grouped by fingerprint, default "today" in America/Mexico_City) and `/:id`. Entries older than 30 days are purged. Every entry is also printed as JSON to Cloud Logging (`logName: app_logs`). | `apps/sync_api/src/modules/logs/*`, `apps/sync_api/src/app.module.ts`, `apps/sync_api/scripts/idempotent-deploy-migrations.ts` (step 20) |
| POS Flutter | `RemoteLogger` hooks `FlutterError.onError`, `PlatformDispatcher.onError` and `debugPrint` (error-looking lines become `warn`; every line becomes a breadcrumb). Queue persisted in SharedPreferences, flushed every 60 s, on errors and when the app is paused. Repeats are deduped into `repeatCount`. `logged_http.dart` is a drop-in `http` replacement that logs ≥400 (except 401/404) and network failures. Context (branch, user, role, device, version) is wired in `main.dart`. | `apps/pos_flutter/lib/services/remote_logger.dart`, `lib/services/logged_http.dart`, `lib/main.dart`, `lib/ui/common/app_state.dart` (import swap only), `test/remote_logger_test.dart` |
| Admin web | `remoteLogger` (queue in localStorage, dedupe, flush with keepalive on pagehide). `apiRequest` logs failures. `api.logError` now goes through it (the old `/products/log-error` endpoint is no longer called by the admin). `AppErrorBoundary` reports render crashes. The current admin tab is the screen context. Vite defines `__APP_BUILD_ID__` as the app version. | `apps/business_control_tauri/src/services/remoteLogger.ts`, `src/services/api.ts`, `src/components/templates/AppErrorBoundary.tsx`, `src/main.tsx`, `src/App.tsx`, `vite.config.ts` |
| Agent tooling | CLI `scripts/prod-logs.mjs` (summary/search/show, `--json`). Make targets `logs-today`, `logs-summary`, `logs-search`, `logs-show`. MCP tools `get_error_summary`, `search_logs`, `get_log_entry`. Playbook `docs/prod-log-triage.md`. Claude skill `.claude/skills/triage-prod-logs`. Pointers in `AGENTS.md` and `CLAUDE.md`. | as listed |

## 3. Verification already done

- `apps/sync_api`: `npx jest` passes 179/179, including `src/modules/logs/logs.spec.ts` (8 tests). `npx tsc --noEmit` passes.
- `apps/pos_flutter`: `flutter test test/remote_logger_test.dart` passes 5/5. `flutter analyze` on the touched files is clean. The full suite has 36 pass and 15 fail; the **same 15 fail on baseline `main`**, so they predate this work.
- `apps/business_control_tauri`: `npx tsc --noEmit` and `npx vite build` pass.
- `apps/mcp_server`: `npx tsc --noEmit` passes.
- **End-to-end (local Postgres via `docker compose up -d` in `apps/sync_api`, API on :3099):**
  - Ingest worked: 3 entries accepted; a spoofed `sync_api` entry and an empty entry were dropped.
  - A real 500 was captured automatically.
  - Grouping worked, and the branch id resolved to "Cacharelo Centro".
  - `pin=4321` in a breadcrumb was stored as `[REDACTED]`.
  - Admin endpoints return 401 without a token.
  - Two different bad ids produced one fingerprint.
  - The CLI and the MCP tools both returned the grouped data.

## 4. Remaining steps (in order)

1. **Branch hygiene.**
   - `feat/prod-logging` sits on top of `018cf20` (a docs commit from `017-sucursal-version`), because another session switched branches mid-session.
   - The feature commit `52f363d` is **also already on `017-sucursal-version`, which has been pushed**. Coordinate with the owner before merging either branch.
   - For a clean PR to `main`: `git checkout -b feat/prod-logging-main origin/main && git cherry-pick 52f363d`.
2. **Security (owner decision, high priority).** Cloud Run `pos-sync-api` has neither `ADMIN_PASSWORD` nor `JWT_SECRET` set, so the code falls back to `admin123` and `dev_jwt_secret_key`.
   - Set both via Secret Manager: `--set-secrets` in the `backend-deploy` / `backend-deploy-fast` Make targets.
   - Rotating `JWT_SECRET` logs out all users.
   - Afterwards, update `POS_ADMIN_TOKEN` (CLI) and the `POS_ADMIN_TOKEN` / `POS_JWT_SECRET` settings of `apps/mcp_server`.
3. **Deploy (with owner approval only):**
   - Optional `make backend-migrate`.
   - `make backend-deploy`.
   - `make admin-deploy`.
   - `make flutter-web-deploy`, plus a new APK (`make flutter-portal-deploy`).
   - Branches only send logs once they run the new POS build.
4. **Post-deploy check:** `export POS_ADMIN_TOKEN=...; make logs-today`. Trigger a test error (e.g. `curl <API>/api/branches/not-a-uuid`) and confirm it appears.
5. **Optional follow-ups:**
   - Fix `GET /api/branches/<invalid-uuid>`: it returns 500 and should return 400 (add `ParseUUIDPipe`).
   - Daily automated triage: a scheduled agent that runs the `/triage-prod-logs` skill each evening.
   - Admin stack traces are minified. Consider uploading hidden sourcemaps privately; they are not public now.
   - The legacy `POST /api/products/log-error` endpoint can be removed once no old admin builds are cached.
   - `apps/pos_flutter/lib/services/version_service.dart` still uses plain `package:http` (not logged).

## 5. Gotchas

- The repo's pre-commit hook auto-bumps the Flutter version in `apps/pos_flutter/pubspec.yaml`. The feature commit bumped it to `1.0.1+40`.
- The root `package.json` and `pnpm-lock.yaml` were untracked before this work. Do not commit them.
- Backend lint (`eslint`) fails repo-wide on `no-unsafe-*` rules, including pre-existing modules. It is not enforced; only prettier was applied to the new files.
- Client-sent `source: "sync_api"` is rejected on intake on purpose, so clients cannot impersonate server logs.
