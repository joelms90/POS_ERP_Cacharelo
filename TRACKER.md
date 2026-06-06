# Active Task Tracker (TRACKER.md)

This table tracks active, upcoming, and blocked tasks. Update this table as tasks progress.

| Task ID / Description | Assigned To | Status | Last Updated | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **LLM Tracking Setup**<br>Add README, PLAN, TRACKER, prompts/, and logs/ | Antigravity | `#completed` | 2026-05-30 | Implemented workspace directory layout for AI-assisted workflows. |
| **T072**<br>Run Flutter analyzer and tests for `apps/pos_flutter` | Developer | `#completed` | 2026-06-06 | Initialized project, added the Empire Noir screens (Login, Waiter, Cashier, Kitchen), and verified widget tests pass. |
| **T074**<br>Run PostgreSQL migration validation for `apps/sync_api/migrations/` | Developer | `#todo` | 2026-05-30 | Spin up local Postgres container to run and verify baseline migrations syntax. |
| **T075**<br>Validate quickstart end-to-end and record results | Developer | `#todo` | 2026-05-30 | Follow validation scripts in `quickstart.md` for cash transactions, print queues, and reconnect syncs. |
| **Architectural Review**<br>Review offline PIN caching & database encryption | Architect | `#blocked` | 2026-05-30 | Blocked by security audit. Need to approve the caching mechanism for user PIN hashes. |
| **Waiter & Cashier Screens**<br>Design specs and planning documents | Antigravity | `#completed` | 2026-06-02 | Spec, Plan, Data Model, Research, and Tasks generated. |


---

## 💡 Notes on Status Tags
- `#todo`: Task is on the backlog, ready to be picked up.
- `#in-progress`: Work is currently underway.
- `#blocked`: Blocked by a dependency or design decision.
- `#waiting-for-llm`: LLM has been given prompt and developer is waiting for generated output.
- `#completed`: Done and verified.
