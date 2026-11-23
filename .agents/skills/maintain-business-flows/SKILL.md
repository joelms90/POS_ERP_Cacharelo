---
name: maintain-business-flows
description: Update, add, or validate Cacharelo business flows (knowledge/workflows/*.md) and their code anchors. Use when a flow's code changed, `make flows-check` fails, a controller/service/table/rule/screen was renamed, or a new feature crosses POS → API → DB → Admin.
---

# Maintain business flows

Business flows are the bridge between intent and code:

- **Prose:** `knowledge/workflows/<flow>.md` (actors, ordered steps, rules).
- **Anchors:** YAML frontmatter (`flow`, `actors`, `seeds`, `tables`, `rules`, `screens`, `endpoints`).
- **Code chain:** derived live from `graphify-out/graph.json` — never hardcode it.

## When to use

- `make flows-check` fails.
- A controller/service/table/rule/screen named by a flow was renamed, moved, or deleted.
- You add a feature that crosses POS → API → DB → Admin.
- `graphify affected "<Symbol>"` shows a symbol used by a flow changed.

## Workflow

1. **Orient:** `make flows` (list), `make flow Q="order to cash"` (one flow), `make flows-check` (validate all).
2. **Refresh the graph if stale:** `make graphify-update` (or `make graphify-build` if `graphify-out/graph.json` is missing).
3. **Fix each failure by cause:**
   - symbol renamed → update the matching entry in `seeds`
   - business step changed → update the numbered prose steps
   - screen moved → update the `screens` path
   - rule renamed/removed → update `rules` (and the matching file in `knowledge/business-rules/`)
   - table renamed → update `tables` and `INVENTORY_ARCHITECTURE.md`
   - endpoint route changed → update `endpoints` (the `@Controller('<route>')` value)
4. **Find impacted flows:** `graphify affected "<Symbol>" --depth 2`, then map the symbols to each flow's `seeds`.
5. **Do not add a call chain to the doc.** `make flow` computes it with `graphify path`; a hardcoded chain will drift.
6. **Re-run** `make flows-check`, and `make graphify-update` after any code change.
7. **Record real decisions:** append to `knowledge/log.md` and note it in `HANDOFF.md` when behavior intentionally changed.

## Adding a new flow

1. Copy an existing doc in `knowledge/workflows/` and set a unique `flow` id.
2. Fill `actors`, `seeds` (keep 3–7 entrypoint/terminal symbols), `tables`, `rules`, `screens`, `endpoints`.
3. Write the ordered prose steps and link the relevant BR rules.
4. Add a row to `knowledge/workflows/index.md`.
5. Verify with `make flows-check` and `make flow Q="<new flow>"`.

## What `make flows-check` validates

| Field | Validated against |
| --- | --- |
| `seeds` | node labels in `graphify-out/graph.json` |
| `tables` | `pgTable('...')` in `apps/sync_api/src/database/schema.ts` |
| `rules` | `BR-*` headings in `knowledge/business-rules/` |
| `screens` | file existence |
| `endpoints` | `@Controller('...')` in `apps/sync_api/src/modules` |
| `sop` | the workflow doc itself |

It also warns when the committed graph is older than `HEAD` or `graphify-out/needs_update` exists.

## Exit criteria

- `make flows-check` passes.
- Graph rebuilt after code changes (`make graphify-update`).
- Prose steps and frontmatter anchors agree; no hardcoded call chain added.
