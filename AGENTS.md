<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read:
specs/017-sucursal-version/plan.md
<!-- SPECKIT END -->

# Multi-Session Workspace Coordination

**⚠️ IMPORTANT: Read this BEFORE starting any work in this monorepo!**

This is a **monorepo** with multiple independent apps. Multiple development sessions (different terminals, developers, AI assistants, or team members) can work simultaneously on different apps **without conflicts** if you follow the workspace coordination protocol.

## Quick Start: Before You Begin

0. **Route the task first** (no tokens spent guessing):
   ```bash
   make route Q="deploy the backend"
   ```
   Returns the best-matching skill, SOP doc, Make target and `graphify query` for code. Run it before reading `make help`, `docs/AGENT_NAVIGATION_GUIDE.md`, `knowledge/index.md`, or grepping.

1. **Check active workspaces**:
   ```bash
   cat .claude/workspaces.md
   ```
   This shows which sessions (terminals/developers/assistants) are working on which apps right now.

2. **Declare your workspace**:
   - Add your session to `.claude/workspaces.md`
   - Commit and push immediately
   - This prevents others from accidentally working on the same files

3. **Use app-scoped branches** for parallel work:
   ```bash
   # Instead of working on: 011-purchase-orders-requisitions
   # Create app-scoped branch:
   git checkout -b 011-purchase-orders-requisitions/backend    # for apps/sync_api/
   git checkout -b 011-purchase-orders-requisitions/pos        # for apps/pos_flutter/
   git checkout -b 011-purchase-orders-requisitions/admin      # for apps/business_control_tauri/
   ```

## Essential Documentation & Quick Lookup

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [`knowledge/index.md`](knowledge/index.md) | **Open Knowledge Format (OKF v0.2) Catalog** | AI agents navigating architecture, schemas & rules |
| [`docs/AGENT_NAVIGATION_GUIDE.md`](docs/AGENT_NAVIGATION_GUIDE.md) | **Where to look by domain** | Before starting any code changes |
| [`.claude/workspaces.md`](.claude/workspaces.md) | **Active workspace tracking** | ALWAYS read FIRST before starting work |
| [`HANDOFF.md`](HANDOFF.md) | **Latest session state & handoff** | When picking up or resuming work |
| [`INVENTORY_ARCHITECTURE.md`](INVENTORY_ARCHITECTURE.md) | **Inventory, BOM & OP architecture** | Before modifying inventory/production |
| [`docs/pre-deployment-checklist.md`](docs/pre-deployment-checklist.md) | **DB migrations & deploy checklist** | Before migrating DB or deploying |
| [`.claude/deployment-agent.md`](.claude/deployment-agent.md) | **Deployment operations manual** | When deploying any component |

## Multi-Agent Team Orchestration (agy + codex + opencode)

This monorepo supports autonomous parallel development using **`agy`**, **`codex`**, and **`opencode`**:
- **`agy` (Root Master / Architect)**: Manages specs (`specs/`), DB migrations, Drizzle schemas, NestJS backend API contracts (`apps/sync_api`), and team coordination.
- **`codex` (POS Flutter Specialist)**: POS Flutter client in `apps/pos_flutter` (Dart widgets, Riverpod state, POS screens).
- **`opencode` (Admin Web Specialist)**: Admin dashboard in `apps/business_control_tauri` (React, Vite, Tailwind, Playwright E2E).

### Fast Commands
- `make team-setup FEATURE=<name>` - Prepare isolated worktrees (`.worktrees/backend`, `.worktrees/admin`, `.worktrees/pos`)
- `./scripts/agent-team.sh dispatch codex pos "<prompt>"` - Dispatch codex headlessly in background
- `./scripts/agent-team.sh dispatch opencode admin "<prompt>"` - Dispatch opencode headlessly in background
- `make team-status` - Check status of active AI workers and logs
- `make check-all` - Run PDCA verification gate across all apps (backend, admin, pos)
- `make team-clean` - Safely terminate background workers and remove worktrees

