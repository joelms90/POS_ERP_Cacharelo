# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Flutter/Dart client, AWS Lambda runtime, SQL/Postgres migrations or NEEDS CLARIFICATION]

**Primary Dependencies**: [e.g., Flutter, Isar Database, AWS Lambda SDK, Postgres client or NEEDS CLARIFICATION]

**Storage**: [local Isar entities, sync queue, Postgres tables/migrations, or N/A]

**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]

**Target Platform**: [e.g., Flutter mobile/desktop POS, AWS Lambda, Postgres or NEEDS CLARIFICATION]

**Project Type**: [e.g., mobile POS + cloud API, backend sync service, reporting tool or NEEDS CLARIFICATION]

**Performance Goals**: [domain-specific, e.g., complete sale locally in <2s, sync pending queue without UI blocking or NEEDS CLARIFICATION]

**Constraints**: [offline-first, local Isar write before success, idempotent cloud sync, no network dependency for critical POS flows or NEEDS CLARIFICATION]

**Scale/Scope**: [number of devices/registers, restaurants, daily orders, pending offline operations or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Offline continuity**: Critical flows for sales, payments, orders, inventory and shift
  closing can complete without internet; any exception is documented with approval.
- **Local authority**: User-facing success is backed by an Isar write, not by a remote
  response; synchronized entities include stable IDs, versions, timestamps and sync state.
- **Sync contract**: The plan defines operation direction, idempotency keys, retry behavior,
  conflict rules, deduplication and audit requirements.
- **Cloud role**: AWS Lambda/Postgres changes coordinate and consolidate data without becoming
  a point of failure for local operation; migrations handle clients with pending local data.
- **Verification**: Tests cover offline execution, reconnection, retries, idempotency and
  recovery for queues/conflicts when the feature touches operational data.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
