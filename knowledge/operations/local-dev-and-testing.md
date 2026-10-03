---
type: "runbook"
title: "Local Development & Testing Runbook"
description: "Instructions for running local database, local NestJS API, local React admin, Flutter POS web, and running test suites."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "local-dev"
  - "testing"
  - "ports"
  - "runbook"
sources:
  - "Makefile"
  - "HANDOFF.md"
  - "docs/App local testing.md"
---

# Local Development & Testing Runbook

This guide covers running the POS-ERP stack on your local machine for rapid iteration, debugging, and verification.

---

## 1. Local Service Port Mapping

| Service | Local Address | Database Target |
| :--- | :--- | :--- |
| **NestJS Backend API** | `http://localhost:3001/api` | Local PostgreSQL `pos_dev` (port 5432) |
| **React Admin Dashboard** | `http://localhost:5173` | Targets `http://localhost:3001/api` |
| **Flutter POS Web** | `http://localhost:8081` | Targets `http://localhost:3001/api` |
| **MCP Server (Stdio)** | Process pipe | Targets `http://localhost:3001/api` |

---

## 2. Launching Local Services

```bash
# Start local NestJS backend API with hot reload
make dev-backend-local
# or: cd apps/sync_api && npm run start:dev

# Start local React Admin Dashboard
make admin-dev-local
# or: cd apps/business_control_tauri && pnpm dev

# Start Flutter POS Web in development
cd apps/pos_flutter && flutter run -d chrome --web-port 8081 --dart-define=API_URL=http://localhost:3001/api
```

---

## 3. Pre-Commit Verification Checklist

Before opening a pull request or concluding an agent session, execute all three checks:

```bash
# 1. Backend verification (build + unit tests)
cd apps/sync_api && npm run build && npm test

# 2. Admin dashboard verification (type check + production build)
cd apps/business_control_tauri && pnpm build

# 3. Flutter POS verification (linting & analyzer)
cd apps/pos_flutter && flutter analyze

# 4. OKF Documentation validation (ensures valid YAML & link integrity)
make okf-validate
# or: node scripts/validate-okf.mjs knowledge
```
