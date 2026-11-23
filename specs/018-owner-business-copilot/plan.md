# Implementation Plan: Owner Business Copilot

**Branch**: `feat/owner-business-copilot` | **Date**: 2026-11-22 | **Spec**: [spec.md](spec.md)

## Summary

Add a secure owner-only Spanish Copiloto page backed by an authenticated NestJS module. The server owns identity, tool policy, model-provider configuration, redaction, audit, and confirmation state. The first provider is deterministic and invokes only typed read adapters inspired by existing MCP concepts; it does not call MCP, mint a static owner identity, or expose a generic endpoint passthrough.

## Technical Context

**Language/Version**: TypeScript; React/Vite administrative client and NestJS API.  
**Primary Dependencies**: Existing JWT/role guards, Drizzle/PostgreSQL, React Query and Tailwind UI.  
**Storage**: New auditable PostgreSQL records with a migration supplied but never run by this delivery.  
**Testing**: Existing backend Jest suite, admin Vitest/React tests, and deterministic fixture harness.  
**Target Platform**: Connected administrative web/desktop dashboard and API.  
**Project Type**: Web administration + cloud API.  
**Performance Goals**: A deterministic safe-read response returns promptly in a local development session; audit creation does not require a browser secret.  
**Constraints**: Owner identity comes from the caller JWT; automatic calls are typed reads only; writes require one-time expiring confirmation; no MCP/admin/JWT/model secret crosses the browser boundary; no generic backend passthrough.  
**Scale/Scope**: MVP read intents (inventory alerts, open orders, requisitions, purchase orders and business diagnostics) plus proposal/confirmation safety plumbing.

## Constitution Check

- **Offline continuity**: PASS. This is a non-critical owner reporting tool and does not gate POS sales, payment, kitchen, inventory movement, or shifts.
- **Local authority**: PASS. No POS operation is created or completed through Copiloto.
- **Sync contract**: PASS. The feature creates server-side audit records only; it does not produce client synchronization operations.
- **Cloud role**: PASS with documented limitation. Copiloto is optional connected administration; its unavailability does not block restaurant operation.
- **Verification**: PASS. Authorization, confirmation, redaction, allowlist, provider fixture, and UI-state tests are required.

## Research

See [research.md](research.md). The module must use a server-side provider abstraction and direct typed service adapters, not an MCP client or generic request escape hatch.

## Project Structure

```text
apps/
├── sync_api/src/modules/owner-copilot/     # auth, policy, provider, audit, controller
├── sync_api/migrations/                    # unrun audit persistence migration
├── business_control_tauri/src/pages/       # Copiloto UI
├── business_control_tauri/src/services/    # authenticated API client
└── mcp_server/src/owner-copilot-tools.ts   # read-only tool concept metadata
specs/018-owner-business-copilot/
└── contracts/owner-copilot-api.md
```

**Structure Decision**: Keep browser code limited to ordinary authenticated API requests and presentation. Keep all identity binding, provider selection, tool execution, redaction, audit, and confirmations in `apps/sync_api`.

## Complexity Tracking

No constitution violations. The audit migration is necessary for the required accountable history and is not executed by this work.
