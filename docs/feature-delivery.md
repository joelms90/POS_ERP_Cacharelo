# Feature delivery workflow

Use one integration branch per feature and one isolated agent branch per app.

| Purpose | Name pattern | Example |
| --- | --- | --- |
| Integration and review | `feat/<feature>` | `feat/sucursal-version` |
| Backend agent | `work/<feature>/backend` | `work/sucursal-version/backend` |
| Admin agent | `work/<feature>/admin` | `work/sucursal-version/admin` |
| POS agent | `work/<feature>/pos` | `work/sucursal-version/pos` |

The names deliberately differ. A branch named `sucursal-version` prevents Git from creating `sucursal-version/pos`.

## Typical POS-only feature

```bash
make feature-start FEATURE=sucursal-version APPS=pos
# Declare the session in .claude/workspaces.md and push that declaration.
# Dispatch the POS agent in .worktrees/pos.
make feature-check APPS=pos
make feature-finish FEATURE=sucursal-version APPS=pos
git push origin feat/sucursal-version
# Review, then deploy explicitly if approved:
make flutter-web-deploy
```

`feature-finish` requires each selected agent worktree to be clean, then merges its branch into the integration branch. It deliberately does not push, deploy, or remove worktrees. This keeps review and production changes under your control.

For a full-stack feature, use `APPS=backend,admin,pos`; run the migration procedure only after the backend contract and migration are reviewed. See `AGENTS.md` for the migration lock protocol.
