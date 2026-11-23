# Tasks: Owner Business Copilot

## Phase 1: Setup

- [x] T001 Document feature scope and acceptance criteria in `specs/018-owner-business-copilot/spec.md`
- [x] T002 Document technical design, data model, API contract and local verification in `specs/018-owner-business-copilot/`

## Phase 2: Foundation

- [ ] T003 Add owner-bound module, persistence schema and unrun migration in `apps/sync_api/src/modules/owner-copilot/` and `apps/sync_api/migrations/`
- [ ] T004 [P] Add read-only MCP concept adapter metadata in `apps/mcp_server/src/owner-copilot-tools.ts`
- [ ] T005 Add local Make targets and secure operator documentation in `Makefile` and `docs/owner-business-copilot.md`

## Phase 3: User Story 1 - Safe owner consultation (P1)

**Goal**: Owners can ask safe business questions and inspect their sources.

**Independent Test**: Owner succeeds while non-owner is forbidden; unsupported prompts do not invoke a tool.

- [ ] T006 [P] [US1] Add owner authentication, read allowlist and deterministic provider tests in `apps/sync_api/src/modules/owner-copilot/*.spec.ts`
- [ ] T007 [US1] Implement authenticated read endpoints and direct typed adapters in `apps/sync_api/src/modules/owner-copilot/`
- [ ] T008 [P] [US1] Add Copiloto navigation, client contract and Spanish chat states in `apps/business_control_tauri/src/`
- [ ] T009 [US1] Add core UI state tests in `apps/business_control_tauri/src/pages/`

## Phase 4: User Story 2 - Explicit confirmation (P2)

- [ ] T010 [P] [US2] Test no-write-without-confirmation and token expiry in `apps/sync_api/src/modules/owner-copilot/*.spec.ts`
- [ ] T011 [US2] Implement proposal and one-time confirmation handling in `apps/sync_api/src/modules/owner-copilot/`
- [ ] T012 [US2] Render proposal, confirm and reject UI states in `apps/business_control_tauri/src/pages/CopilotPage.tsx`

## Phase 5: User Story 3 - Redacted audit trail (P3)

- [ ] T013 [P] [US3] Test redaction and audit correlation in `apps/sync_api/src/modules/owner-copilot/*.spec.ts`
- [ ] T014 [US3] Persist redacted conversation, message, tool-run and confirmation records in `apps/sync_api/src/modules/owner-copilot/`

## Phase 6: Polish

- [ ] T015 Run `make owner-copilot-test` and `make graphify-update`, then refresh feature task status in `specs/018-owner-business-copilot/tasks.md`
