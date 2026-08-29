# GitHub Copilot & VS Code Agent Instructions

This repository uses a multi-app monorepo structure. Follow the guidelines in:
- [`AGENTS.md`](../AGENTS.md)
- [`docs/AGENT_NAVIGATION_GUIDE.md`](../docs/AGENT_NAVIGATION_GUIDE.md)
- [`HANDOFF.md`](../HANDOFF.md)

## Domain Navigation:
- **Database / Schema**: `apps/sync_api/src/database/schema.ts`, `docs/pre-deployment-checklist.md`
- **Inventory & Production (OP)**: `INVENTORY_ARCHITECTURE.md`
- **Admin Dashboard**: `apps/business_control_tauri/src/services/api.ts`
- **POS Flutter**: `apps/pos_flutter/lib/ui/common/app_state.dart`
- **Local Dev & Testing**: `docs/App local testing.md`
- **Deployments**: `.claude/deployment-agent.md`

## Closing Protocol:
When concluding work:
1. Update `HANDOFF.md`.
2. Update domain docs if DB/inventory/printing changed.
3. Update `.claude/workspaces.md`.
4. Verify builds pass before committing.
