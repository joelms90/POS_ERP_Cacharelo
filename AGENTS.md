<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read:
specs/011-purchase-orders-requisitions/plan.md
<!-- SPECKIT END -->

# Multi-Session Workspace Coordination

**⚠️ IMPORTANT: Read this BEFORE starting any work in this monorepo!**

This is a **monorepo** with multiple independent apps. Multiple development sessions (different terminals, developers, AI assistants, or team members) can work simultaneously on different apps **without conflicts** if you follow the workspace coordination protocol.

## Quick Start: Before You Begin

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

## Essential Documentation

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [`.claude/workspaces.md`](.claude/workspaces.md) | **Active workspace tracking** | **ALWAYS read FIRST** before starting work |
| [`.claude/monorepo-branch-strategy.md`](.claude/monorepo-branch-strategy.md) | **Multi-session coordination guide** | When working in parallel with other sessions |
| [`.claude/deployment-agent.md`](.claude/deployment-agent.md) | **Deployment operations manual** | When deploying any component |
| [`.claude/README.md`](.claude/README.md) | **Directory index** | Quick navigation to all docs |

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