## Production Issue Triage (any agent)

Errors from the POS Flutter app, the admin web (cacharelo-central.web.app) and API 5xx are stored per sucursal in `app_logs`.
To answer "were there issues today?": `export POS_ADMIN_TOKEN=...` then run `make logs-today`, and follow [`docs/prod-log-triage.md`](docs/prod-log-triage.md).
MCP equivalents: `get_error_summary`, `search_logs` and `get_log_entry` in `apps/mcp_server`.

## App Boundaries

Each app is independent - different sessions can work on different apps simultaneously:

| App | Directory | Independent Deployment |
|-----|-----------|----------------------|
| Backend API | `apps/sync_api/` | ✅ `make backend-deploy-fast` |
| Admin Dashboard | `apps/business_control_tauri/` | ✅ `make admin-deploy` |
| POS Application | `apps/pos_flutter/` | ✅ `make flutter-web-deploy` |
| Landing Page | `apps/landing_page/` | ✅ `make landing-deploy` |

## Shared Files - Requires Coordination

These files are shared across apps. **Check `.claude/workspaces.md` before modifying**:
- `Makefile` - Build and deployment targets
- `AGENTS.md` - This file
- `HANDOFF.md` - Session handoff documentation
- `specs/` - Feature specifications
- Database migrations - **Only ONE agent should run migrations at a time**

## Conflict Prevention Rules

### ✅ DO
- Read `.claude/workspaces.md` before starting work
- Create app-scoped branches for parallel development
- Declare your workspace immediately
- Stay within your app's directory boundaries
- Coordinate database migrations explicitly
- Deploy only your app

### ❌ DON'T
- Work on the same branch as another active session
- Modify shared files without checking workspace declarations
- Run migrations without coordinating with other sessions
- Deploy all apps from different sessions simultaneously
- Force push to shared branches

## Example: Safe Parallel Development

**Session 1** (Backend Development):
```bash
# Check what's happening
cat .claude/workspaces.md

# Create backend branch
git checkout -b 011-purchase-orders/backend

# Declare workspace
echo "## Session 1 - Working on apps/sync_api/" >> .claude/workspaces.md
git add .claude/workspaces.md && git commit -m "chore: declare backend workspace" && git push

# Work on backend
cd apps/sync_api/
# ... make changes ...
git add . && git commit -m "feat(backend): add purchase orders API"
git push
```

**Session 2** (POS Development) - Running simultaneously:
```bash
# Check what's happening
cat .claude/workspaces.md  # See: Session 1 working on apps/sync_api/

# Create POS branch (no conflict!)
git checkout -b 011-purchase-orders/pos

# Declare workspace
echo "## Session 2 - Working on apps/pos_flutter/" >> .claude/workspaces.md
git add .claude/workspaces.md && git commit -m "chore: declare pos workspace" && git push

# Work on POS (no conflict with backend!)
cd apps/pos_flutter/
# ... make changes ...
git add . && git commit -m "feat(pos): add requisition UI"
git push
```

**Result**: Both sessions work in parallel with **zero conflicts** ✅

## Database Migration Coordination

**⚠️ CRITICAL**: Only ONE agent should run `make backend-migrate` at a time.

**Protocol**:
1. Declare intent in `.claude/workspaces.md`:
   ```markdown
   ### Backend Session
   - Migration Status: Running migration 0017 at 15:00
   ```
2. Commit and push the workspace file
3. Wait 2 minutes for other sessions to acknowledge
4. Run migration: `make backend-migrate`
5. Update workspace file: `Migration Status: ✅ Completed 0017`

## Quick Reference

