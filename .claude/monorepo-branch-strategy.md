# Monorepo Branch Strategy & Agent Workspace Isolation

**Version**: 1.0
**Last Updated**: 2026-07-18
**Purpose**: Prevent conflicts when multiple agents/terminals work on different apps in the monorepo

---

## Problem Statement

When multiple agents or terminals work on different apps in the monorepo simultaneously:
- **Terminal 1**: Works on `apps/sync_api/` (backend)
- **Terminal 2**: Works on `apps/pos_flutter/` (POS app)
- **Terminal 3**: Works on `apps/business_control_tauri/` (admin dashboard)

**Risks**:
1. Branch conflicts when both agents commit to the same branch
2. Merge conflicts in shared files (package.json, Makefile, etc.)
3. Deployment collisions (both deploying different components)
4. Lost work due to force pushes or rebases
5. Confusion about which agent owns which changes

---

## Monorepo Structure

```
POS-ERP/
├── .claude/                      # Shared agent knowledge base
├── .github/workflows/            # Shared CI/CD
├── apps/
│   ├── sync_api/                 # Backend (NestJS) - Independent
│   ├── business_control_tauri/   # Admin (React/Tauri) - Independent
│   ├── pos_flutter/              # POS (Flutter) - Independent
│   └── landing_page/             # Marketing site - Independent
├── specs/                        # Shared specifications
├── Makefile                      # SHARED - Potential conflict point
├── HANDOFF.md                    # SHARED - Potential conflict point
├── AGENTS.md                     # SHARED - Potential conflict point
└── README.md                     # SHARED - Potential conflict point
```

**Key Insight**: Each app is **mostly independent**, but **shared files** (Makefile, AGENTS.md, root docs) can cause conflicts.

---

## Branch Strategy Options

### Option 1: Feature-Based Branches (Current Approach)
**Pattern**: `NNN-feature-name` (e.g., `011-purchase-orders-requisitions`)

**Pros**:
- Clear feature ownership
- Easy to understand what the branch is for
- Works well for single-app features

**Cons**:
- Conflicts when feature touches multiple apps
- Doesn't indicate which app is the primary focus
- Harder to coordinate multi-agent work

### Option 2: App-Scoped Feature Branches (Recommended for Multi-Agent Work)
**Pattern**: `NNN-feature-name/app-name` (e.g., `011-purchase-orders/backend`, `011-purchase-orders/pos`)

**Pros**:
- Clear app ownership in branch name
- Multiple agents can work on same feature in parallel
- Easier to merge incrementally
- Reduces merge conflicts

**Cons**:
- More branches to manage
- Need coordination for shared file changes

### Option 3: Agent-Scoped Branches
**Pattern**: `agent-name/feature` (e.g., `codex/pos-flutter-fixes`, `atlas/backend-api`)

**Pros**:
- Clear ownership by agent/developer
- No confusion about who's working on what
- Easy to identify work in progress

**Cons**:
- Less clear about feature purpose
- Harder to track feature completion

---

## Recommended Strategy: Hybrid Approach

Use **app-scoped feature branches** when multiple apps are involved:

```bash
# Main feature branch (coordination branch)
011-purchase-orders-requisitions

# App-specific work branches
011-purchase-orders-requisitions/backend
011-purchase-orders-requisitions/pos
011-purchase-orders-requisitions/admin
```

**Workflow**:
1. Create main feature branch: `011-purchase-orders-requisitions`
2. Create app-scoped branches from main feature branch
3. Each agent works on their app-scoped branch
4. Merge app-scoped branches back to main feature branch incrementally
5. Merge main feature branch to `main` when complete

---

## Workspace Isolation Rules

### Rule 1: File Ownership by App

Each app has clear ownership boundaries:

| App | Primary Files | Can Touch |
|-----|---------------|-----------|
| `sync_api/` | `apps/sync_api/**/*` | Makefile (backend targets), specs/, migrations |
| `pos_flutter/` | `apps/pos_flutter/**/*` | Makefile (flutter targets), specs/ |
| `business_control_tauri/` | `apps/business_control_tauri/**/*` | Makefile (admin targets), specs/ |

