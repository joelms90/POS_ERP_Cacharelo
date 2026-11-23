# Claude Agent Instructions

> **Master Instructions**: This repository follows the multi-agent coordination protocol and navigation guidelines defined in [`AGENTS.md`](./AGENTS.md) and [`docs/AGENT_NAVIGATION_GUIDE.md`](./docs/AGENT_NAVIGATION_GUIDE.md).

## Quick Domain Lookup

| Domain | Where to Look |
|---|---|
| 🧭 **Task routing** | `make route Q="<task>"` — best skill + SOP + make target, no LLM |
| 🔄 **Business flows** | `make flows` / `make flow Q="<flow>"`; maintain via skill `maintain-business-flows` |
| 🗄️ **Database & Migrations** | [`docs/pre-deployment-checklist.md`](./docs/pre-deployment-checklist.md) / [`apps/sync_api/src/database/schema.ts`](./apps/sync_api/src/database/schema.ts) |
| 📦 **Inventory, BOM & OP** | [`INVENTORY_ARCHITECTURE.md`](./INVENTORY_ARCHITECTURE.md) |
| 🖥️ **Admin Dashboard** | [`apps/business_control_tauri/src/services/api.ts`](./apps/business_control_tauri/src/services/api.ts) |
| 📱 **POS App (Flutter)** | [`apps/pos_flutter/lib/ui/common/app_state.dart`](./apps/pos_flutter/lib/ui/common/app_state.dart) |
| 🧪 **Local Testing** | [`docs/App local testing.md`](./docs/App%20local%20testing.md) |
| 🩺 **Prod Issues / Logs** | [`docs/prod-log-triage.md`](./docs/prod-log-triage.md) (`make logs-today`, skill `/triage-prod-logs`) |
| 🚀 **Deployments** | [`.claude/deployment-agent.md`](./.claude/deployment-agent.md) |
| 🔄 **Session State** | [`HANDOFF.md`](./HANDOFF.md) / [`.claude/workspaces.md`](./.claude/workspaces.md) |

## Session Wrap-Up Protocol
When concluding any work session, follow the 4-step closing protocol in [`docs/AGENT_NAVIGATION_GUIDE.md`](./docs/AGENT_NAVIGATION_GUIDE.md#4-session-wrap-up--documentation-protocol-when-closing-an-agent-session):
1. Update `HANDOFF.md`.
2. Update domain docs (`INVENTORY_ARCHITECTURE.md`, `docs/pre-deployment-checklist.md`, etc.).
3. Update `.claude/workspaces.md`.
4. Run verification builds and commit cleanly.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
