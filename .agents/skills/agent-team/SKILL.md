---
name: "agent-team"
description: "Orchestrate multi-agent development team (agy, claude, codex, opencode) across isolated git worktrees with PDCA verification gates."
metadata:
  author: "empire-pos-erp"
---

# Multi-Agent Team Orchestration (agy + claude + codex + opencode)

Use this skill whenever coordinating, dispatching, or managing parallel tasks across `agy`, `claude`, `codex`, and `opencode` for full-stack POS-ERP features.

## Autonomous Orchestrator Role
The orchestrator agent (you) executes this pipeline autonomously:
1. Define feature specification & tasks in `specs/<feature-name>/`.
2. Setup isolated worktrees (`./scripts/agent-team.sh setup <feature-name>`).
3. Dispatch specialized coding runners to each app.
4. Monitor background status and tail logs.
5. Verify quality gates (`./scripts/agent-team.sh check all`).
6. Merge completed branches back into the active branch (`./scripts/agent-team.sh merge <feature-name>`).

## Domain Specialization
- **`agy` (Master / Architect)**: Specification planning, DB migrations, Drizzle ORM schemas, NestJS DTO contracts in `apps/sync_api`, MCP server, and overall team verification.
- **`codex` (POS Specialist)**: POS Flutter client in `apps/pos_flutter` (Dart widgets, Riverpod state, POS screens, printing, responsive layouts).
- **`claude` (Full-Stack / Refactor Specialist)**: High-precision TypeScript/React components, state management, complex multi-file logic, and tests.
- **`opencode` (Admin Web Specialist)**: Admin dashboard in `apps/business_control_tauri` (React, Vite, Tailwind CSS, API service integration, Playwright tests).

## Execution Pipeline

### 1. Setup Feature Worktrees
```bash
./scripts/agent-team.sh setup <feature-name>
```
Creates isolated worktrees:
- `.worktrees/backend` (branch: `<feature-name>/backend`)
- `.worktrees/admin`   (branch: `<feature-name>/admin`)
- `.worktrees/pos`     (branch: `<feature-name>/pos`)

### 2. Dispatching Tasks
Always provide an exact contract (DTO, endpoint, acceptance criteria) when dispatching:

```bash
# Dispatch codex to POS Flutter:
./scripts/agent-team.sh dispatch codex pos "Implement screen X in lib/ui/... using DTO Y. Run flutter analyze when done."

# Dispatch claude to Admin Web:
./scripts/agent-team.sh dispatch claude admin "Add Resumen de Sucursal page in src/pages/... calling api.getCashShifts()."

# Dispatch opencode to Admin Web:
./scripts/agent-team.sh dispatch opencode admin "Create component X in src/components/... following Tailwind card patterns."
```

### 3. Monitoring & Logs
```bash
# Check status of active runners
./scripts/agent-team.sh status

# Tail real-time logs of a specific agent
./scripts/agent-team.sh logs codex
```

### 4. PDCA Quality Gate (Crucial)
```bash
./scripts/agent-team.sh check all
```
- Backend: `apps/sync_api` build check.
- Admin: `apps/business_control_tauri` typecheck and build check.
- POS: `apps/pos_flutter` analyzer check.

### 5. Automated Merge & Cleanup
When all gates pass:
```bash
./scripts/agent-team.sh merge <feature-name>
```
This merges `<feature-name>/backend`, `<feature-name>/admin`, and `<feature-name>/pos` into the current branch, validates the merged tree with `check all`, and cleans up worktrees.
