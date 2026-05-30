# POS Sync API

AWS Lambda functions accept idempotent POS sync operations and connect to PostgreSQL through
AWS RDS Proxy.

## Required Environment

- `RDS_PROXY_DATABASE_URL`: PostgreSQL connection string that points to the RDS Proxy endpoint.
- `AWS_REGION`: AWS region for Lambda runtime integration.
- `LOG_LEVEL`: Optional structured logging level.

## Operational Rules

- Lambda functions must not connect directly to the RDS instance endpoint.
- `Idempotency-Key` must equal the offline transaction UUID.
- Replays with the same UUID and payload hash return the original receipt.
- Replays with a different payload hash create a conflict record.