### Rule 2: Shared File Modification Protocol

When modifying **shared files** (Makefile, AGENTS.md, HANDOFF.md):

1. **Check current state**:
   ```bash
   git status
   git diff Makefile AGENTS.md HANDOFF.md
   ```

2. **Pull latest changes**:
   ```bash
   git pull origin $(git branch --show-current)
   ```

3. **Make minimal changes**:
   - Only add/modify sections relevant to your app
   - Don't reformat or reorganize existing content
   - Add comments indicating your app scope

4. **Commit separately**:
   ```bash
   git add Makefile
   git commit -m "chore(backend): add new migration target to Makefile"
   ```

### Rule 3: Agent Workspace Declaration

Each agent should declare their workspace in a `.claude/workspaces.md` file:

```markdown
## Active Workspaces

### Agent: Codex (Terminal 1)
- **Branch**: `011-purchase-orders-requisitions/backend`
- **App**: `apps/sync_api/`
- **Start Date**: 2026-07-18
- **Focus**: Backend API for purchase orders
- **Shared Files**: Makefile (backend targets), specs/011-*/

### Agent: Atlas (Terminal 2)
- **Branch**: `011-purchase-orders-requisitions/pos`
- **App**: `apps/pos_flutter/`
- **Start Date**: 2026-07-18
- **Focus**: POS requisition creation UI
- **Shared Files**: specs/011-*/
```

---

## Conflict Prevention Checklist

Before starting work in a new terminal/agent session:

- [ ] **Check active workspaces**: Read `.claude/workspaces.md`
- [ ] **Verify branch**: Ensure you're on the correct app-scoped branch
- [ ] **Pull latest**: `git pull origin $(git branch --show-current)`
- [ ] **Check shared files**: `git status` to see if anyone modified Makefile, etc.
- [ ] **Declare workspace**: Update `.claude/workspaces.md` with your session

Before committing shared file changes:

- [ ] **Pull latest**: `git pull --rebase origin $(git branch --show-current)`
- [ ] **Review conflicts**: If conflicts, coordinate with other agents
- [ ] **Commit atomically**: Separate commits for each shared file
- [ ] **Push immediately**: Don't let shared file changes sit unpushed

Before merging branches:

- [ ] **Rebase on parent**: `git rebase origin/011-purchase-orders-requisitions`
- [ ] **Test locally**: Run tests and builds for your app
- [ ] **Check CI**: Ensure CI passes on your branch
- [ ] **Coordinate merge**: Announce in workspace file before merging

---

## Safe Workflow for Multi-Agent Development

### Scenario: Working on `apps/pos_flutter/` while another agent works on `apps/sync_api/`

**Setup Phase**:

1. **Terminal 1** (Backend Agent):
   ```bash
   git checkout 011-purchase-orders-requisitions
   git checkout -b 011-purchase-orders-requisitions/backend
   echo "Agent: Backend-Codex working on apps/sync_api/" >> .claude/workspaces.md
   git add .claude/workspaces.md
   git commit -m "chore: declare backend workspace"
   git push -u origin 011-purchase-orders-requisitions/backend
   ```

2. **Terminal 2** (POS Agent):
   ```bash
   git checkout 011-purchase-orders-requisitions
   git checkout -b 011-purchase-orders-requisitions/pos
   echo "Agent: POS-Atlas working on apps/pos_flutter/" >> .claude/workspaces.md
   git add .claude/workspaces.md
   git commit -m "chore: declare pos workspace"
   git push -u origin 011-purchase-orders-requisitions/pos
   ```

**Work Phase**:

1. **Each agent works independently** on their app directory
2. **Commit frequently** to their app-scoped branch
3. **Push regularly** to avoid lost work

**Shared File Modification** (e.g., adding Flutter deployment docs to AGENTS.md):

