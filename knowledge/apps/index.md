# 📦 Applications Guide

This section contains dedicated technical overviews for each standalone application in the POS-ERP monorepo.

---

## 📱 Application Index

| Application | Directory | Primary Role | Stack | Production Artifact |
| :--- | :--- | :--- | :--- | :--- |
| [Backend API](sync-api.md) | `apps/sync_api/` | Central authority for business rules, database, and auth. | NestJS, Drizzle ORM, PostgreSQL, WebSockets | Cloud Run Docker container (`pos-sync-api`) |
| [Admin Dashboard](business-control-tauri.md) | `apps/business_control_tauri/` | Tenant business administration, catalog, inventory, and users. | React 18, Vite, Tailwind CSS, Tauri | Firebase Hosting (`cacharelo-central.web.app`) |
| [Flutter POS](pos-flutter.md) | `apps/pos_flutter/` | Offline-first restaurant point-of-sale and terminal interface. | Flutter, Riverpod, Drift (SQLite) | Firebase Hosting (`cacharelo-pos.web.app`) & Android APK |
| [MCP Server](mcp-server.md) | `apps/mcp_server/` | Agentic interface connecting AI models to ERP operations. | TypeScript, `@modelcontextprotocol/sdk` | Node.js stdio daemon |
