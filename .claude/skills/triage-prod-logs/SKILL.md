---
name: triage-prod-logs
description: Check production logs (POS Flutter app, admin web cacharelo-central, sync API) for issues in a day or at a sucursal, group them, find the cause in code and propose or apply small fixes. Use when asked "were there issues today?", "what failed at <sucursal>?", or to investigate a client-reported problem.
---

Follow `docs/prod-log-triage.md` step by step.

1. Run `make logs-today`. Pass `BRANCH=`, `DATE=` or `HOURS=` when the user names a sucursal or a day. If `POS_ADMIN_TOKEN` is missing, ask the user to `export` it.
2. For each issue, run `make logs-show ID=<sampleId>`, read the breadcrumbs, and find the code as the playbook describes.
3. Reply with the report table from the playbook (in Spanish if the user writes in Spanish).
4. Only fix issues that are clear-cut and small: work on a branch, add a focused test, run that app's checks. Never deploy without explicit approval.