1. **POS Agent** (Terminal 2):
   ```bash
   # Pull latest from your branch
   git pull origin 011-purchase-orders-requisitions/pos

   # Edit AGENTS.md (add POS-specific section)
   echo "## POS Flutter Requisitions\n- New feature..." >> AGENTS.md

   # Commit separately
   git add AGENTS.md
   git commit -m "docs(pos): add requisition feature to AGENTS.md"

   # Push immediately
   git push origin 011-purchase-orders-requisitions/pos
   ```

2. **Backend Agent** (Terminal 1) - Later:
   ```bash
   # Before modifying AGENTS.md, merge latest changes from POS branch
   git fetch origin
   git merge origin/011-purchase-orders-requisitions/pos -- AGENTS.md

   # Or cherry-pick the specific commit
   git cherry-pick <commit-hash-from-pos-branch>

   # Now make your changes
   echo "## Backend API Purchase Orders\n- New endpoints..." >> AGENTS.md
   git add AGENTS.md
   git commit -m "docs(backend): add purchase order API to AGENTS.md"
   git push origin 011-purchase-orders-requisitions/backend
   ```

**Merge Phase**:

1. **Merge app-scoped branches to main feature branch** (one at a time):
   ```bash
   # Backend done first
   git checkout 011-purchase-orders-requisitions
   git merge 011-purchase-orders-requisitions/backend
   git push origin 011-purchase-orders-requisitions

   # POS done next
   git merge 011-purchase-orders-requisitions/pos
   git push origin 011-purchase-orders-requisitions
   ```

2. **Merge main feature branch to main**:
   ```bash
   git checkout main
   git merge 011-purchase-orders-requisitions
   git push origin main
   ```

---

## Deployment Coordination

When deploying from concurrent workspaces:

### Safe Deployment Pattern

**Backend Agent** (Terminal 1):
```bash
# Only deploy backend
make backend-deploy-fast
make backend-status

# Commit deployment metadata (backend-specific)
git add apps/sync_api/.deployment-metadata.json  # if exists
git commit -m "chore(backend): update deployment metadata"
```

**POS Agent** (Terminal 2):
```bash
# Only deploy POS web
make flutter-web-deploy

# Commit deployment metadata (POS-specific)
git add apps/pos_flutter/.firebase/hosting.YnVpbGQvd2Vi.cache
git commit -m "chore(pos): update hosting metadata"
```

**Coordination**: Deployments are **independent** as long as:
- Each agent deploys only their app
- Backend API changes are backwards-compatible
- Database migrations are coordinated (see below)

### Database Migration Coordination

**⚠️ CRITICAL**: Database migrations affect ALL apps.

**Rule**: Only **ONE** agent should run migrations at a time.

**Protocol**:
1. Declare intent in `.claude/workspaces.md`:
   ```markdown
   ### Backend Agent
   - **Migration Status**: Planning migration 0017_add_requisitions
   ```

2. Coordinate with other agents before running:
   ```bash
   # Backend agent announces
   echo "Running migration 0017 in 5 minutes..." >> .claude/workspaces.md
   git add .claude/workspaces.md && git commit -m "chore: announce migration" && git push

   # Wait for acknowledgment from other agents
   # (they should pull and check the file)

   # Then run migration
   make backend-migrate
   ```

3. Update workspace file after completion:
   ```markdown
   ### Backend Agent
   - **Migration Status**: ✅ Completed migration 0017_add_requisitions at 2026-07-18 14:30
   ```

---

## Git Configuration for Safety

Add these git aliases to prevent accidental overwrites:

```bash
# Add to ~/.gitconfig or run these commands:

git config --global alias.safe-push '!git pull --rebase && git push'
git config --global alias.safe-merge 'merge --no-ff'
git config --global alias.workspace 'log --graph --oneline --all --decorate -10'
```

Usage:
```bash
git safe-push  # Always pulls latest before pushing
git safe-merge branch-name  # Creates merge commit (preserves history)
git workspace  # Visualize all branches
```

---

## Emergency: Resolving Conflicts

If two agents accidentally work on the same branch:

### Scenario: Both agents committed to `011-purchase-orders-requisitions`