```bash
# Before starting ANY work
cat .claude/workspaces.md                    # Check active sessions

# Create app-scoped branch
git checkout -b FEATURE/app-name             # e.g., 011-purchase-orders/backend

# Declare your workspace
vim .claude/workspaces.md                    # Add your session
git add .claude/workspaces.md && git commit -m "chore: declare workspace" && git push

# Work within your app boundaries
cd apps/YOUR_APP/                            # Stay in your app directory

# Deploy only your app
make backend-deploy-fast                     # Or admin-deploy, flutter-web-deploy

# When done, update workspace status
vim .claude/workspaces.md                    # Mark session as completed
```

For detailed coordination strategies, conflict resolution, and troubleshooting, see [`.claude/monorepo-branch-strategy.md`](.claude/monorepo-branch-strategy.md).

---

# Deployment Knowledge Base

**For comprehensive deployment documentation, see:** [`.claude/deployment-agent.md`](.claude/deployment-agent.md)

This agent document contains complete knowledge about deploying all components of the system, including:
- Infrastructure architecture and production URLs
- All deployment commands with detailed explanations
- Pre/post-deployment checklists and best practices
- Rollback procedures for all components
- Database operations and migrations
- Troubleshooting guide and security considerations
- Monitoring, logging, and cost optimization

# UI Responsiveness Guidelines
- **Avoid Fixed Page Heights on Mobile**: Never apply fixed height classes like `h-screen` or `h-full` to page panel container wrappers on mobile. Use `lg:h-full min-h-full` and set `overflow-y-auto lg:overflow-hidden` so page content expands and scrolls vertically on mobile viewports.
- **Responsive Heading Sizes**: For long section headers, use responsive text size classes (e.g., `!text-lg sm:!text-2xl`) to avoid text clipping on narrow mobile screens.
- **Adaptive Split Layouts**: Double-panel views (e.g., table list on the left, creation form on the right) must stack vertically on mobile using `flex flex-col lg:flex-row gap-6` and `w-full lg:w-96` on the form to avoid content squishing.

# Production Deployment Quick Reference

> **⚠️ READ FIRST**: [`docs/pre-deployment-checklist.md`](docs/pre-deployment-checklist.md)
> lists the migrations, one-time data backfills, and rebuild reminders that MUST be run
> before deploying (backend, admin, or POS).

**Note**: This is a quick reference. For detailed deployment procedures, troubleshooting, and rollback procedures, see [`.claude/deployment-agent.md`](.claude/deployment-agent.md).

Use the existing Makefile targets from the repository root. Prefer these commands over manually reconstructing `gcloud`, `firebase`, or Flutter build commands.

## Backend API (`apps/sync_api`)
- **Deploy Cloud Run**: `make backend-deploy-fast`
- **Check Cloud Run status/health**: `make backend-status`
- **View recent logs**: `make backend-logs`
- **Production service**: `pos-sync-api`
- **Project/region**: `fresh-sensor-497515-d3` / `us-central1`
- **Production API URL used by frontends**: `https://pos-sync-api-232144991863.us-central1.run.app/api`

## Production Database
- **Open Cloud SQL proxy for manual DB access**: `make db-proxy`
- **Run the general production migration target**: `make backend-migrate`
- **Important current caveat**: the full Drizzle migration runner can fail if production already has manually-created objects that are missing from Drizzle's migration journal, such as `admin_business_access`. For the multi-role users release, the safe production command was:
  `cloud-sql-proxy fresh-sensor-497515-d3:us-central1:pos-db-instance --port 5433 & PROXY_PID=$!; trap 'kill $PROXY_PID 2>/dev/null || true' EXIT; sleep 5; cd apps/sync_api && DATABASE_URL='postgresql://pos_user:pos-secure-db-pass-2026!@localhost:5433/pos_db' npx tsx scripts/alter-users-roles.ts`
- The `alter-users-roles.ts` script is idempotent: it ensures `users.roles` exists and backfills empty arrays from legacy `users.role`.

## Business Control Admin (`apps/business_control_tauri`)
- **Build and deploy Firebase Hosting**: `make admin-deploy`
- **Production URL**: `https://cacharelo-central.web.app`
- **Configured API URL at build time**: `VITE_API_URL=https://pos-sync-api-232144991863.us-central1.run.app/api`
- After deployment, verify with: `curl -I https://cacharelo-central.web.app`

