# Production Log Triage Playbook

> Agent-agnostic: works the same for Claude Code, Codex, agy (Antigravity), opencode, or a human.
> Goal: answer **"were there any issues today, at which sucursal, and can we fix them?"**

## 1. What gets logged

All three apps write into one Postgres table, `app_logs`, kept for 30 days (`APP_LOGS_RETENTION_DAYS`).

| `source` | What is captured | Code |
|---|---|---|
| `pos_flutter` | Uncaught Flutter/async errors; HTTP responses ≥400 (except 401/404) and network failures; any `debugPrint` line that looks like an error (`error`, `exception`, `failed`, `falló`, `no se pudo`, `❌`) | `apps/pos_flutter/lib/services/remote_logger.dart`, `logged_http.dart` |
| `admin_web` (cacharelo-central.web.app) | `window.onerror`, unhandled promise rejections, React render crashes (error boundary), API responses ≥400 (except 401/404) and network failures | `apps/business_control_tauri/src/services/remoteLogger.ts` |
| `sync_api` | Every HTTP 5xx / unhandled exception, with route, handler, user and branch | `apps/sync_api/src/modules/logs/server-errors.interceptor.ts` |

Each entry has: branch (`branch_id` resolved to the branch name), user name/role, device id, app version, platform, route/HTTP status, stack, and **breadcrumbs** (the device's last ~40 log lines and HTTP calls before the error). Clients queue entries offline and send them when the API is reachable again, so `occurred_at` can be earlier than `created_at`.

PINs, passwords, tokens and `Bearer` values are redacted on the server. Bound SQL params on credential queries are redacted too.

## 2. Access

Admin endpoints need `POS_ADMIN_TOKEN` (the API's `ADMIN_PASSWORD`, sent as `X-Admin-Token`). `POS_API_URL` defaults to production.

```bash
export POS_ADMIN_TOKEN=...            # once per shell
make logs-today                       # grouped issues today (America/Mexico_City), warn+
make logs-today BRANCH=<branchId>     # one sucursal
make logs-summary DATE=2026-11-19     # another day   (or HOURS=6)
make logs-search Q="sync/push" HOURS=24
make logs-search FP=<fingerprint>     # every occurrence of one issue
make logs-show ID=<logId>             # full entry: stack, breadcrumbs, context
```

The same data is available as MCP tools in `apps/mcp_server`: `get_error_summary`, `search_logs` and `get_log_entry`. HTTP endpoints: `GET /api/admin/logs/summary`, `GET /api/admin/logs`, `GET /api/admin/logs/:id`.

Add `--json` (via `node scripts/prod-logs.mjs summary --json`) for machine-readable output.

## 3. Triage procedure (for agents)

1. **Summarize.** Run `make logs-today`. If there are no issues, report "no issues" and stop.
2. **Prioritize.** Use this order: `fatal` first, then `error` by count, then issues affecting several branches or devices, then `warn`.
3. **Investigate each issue.** For each one:
   - Run `make logs-show ID=<sampleId>` and read the **breadcrumbs** to see what the user was doing.
   - Find the code:
     - `pos_flutter`, `context.kind = debug_print`: grep the message text in `apps/pos_flutter/lib` to find the `debugPrint` call and its `catch`.
     - `pos_flutter`, `kind = http_response`: the client side is in `app_state.dart` (grep the route). Then look for a matching `sync_api` entry (same route, same minute) for the server stack.
     - `sync_api`: `context.handler` gives `Controller.method`. The stack points into `apps/sync_api/src/modules/...`.
     - `admin_web`: stacks are minified. Use `context.screen` (admin tab) plus the message to find the page in `apps/business_control_tauri/src/pages/`.
   - Classify the issue:
     - **Bug**: code defect.
     - **Data**: bad or missing records.
     - **Infra/connectivity**: `HTTP network failure` at one branch only usually means the sucursal's internet. Across all branches it means the API was down.
     - **Old version**: check `appVersions` against the current release.
4. **Report** using this format:

   | # | Severity | Source | Sucursal(es) | Count | What happened | Probable cause (file:line) | Fix | Confidence |
   |---|---|---|---|---|---|---|---|---|

5. **Fix (only when the cause is clear and the change is small).** Create a branch, write the fix and a focused test, and run that app's checks (`npx jest` in sync_api, `flutter test` in pos_flutter, `npx tsc --noEmit` in the admin). **Do not deploy** without the owner's approval. Leave a summary in `HANDOFF.md`.

## 4. Raw server logs

Every entry is also printed to stdout as JSON (`logName: "app_logs"`), so it is in Cloud Logging even if the DB insert fails:

```bash
gcloud logging read 'resource.labels.service_name="pos-sync-api" AND jsonPayload.logName="app_logs"' \
  --project fresh-sensor-497515-d3 --limit 50 --freshness 1d
```