**Agent 1** (has local commits):
```bash
git fetch origin
git log origin/011-purchase-orders-requisitions..HEAD  # See your commits

# If Agent 2 pushed first, you'll have conflicts on push
git pull --rebase origin 011-purchase-orders-requisitions

# Resolve conflicts
# For each file:
git add <file>
git rebase --continue

# Or abort and try merge instead
git rebase --abort
git merge origin/011-purchase-orders-requisitions
```

**Better**: Create a recovery branch:
```bash
# Create backup of your work
git checkout -b 011-purchase-orders-requisitions/agent1-recovery

# Push your work
git push -u origin 011-purchase-orders-requisitions/agent1-recovery

# Go back to main branch and merge carefully
git checkout 011-purchase-orders-requisitions
git pull origin 011-purchase-orders-requisitions
git merge 011-purchase-orders-requisitions/agent1-recovery
```

---

## Workspace File Template

Create `.claude/workspaces.md` with this template:

```markdown
# Active Agent Workspaces

**Last Updated**: 2026-07-18 14:00

---

## Terminal 1: Backend Development
- **Agent**: Codex
- **Branch**: `011-purchase-orders-requisitions/backend`
- **App**: `apps/sync_api/`
- **Started**: 2026-07-18 10:00
- **Focus**: Purchase orders backend API
- **Shared Files Modified**:
  - Makefile (backend targets)
  - specs/011-purchase-orders-requisitions/
- **Migration Status**: Planning migration 0017
- **Next Deployment**: After migration complete

---

## Terminal 2: POS Development
- **Agent**: Atlas
- **Branch**: `011-purchase-orders-requisitions/pos`
- **App**: `apps/pos_flutter/`
- **Started**: 2026-07-18 11:00
- **Focus**: Requisition creation UI
- **Shared Files Modified**:
  - specs/011-purchase-orders-requisitions/
- **Dependencies**: Waiting for backend API completion
- **Next Deployment**: After backend deployed

---

## Terminal 3: Admin Dashboard
- **Agent**: Vega
- **Branch**: `011-purchase-orders-requisitions/admin`
- **App**: `apps/business_control_tauri/`
- **Started**: 2026-07-18 13:00
- **Focus**: Purchase order management UI
- **Shared Files Modified**: None yet
- **Next Deployment**: After backend + POS deployed

---

## Coordination Notes

- **Migration 0017**: Scheduled for 2026-07-18 15:00 (Backend agent owns this)
- **Deployment Order**: Backend → POS → Admin
- **Merge Plan**: Each app branch merges to main feature branch incrementally
```

---

## Best Practices Summary

### ✅ DO

- Create app-scoped branches for multi-agent work
- Declare your workspace in `.claude/workspaces.md`
- Pull before every work session
- Commit frequently to your branch
- Push regularly to avoid lost work
- Use atomic commits for shared files
- Coordinate migrations explicitly
- Deploy only your app
- Merge incrementally

### ❌ DON'T

- Work on the same branch simultaneously
- Modify shared files without checking workspace file
- Force push to shared branches
- Run migrations without coordination
- Deploy all apps at once from different terminals
- Rebase shared branches without communication
- Delete other agents' branches
- Merge without testing locally first

---

## Quick Reference Commands

```bash
# Before starting work
git pull origin $(git branch --show-current)
cat .claude/workspaces.md

# During work
git status  # Check what you're changing
git diff    # Review your changes

# Before committing shared files
git pull --rebase origin $(git branch --show-current)

# Before deploying
make backend-status  # Check if backend is already deploying
git log -1           # Verify you're on the right commit

# After deployment
git add apps/*/firebase/hosting.*.cache  # Only your app's metadata
git commit -m "chore(app): update deployment metadata"
```

---

## Conclusion

By following this strategy:
- **Multiple agents can work in parallel** without conflicts
- **Shared files are coordinated** through workspace declarations
- **Deployments are safe** and independent per app
- **Migrations are coordinated** to avoid race conditions
- **Merge conflicts are minimized** through app-scoped branches

**Key Principle**: **Declare your intent, communicate your changes, and work within your app boundaries.**
