# Active Task Tracker (TRACKER.md)

This table tracks active, upcoming, and blocked tasks. Update this table as tasks progress.

| Task ID / Description | Assigned To | Status | Last Updated | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **LLM Tracking Setup**<br>Add README, PLAN, TRACKER, prompts/, and logs/ | Antigravity | `#completed` | 2026-05-30 | Implemented workspace directory layout for AI-assisted workflows. |
| **T072**<br>Run Flutter analyzer and tests for `apps/pos_flutter` | Developer | `#completed` | 2026-06-06 | Initialized project, added the Empire Noir screens (Login, Waiter, Cashier, Kitchen), and verified widget tests pass. |
| **T074**<br>Run PostgreSQL migration validation for `apps/sync_api/migrations/` | Developer | `#completed` | 2026-06-06 | Configured Knex.js migration and seeding framework, validated locally against Postgres 15 Docker container. |
| **T075**<br>Validate quickstart end-to-end and record results | Developer | `#todo` | 2026-05-30 | Follow validation scripts in `quickstart.md` for cash transactions, print queues, and reconnect syncs. |
| **Architectural Review**<br>Review offline PIN caching & database encryption | Architect | `#completed` | 2026-06-06 | Security audit passed. Salted SHA-256 hash validation for PINs and secure DB key retrieval implemented. |
| **Waiter Screen Layout Fix**<br>Resolve layout constraint crashes | Antigravity | `#completed` | 2026-06-11 | Wrapped info sidebar in Expanded/SingleChildScrollView and added waiter_screen_test.dart. |
| **Waiter & Cashier Screens**<br>Design specs and planning documents | Antigravity | `#completed` | 2026-06-02 | Spec, Plan, Data Model, Research, and Tasks generated. |


---

## 💡 Notes on Status Tags
- `#todo`: Task is on the backlog, ready to be picked up.
- `#in-progress`: Work is currently underway.
- `#blocked`: Blocked by a dependency or design decision.
- `#waiting-for-llm`: LLM has been given prompt and developer is waiting for generated output.
- `#completed`: Done and verified.
