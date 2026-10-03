---
type: "runbook"
title: "Production Deployments Runbook"
description: "Authoritative commands, rollback strategies, and infrastructure specifications for deploying backend, admin, and POS frontends."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "devops"
  - "deployments"
  - "cloud-run"
  - "firebase"
  - "runbook"
sources:
  - "Makefile"
  - ".claude/deployment-agent.md"
  - "docs/pre-deployment-checklist.md"
---

# Production Deployments Runbook

This runbook documents production release commands, infrastructure parameters, and migration execution guidelines. Prefer using repository `Makefile` targets.

---

## 1. Quick Target Reference

```bash
# 1. Database Migrations (Run via Cloud SQL Proxy)
make backend-migrate

# 2. Deploy Backend Sync API (Google Cloud Run)
make backend-deploy-fast

# 3. Check Cloud Run Health & Status
make backend-status
make backend-logs

# 4. Deploy Admin Dashboard (Firebase Hosting)
make admin-deploy

# 5. Deploy Flutter POS Web Only (Firebase Hosting)
make flutter-web-deploy

# 6. Deploy Full Flutter Release (Web + Android APK + Storage Bucket + descargas.html)
make flutter-portal-deploy

# 7. Deploy Marketing Landing Page
make landing-deploy
```

---

## 2. Infrastructure Parameters

- **GCP Project**: `fresh-sensor-497515-d3`
- **Region**: `us-central1`
- **Cloud Run Service**: `pos-sync-api`
- **Production API URL**: `https://pos-sync-api-232144991863.us-central1.run.app/api`
- **Cloud SQL Instance**: `pos-db-instance` (PostgreSQL 15)
- **Admin Dashboard URL**: `https://cacharelo-central.web.app`
- **Web POS URL**: `https://cacharelo-pos.web.app`
- **POS Downloads Portal**: `https://cacharelo-pos.web.app/descargas.html` (PIN: `9876`)
- **GCP Storage Bucket**: `gs://cacharelo-pos-releases/`

---

## 3. Database Migration Protocol

**CRITICAL**: Only ONE session may run production migrations at a time.
1. Declare migration intent in `.claude/workspaces.md`.
2. Ensure you have Cloud SQL Proxy access (`make db-proxy` or automatic proxy wrapper in migration script).
3. Always verify that migrations are **idempotent DDL statements** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
4. Execute `make backend-migrate`.
5. Update `.claude/workspaces.md` upon completion.
