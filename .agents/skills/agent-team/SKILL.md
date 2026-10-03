---
name: "agent-team"
description: "Orchestrate multi-agent development team (agy, codex, opencode) across isolated git worktrees with PDCA verification gates."
metadata:
  author: "empire-pos-erp"
---

# Multi-Agent Team Orchestration (agy + codex + opencode)

Use this skill whenever the user asks to coordinate, dispatch, or manage tasks across `agy`, `codex`, and `opencode`, or when executing full-stack features in parallel.

## Domain Specialization
- **`agy` (Master / Architect)**: Root Parent Agent. Handles specs (`specs/`), DB migrations, Drizzle ORM schemas, NestJS DTO contracts in `apps/sync_api`, MCP server, and overall team verification.
- **`codex` (POS Specialist)**: POS Flutter client in `apps/pos_flutter` (Dart widgets, Riverpod state, POS screens, printing, responsive layouts).
- **`opencode` (Admin Web Specialist)**: Admin dashboard in `apps/business_control_tauri` (React, Vite, Tailwind CSS, API service integration, Playwright tests).

## Fast Execution Workflow

### 1. Setup Feature Worktrees
Run the team setup command to prepare isolated directories:
```bash
./scripts/agent-team.sh setup <feature-name>
```
This creates:
- `.worktrees/backend` (branch: `<feature-name>/backend`)
- `.worktrees/admin`   (branch: `<feature-name>/admin`)
- `.worktrees/pos`     (branch: `<feature-name>/pos`)

### 2. Dispatching Tasks
Always provide an exact contract (DTO, endpoint, acceptance criteria) when dispatching:

```bash
# Dispatch codex to POS Flutter:
./scripts/agent-team.sh dispatch codex pos "Implement screen X in lib/ui/... using DTO Y. Run flutter analyze when done."

# Dispatch opencode to Admin Web:
./scripts/agent-team.sh dispatch opencode admin "Create page X in src/pages/... calling api.getY(). Follow existing Tailwind card patterns."
```

### 3. Monitoring
Check progress at any time:
```bash
make team-status
```
or inspect log files in `.worktrees/logs/`.

### 4. PDCA Verification Gate (Crucial)
Before marking any work as complete or merging, run the universal check:
```bash
make check-all
```
- Backend: `apps/sync_api` build check.
- Admin: `apps/business_control_tauri` typecheck and build check.
- POS: `apps/pos_flutter` analyzer check.

If any check fails, inspect the error and adjust before presenting results to the user.

### 5. Cleanup
When the feature is validated and merged:
```bash
make team-clean
```
