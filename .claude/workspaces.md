# Active Development Workspaces

**Purpose**: Track which development sessions (terminals/developers/assistants) are working on which parts of the monorepo to prevent conflicts.

**Last Updated**: 2026-07-18 14:30

---

## Currently Active Sessions

### Session 1: Deployment & Infrastructure Documentation
- **Session Name**: `cacharelo-easy-deployments`
- **Developer/Terminal**: Control Center Terminal 1
- **Branch**: `011-purchase-orders-requisitions`
- **Primary Focus**: Deployment workflows and multi-session coordination documentation
- **Apps Touched**: None (documentation only)
- **Started**: 2026-07-18 14:00
- **Shared Files Modified**:
  - `.claude/deployment-agent.md` (created)
  - `.claude/README.md` (created)
  - `.claude/monorepo-branch-strategy.md` (created)
  - `.claude/workspaces.md` (created)
  - `AGENTS.md` (added coordination guidelines)
- **Status**: ✅ Active
- **Next Steps**: Await instructions for deployment workflow enhancements

---

## Planned/Future Sessions

### Session 2: POS Flutter Development (Planned)
- **Session Name**: TBD
- **Developer/Terminal**: TBD
- **Branch**: TBD (recommendation: `011-purchase-orders-requisitions/pos`)
- **Primary Focus**: Branch requisition creation UI in Flutter POS
- **Apps Touched**: `apps/pos_flutter/`
- **Dependencies**: Backend API completion
- **Shared Files**: `specs/011-purchase-orders-requisitions/`
- **Status**: 🔵 Planned

---

## Coordination Notes

### Current Feature: 011 Purchase Orders & Requisitions

**Overall Status**: In development

**Work Distribution**:
- Backend API (`apps/sync_api/`): Partially complete
  - Schema/migrations created ✅
  - Controllers/services scaffolded ✅
  - Repositories needed ⚠️
  - Integration tests needed ⚠️

- Admin Dashboard (`apps/business_control_tauri/`): Partially complete
  - Pages created ✅
  - API integration needed ⚠️
  - Testing needed ⚠️

- POS Flutter (`apps/pos_flutter/`): Not started
  - Local models needed ❌
  - UI screens needed ❌
  - Offline sync needed ❌

**Deployment Status**:
- Backend: Not deployed (waiting for completion)
- Admin: Not deployed (waiting for backend)
- POS: Not deployed (waiting for backend)

**Migration Status**:
- Migration 0016 created ✅
- Migration 0016 NOT applied to production ⚠️
- Next migration: TBD

---

## Guidelines for Adding New Sessions

When starting work in a new terminal or development session:

1. **Pull this file**:
   ```bash
   git pull origin $(git branch --show-current)
   cat .claude/workspaces.md
   ```

2. **Add your session** to the "Currently Active Sessions" section above

3. **Commit and push immediately**:
   ```bash
   git add .claude/workspaces.md
   git commit -m "chore: declare new workspace session"
   git push
   ```

4. **Update status** when you finish:
   - Move your session to "Completed Sessions" (create section if needed)
   - Update "Last Updated" timestamp

---

## Conflict Prevention Rules

### Rule 1: Check Before Starting
Always read this file before starting work in a new session.

### Rule 2: Declare Your Workspace
Add your session to this file immediately after starting.

### Rule 3: Respect App Boundaries
- If another session is working on an app, coordinate before touching it
- Use app-scoped branches when working in parallel

### Rule 4: Coordinate Shared Files
Before modifying shared files (Makefile, AGENTS.md, specs/), check if another session modified them.

### Rule 5: One Migration at a Time
Only one session should run production migrations. Declare intent here first.

---

## Quick Status Check

```bash
# See what branches exist
git branch -a

# See recent activity on all branches
git log --graph --oneline --all --decorate -10

# Check if your app's files were modified
git status apps/YOUR_APP/

# Pull latest workspace declarations
git pull origin $(git branch --show-current) -- .claude/workspaces.md
```

---

## Emergency: Resolving Workspace Conflicts

If you discover another session is working on the same files:

1. **Stop work immediately**
2. **Pull latest changes**:
   ```bash
   git stash  # Save your work
   git pull origin $(git branch --show-current)
   ```
3. **Check workspace file** to see who's working on what
4. **Coordinate**:
   - Option A: Create app-scoped branch and continue in parallel
   - Option B: Wait for other session to finish
   - Option C: Merge your work carefully with theirs
5. **Apply your stashed work**:
   ```bash
   git stash pop
   # Resolve any conflicts
   ```

For detailed conflict resolution, see [monorepo-branch-strategy.md](./monorepo-branch-strategy.md).
