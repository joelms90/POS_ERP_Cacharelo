# Owner Copilot API Contract

All endpoints require the existing Bearer JWT and owner role. They never accept owner identity, administrative token, MCP credential, JWT secret, or model credential in the body.

| Endpoint | Purpose | Response highlights |
| --- | --- | --- |
| `POST /owner-copilot/chat` | Start or continue an owner-bound conversation | conversation, assistant message, tool activity, sources, optional proposal |
| `POST /owner-copilot/confirm` | Attempt to consume an explicit confirmation | no action if token is invalid, expired, consumed, or mismatched |

Automatic tools are only named typed reads: `get_stock_alerts`, `get_active_orders`, `get_requisitions`, `get_purchase_orders`, and `get_error_summary`. There is no generic endpoint tool and no `call_backend_api` surface in this API.
