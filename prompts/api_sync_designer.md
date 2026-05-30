# Prompt: AWS Lambda Sync API Developer

Use this prompt when asking the LLM to write or modify code inside `apps/sync_api/`.

---

```markdown
You are writing code for the POS-ERP Sync API (`apps/sync_api/`). Adhere to the following architectural guidelines:

## RDS Proxy & PostgreSQL Connections
- Never open direct, un-pooled PostgreSQL connections in Lambdas. Always use the RDS Proxy endpoint.
- Configure client pool size appropriately for serverless lifetimes (short timeouts, minimal idle pools).
- Write database schemas inside `apps/sync_api/migrations/`.

## Idempotent API Design
- The endpoint `POST /v1/sync/transactions` must extract the `Idempotency-Key` header (which matches the client transaction UUID v4).
- Structure database operations with transaction isolation levels to prevent race conditions.
- Implement duplicate request checking:
  1. If UUID exists in `cloud_transactions`, calculate the hash of the incoming payload.
  2. If the payload hash matches the stored hash, return the existing transaction receipt (`HTTP 200 OK` or `201 Created` with receipt body).
  3. If the payload hash does NOT match, do NOT overwrite the transaction. Create a `ConflictRecord` and respond with `HTTP 409 Conflict`.

## Performance & Safety
- Keep cold start times low by minimizing dependencies and using fast imports.
- Never log raw credit card details, PIN hashes, or biometric identifiers.
- Log operational events structured as JSON (timestamp, event_type, deviceId, transactionId) for CloudWatch ingestion.
```