## Flutter POS Web & Download Portal (`apps/pos_flutter`)
- **Build & Deploy Web POS Only**: `make flutter-web-deploy`
- **Build & Deploy Full Release (Portal + Android APK + Web POS + GCP Bucket)**: `make flutter-portal-deploy`
- **Production POS URL**: `https://cacharelo-pos.web.app`
- **Public Download Portal URL**: `https://cacharelo-pos.web.app/descargas.html` (PIN: `9876`)
- **Version Bump Checklist**:
  1. Increment version string in `apps/pos_flutter/pubspec.yaml` (e.g., `version: 1.0.1+2` ➔ `version: 1.0.2+3`).
  2. Run `make flutter-portal-deploy` to build the APK, update `descargas.html` assets, sync GCP Storage (`gs://cacharelo-pos-releases/`), and publish to Firebase Hosting.
- Native Android, macOS, and Windows builds are separate release artifacts; `flutter-portal-deploy` packages and publishes both Web and Android releases together.

## Deployment Hygiene
- Commit functional changes before deployment.
- Firebase deploys update tracked `.firebase/hosting.*.cache` metadata files; commit those metadata changes after successful deploy.
- Do not include unrelated untracked files in deployment commits.
- If a deploy command fails due to sandbox access to `gcloud`, `firebase`, Cloud SQL Proxy, or local credential files, rerun the same command with escalated permissions.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

### Project wiring

- The graph is built from code only (local tree-sitter AST, no API cost) and covers TS/TSX, Dart, SQL, Terraform, shell and JSON.
- Build it: `make graphify-build`. Refresh after code changes: `make graphify-update` (also runs from the installed git hooks).
- Query it: `make graphify-query Q="how does the POS checkout reach the API?"` or `graphify query "<question>"`.
- Architectural hubs: `make graphify-hubs`. Broad review: `graphify-out/GRAPH_REPORT.md`. Interactive view: open `graphify-out/graph.html`.
- CLI install/refresh: `uv tool install "graphifyy[sql,terraform,pdf,office,watch,leiden]" && uv tool update-shell`.
- The `/graphify` skill is installed for Claude (`.claude/skills`), Codex (`.codex/skills`), OpenCode (`.opencode/skills`) and generic agents (`.agents/skills`).
- Subagents dispatched via `scripts/agent-team.sh` must also be told to query the graph first (the rule above applies inside `.worktrees/` when `graphify-out/graph.json` exists there).

### Route before you search (skills · SOPs · make)

`make route Q="<task>"` is a deterministic router (no LLM, no tokens, <100ms) over:
- all Make targets and their help text,
- every skill in `.agents/skills` and `.claude/skills`,
- SOPs/runbooks in `docs/`, `knowledge/`, root `*.md` and `.claude/*.md`.

It prints the matching skill to load, the SOP to read, the exact `make` target, and a `graphify query` for the code path. Use it instead of reading the static navigation matrices first; fall back to `make help` / `docs/AGENT_NAVIGATION_GUIDE.md` only when it returns no match. Source: `scripts/agent-router.mjs`.

### Business flows (see + maintain)

`make flows` lists the flow catalog. `make flow Q="order to cash"` joins the flow doc to the live code graph: actors, endpoints, tables, business rules, screens and a call chain derived with `graphify path` (never hardcoded). `make flows-check` validates every anchor and runs inside `make check-all`.

Flow docs live in `knowledge/workflows/*.md`; their YAML frontmatter is the machine contract (`flow`, `actors`, `seeds`, `tables`, `rules`, `screens`, `endpoints`). To update or add a flow after a code change, load the **`maintain-business-flows`** skill (`.agents/skills/maintain-business-flows/SKILL.md`). Refresh the graph with `make graphify-update` before validating.
