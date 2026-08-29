# Claude Agent Instructions

> **Master Instructions**: This repository follows the multi-agent coordination protocol and navigation guidelines defined in [`AGENTS.md`](./AGENTS.md) and [`docs/AGENT_NAVIGATION_GUIDE.md`](./docs/AGENT_NAVIGATION_GUIDE.md).

## Quick Domain Lookup

| Domain | Where to Look |
|---|---|
| 🗄️ **Database & Migrations** | [`docs/pre-deployment-checklist.md`](./docs/pre-deployment-checklist.md) / [`apps/sync_api/src/database/schema.ts`](./apps/sync_api/src/database/schema.ts) |
| 📦 **Inventory, BOM & OP** | [`INVENTORY_ARCHITECTURE.md`](./INVENTORY_ARCHITECTURE.md) |
| 🖥️ **Admin Dashboard** | [`apps/business_control_tauri/src/services/api.ts`](./apps/business_control_tauri/src/services/api.ts) |
| 📱 **POS App (Flutter)** | [`apps/pos_flutter/lib/ui/common/app_state.dart`](./apps/pos_flutter/lib/ui/common/app_state.dart) |
| 🧪 **Local Testing** | [`docs/App local testing.md`](./docs/App%20local%20testing.md) |
| 🚀 **Deployments** | [`.claude/deployment-agent.md`](./.claude/deployment-agent.md) |
| 🔄 **Session State** | [`HANDOFF.md`](./HANDOFF.md) / [`.claude/workspaces.md`](./.claude/workspaces.md) |

## Session Wrap-Up Protocol
When concluding any work session, follow the 4-step closing protocol in [`docs/AGENT_NAVIGATION_GUIDE.md`](./docs/AGENT_NAVIGATION_GUIDE.md#4-session-wrap-up--documentation-protocol-when-closing-an-agent-session):
1. Update `HANDOFF.md`.
2. Update domain docs (`INVENTORY_ARCHITECTURE.md`, `docs/pre-deployment-checklist.md`, etc.).
3. Update `.claude/workspaces.md`.
4. Run verification builds and commit cleanly.
