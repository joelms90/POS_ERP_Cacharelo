# 🧭 Agent Navigation & Lookup Guide

> **Purpose**: Single source of truth for AI agents and developers to quickly locate relevant architecture, files, commands, and rules **before starting any modification**.

---

## 1. Quick Decision Matrix: Where to Look First

| Domain / Task | What to Inspect First | Key Source Files |
| :--- | :--- | :--- |
| **📚 Open Knowledge Base (OKF)** | [`knowledge/index.md`](../knowledge/index.md) | Machine-readable OKF v0.2 bundle (`make okf-validate`) |
| **⚖️ Authoritative Business Rules** | [`knowledge/business-rules/index.md`](../knowledge/business-rules/index.md) | `knowledge/business-rules/inventory-rules.md`<br>`knowledge/business-rules/purchasing-rules.md`<br>`knowledge/business-rules/kds-routing-rules.md`<br>`knowledge/business-rules/roles-permissions-rules.md` |
| **🗄️ Database & Migrations** | [`docs/pre-deployment-checklist.md`](../docs/pre-deployment-checklist.md) | `apps/sync_api/src/database/schema.ts`<br>`apps/sync_api/scripts/idempotent-deploy-migrations.ts` |
| **📦 Inventory, BOM & Production (OP)** | [`INVENTORY_ARCHITECTURE.md`](../INVENTORY_ARCHITECTURE.md) | `apps/sync_api/src/modules/inventory/`<br>`apps/business_control_tauri/src/pages/AssemblyPage.tsx` |
| **🖥️ Admin Dashboard (React/Vite)** | [`apps/business_control_tauri/README.md`](../apps/business_control_tauri/README.md) | `apps/business_control_tauri/src/services/api.ts`<br>`apps/business_control_tauri/src/pages/`<br>`apps/business_control_tauri/src/components/` |
| **📱 POS App (Flutter)** | [`apps/pos_flutter/README.md`](../apps/pos_flutter/README.md) | `apps/pos_flutter/lib/ui/common/app_state.dart`<br>`apps/pos_flutter/lib/services/` |
| **🧪 Local Dev & Testing** | [`docs/App local testing.md`](../docs/App%20local%20testing.md) | `Makefile` (`make dev-backend-local`, `make admin-dev-local`) |
| **🚀 Deployments & Infra** | [`.claude/deployment-agent.md`](../.claude/deployment-agent.md) | `Makefile` (`make backend-deploy-fast`, `make admin-deploy`, `make flutter-portal-deploy`) |
| **🔄 Session Handoffs & State** | [`HANDOFF.md`](../HANDOFF.md) | `.claude/workspaces.md` |

---

## 2. Core Architectural Rules (Do Not Violate)

1. **Database Migrations in Production**:
   - Never run raw Drizzle journals on production (they fail on legacy objects like `admin_business_access`).
   - Always use idempotent DDL scripts via `make backend-migrate`.
2. **Inventory Source of Truth**:
   - All physical inventory movements must go through `stock_ledger` and `LedgerService`.
   - Production Orders (OP) follow: `pending` (no stock deducted) ➔ `in_progress` ➔ `completed` (deducts raw materials from origin warehouse, adds finished product to destination warehouse).
3. **Flutter POS Versioning**:
   - Always increment version before releasing or committing major features via `make flutter-bump-version`.
4. **Environment Variables & APIs**:
   - Never hardcode user credentials, API URLs, or passwords in frontend code.
   - Use dynamic configurations (`VITE_API_URL`, `--dart-define=API_URL=...`).

---

## 3. Verification & Build Commands

Before marking any task as complete:
```bash
# Backend verification
cd apps/sync_api && npm run build && npm test

# Admin verification
cd apps/business_control_tauri && pnpm build

# POS verification
cd apps/pos_flutter && flutter analyze
```

---

## 4. Session Wrap-Up & Documentation Protocol (When Closing an Agent Session)

Before concluding your turn or handing off to another agent, follow this **4-Step Closing Checklist**:

### Step 1: Update `HANDOFF.md`
- **Executive Summary**: 2-3 sentences summarizing the exact feature, fix, or investigation completed.
- **Key Changes & File Map**: Bulleted list of modified or created files with brief explanations.
- **Current Status**: Update the status table (Live, In Progress, Blocked).
- **Next Steps**: Actionable checklist of what the next agent should pick up next.

### Step 2: Update Domain Architecture Docs (If Affected)
- **If DB schema or migrations changed**: Add table/column to [`docs/pre-deployment-checklist.md`](../docs/pre-deployment-checklist.md) and ensure [`apps/sync_api/scripts/idempotent-deploy-migrations.ts`](../apps/sync_api/scripts/idempotent-deploy-migrations.ts) is in sync.
- **If inventory, BOM, OP, or transfer logic changed**: Update [`INVENTORY_ARCHITECTURE.md`](../INVENTORY_ARCHITECTURE.md).
- **If thermal printing or hardware settings changed**: Update [`docs/THERMAL_PRINTER_KNOWLEDGE_BASE.md`](../docs/THERMAL_PRINTER_KNOWLEDGE_BASE.md).
- **If a feature specification was implemented**: Update the checklist in the corresponding `specs/<feature>/` folder.

### Step 3: Update Workspace Tracking
- Edit [`.claude/workspaces.md`](../.claude/workspaces.md) to mark your session as completed or release any active app locks.

### Step 4: Clean Commit
- Ensure all builds pass cleanly.
- Commit changes with conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, or `chore:`.
