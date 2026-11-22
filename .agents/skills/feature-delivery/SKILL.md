---
name: "feature-delivery"
description: "Plan, parallelize, verify, merge, and hand off a POS-ERP feature across isolated app worktrees. Use for new feature delivery, not a small single-file fix."
metadata:
  author: "empire-pos-erp"
---

# Feature Delivery

Use this workflow for a feature that needs coordination across more than one task or app. Keep the integration branch separate from agent branches:

- Integration branch: `feat/<feature>` — the only branch reviewed, deployed, or proposed for merge.
- Agent branches: `work/<feature>/<app>` — disposable isolated worktrees for `backend`, `admin`, or `pos`.

This naming is required because Git cannot create `name/app` when a branch named exactly `name` already exists.

## Start

1. Read `.claude/workspaces.md`; do not overlap an active app scope.
2. Create or update the feature specification, plan, and task list under `specs/<feature>/` when the change is substantial.
3. Start only the apps needed by the feature:

   ```bash
   make feature-start FEATURE=<feature> APPS=backend,admin,pos
   ```

   For a POS-only feature use `APPS=pos`. The command creates or switches to `feat/<feature>` and creates `work/<feature>/<app>` worktrees. It refuses tracked local changes and a worktree already assigned to a different feature.

4. Declare the session in `.claude/workspaces.md`, commit and push the declaration. State scope, integration branch, selected apps, and migration state.
5. Dispatch agents with an exact contract: app path, API/data contract if relevant, acceptance criteria, tests, and explicit non-goals. Do not dispatch an agent to an unselected app.

## Verify and merge

1. Each agent commits only its app changes to its own `work/<feature>/<app>` branch.
2. Run selected quality gates:

   ```bash
   make feature-check APPS=pos
   ```

3. From `feat/<feature>`, merge only selected branches. Each agent worktree must be clean and committed first:

   ```bash
   make feature-finish FEATURE=<feature> APPS=pos
   ```

   This checks the selected apps and creates non-fast-forward merge commits. It does not deploy, push, or delete worktrees.

4. Review the integrated diff. Run any cross-app or E2E checks that the feature needs. For database changes, follow the migration lock protocol in `AGENTS.md`; do not run migrations in parallel.
5. Commit shared docs or workspace completion, push `feat/<feature>`, and deploy explicitly using the app-specific Make target.
6. Mark the workspace completed. Run `make team-clean` only after confirming no other active feature uses `.worktrees/`.

## Guardrails

- Never deploy directly from `work/<feature>/<app>`.
- Do not merge a branch that has not passed its selected app check.
- Do not use `make check-all` for a single-app feature unless cross-app verification is actually required.
- Untracked user files are not automatically staged by the lifecycle commands.
