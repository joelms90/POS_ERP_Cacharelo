# Owner Business Copilot MVP

Copiloto is an owner-only administrative assistant. It is an optional connected reporting surface: it must never block sales, payments, kitchen work, inventory movement, or shifts in the POS.

## Local use

Run these in separate terminals after normal local dependencies and database setup:

```bash
make owner-copilot-backend
make owner-copilot-admin
```

Open the admin dashboard, sign in with a real owner account, and select **Copiloto**. Run focused checks with:

```bash
make owner-copilot-test
```

This feature adds an audit migration but does not run it. Do not deploy or run migrations as part of local verification.

## Security boundary

- Browser requests carry only the ordinary signed-in user session.
- The API derives the owner, business and branch scope from that authenticated user; it does not accept an owner identity from the browser.
- Automatic tool execution is a typed server-side read allowlist. The Copiloto API exposes no generic backend request mechanism.
- Any future write is a proposal first. It needs an opaque, short-lived, one-time confirmation token owned by the same user and business before a typed executor may run.
- Conversation, message, tool-run and confirmation records are redacted before storage and carry correlation identifiers.
- MCP credentials, administrative credentials, JWT secrets, provider keys, and model configuration never belong in browser variables, API payloads, responses, logs, or committed configuration.

## Production model provider

The MVP uses a deterministic local provider and needs no model key. A production provider implementation must read `OWNER_COPILOT_PROVIDER_API_KEY` from a Secret Manager-backed server environment variable. Never commit its value or prefix it with `VITE_`.

Existing MCP read-tool names are used only as vocabulary for the server-owned allowlist. The Copiloto does not call MCP, does not inherit MCP's service identity, and does not expose MCP tools to the browser.
