---
type: "architecture"
title: "Monorepo Overview & App Boundaries"
description: "Architectural blueprint of the POS-ERP monorepo, detailing application responsibilities, tech stacks, and deployment decoupling."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "architecture"
  - "monorepo"
  - "boundaries"
  - "tech-stack"
sources:
  - "Makefile"
  - "AGENTS.md"
  - ".claude/deployment-agent.md"
---

# Monorepo Overview & App Boundaries

The **POS-ERP Cacharelo** codebase is organized as a multi-app monorepo designed for high modularity, independent build targets, and resilient local-first execution.

```text
POS-ERP/
├── apps/
│   ├── sync_api/                  # NestJS Backend API & WebSocket Gateway
│   ├── business_control_tauri/    # React/Vite Admin Web & Desktop App
│   ├── pos_flutter/               # Flutter Multiplatform POS (Web & Android APK)
│   ├── landing_page/              # Public Marketing & Menu Portal
│   └── mcp_server/                # Model Context Protocol Server for AI Agents
├── docs/                          # Guides, specifications, runbooks
├── knowledge/                     # Open Knowledge Format (OKF v0.2) bundle
├── scripts/                       # Deployment, migration, and validation scripts
└── specs/                         # Feature specifications and task plans
```

---

## Application Boundaries & Technologies

| Application | Path | Technology Stack | Production Deployment |
| :--- | :--- | :--- | :--- |
| **Backend API** | `apps/sync_api/` | NestJS, Drizzle ORM, PostgreSQL, Socket.io | Google Cloud Run (`pos-sync-api`) |
| **Admin Dashboard** | `apps/business_control_tauri/` | React 18, Vite, Tailwind CSS, Lucide, Tauri | Firebase Hosting (`cacharelo-central.web.app`) |
| **POS Application** | `apps/pos_flutter/` | Flutter 3.x, Riverpod, Drift (SQLite) | Firebase Hosting (`cacharelo-pos.web.app`) & GCP Bucket APK |
| **Landing Page** | `apps/landing_page/` | Astro / Next.js, Tailwind CSS | Firebase Hosting / Vercel |
| **MCP Server** | `apps/mcp_server/` | TypeScript, `@modelcontextprotocol/sdk` | Stdio CLI execution for Claude / Antigravity / Cursor |

---

## Independent Deployment Targets

Each application can be compiled, tested, and deployed independently without rebuilding or redeploying the rest of the repository:

- **Backend**: `make backend-deploy-fast`
- **Admin**: `make admin-deploy`
- **POS Web Only**: `make flutter-web-deploy`
- **POS Portal + Android APK**: `make flutter-portal-deploy`
- **Landing Page**: `make landing-deploy`

For detailed operational procedures, see [Deployments Runbook](../operations/deployment-runbook.md).
