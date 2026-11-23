# Research: Owner Business Copilot

## Decision: direct typed server adapters

The backend uses its authenticated request identity and invokes typed business read adapters directly. Existing MCP tools provide useful naming and intent vocabulary, but are not a runtime dependency.

**Rationale**: The MCP client currently creates a global static owner-like identity and includes a generic raw request mechanism. Neither is acceptable for browser-originated owner actions.

**Alternatives considered**: Calling the MCP server (rejected: identity ambiguity); generic API passthrough (rejected: bypasses allowlist); model-only generated data (rejected: no auditable source).

## Decision: deterministic local provider first

The MVP maps known Spanish prompts to safe read intents and presents an explicit proposal for write-like language.

**Rationale**: It is testable without a model key and keeps the provider boundary ready for a production implementation.

**Production configuration**: Configure the provider secret as a Cloud Run environment variable sourced from Secret Manager, for example `OWNER_COPILOT_PROVIDER_API_KEY`. Do not add a key to source control, browser build variables, MCP configuration, or logs.

## Decision: confirmation as a capability with expiry

An opaque one-time confirmation token binds owner, business, proposal and expiry. The write executor is deny-by-default until a concrete typed action is approved.

**Rationale**: A chat message cannot itself be authorization for a mutation.
