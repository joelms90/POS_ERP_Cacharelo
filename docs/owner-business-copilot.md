# Owner Business Copilot MVP

Copiloto is an owner-only administrative assistant. It is an optional connected reporting surface: it must never block sales, payments, kitchen work, inventory movement, or shifts in the POS.

## Local use

Run these in separate terminals after normal local dependencies and database setup:

```bash
make owner-copilot-backend
make owner-copilot-admin
```

By default the Copiloto uses its deterministic local provider. To opt in to Gemini locally, copy `apps/sync_api/.env.example` to `apps/sync_api/.env`, then set:

```dotenv
OWNER_COPILOT_PROVIDER=gemini
GEMINI_API_KEY=your-local-key
GEMINI_MODEL=gemini-2.5-flash
```

Keep this file outside Git. `make owner-copilot-backend` reads it in the backend process only and explicitly skips database migrations.

Open the admin dashboard, sign in with a real owner account, and select **Copiloto**. Run focused checks with:

```bash
make owner-copilot-test
```

The focused command runs the backend safety suite and the admin production type/build check. A mocked Playwright core-state test lives in `e2e/navigation.spec.ts`; run it only against an intentionally prepared local test environment because the legacy E2E server bootstrap attempts its own migrations. This feature adds an audit migration but does not run it. Do not deploy or run migrations as part of local verification.

## Security boundary

- Browser requests carry only the ordinary signed-in user session.
- The API derives the owner, business and branch scope from that authenticated user; it does not accept an owner identity from the browser.
- Automatic tool execution is a typed server-side read allowlist. The Copiloto API exposes no generic backend request mechanism.
- Any future write is a proposal first. It needs an opaque, short-lived, one-time confirmation token owned by the same user and business before a typed executor may run.
- Conversation, message, tool-run and confirmation records are redacted before storage and carry correlation identifiers.
- MCP credentials, administrative credentials, JWT secrets, provider keys, and model configuration never belong in browser variables, API payloads, responses, logs, or committed configuration.

## Production model provider

The MVP uses a deterministic local provider and needs no model key. Gemini is selected only when both `OWNER_COPILOT_PROVIDER=gemini` and `GEMINI_API_KEY` are set in the server process. The adapter uses Gemini only to classify a prompt into the server's tiny typed plan allowlist; it cannot call tools, see browser credentials, or bypass confirmations.

For production, create a dedicated Secret Manager secret such as `owner-copilot-gemini-api-key`, grant only the Cloud Run service account `secretAccessor`, and inject it as the `GEMINI_API_KEY` environment variable. Set `OWNER_COPILOT_PROVIDER=gemini` and `GEMINI_MODEL` as non-secret runtime configuration. Rotate the secret in Secret Manager, deploy a new revision, restrict the key in Google AI Studio, set billing/usage alerts, and never commit, log, return, or expose it through a `VITE_*` variable. This change does not create the secret, modify infrastructure, or deploy.

Existing MCP read-tool names are used only as vocabulary for the server-owned allowlist. The Copiloto does not call MCP, does not inherit MCP's service identity, and does not expose MCP tools to the browser.
