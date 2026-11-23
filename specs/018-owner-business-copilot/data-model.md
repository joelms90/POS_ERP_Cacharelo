# Data Model

| Entity | Key fields | Rules |
| --- | --- | --- |
| Conversation | id, ownerUserId, businessId, branchId, correlationId, timestamps | Owner/business binding is immutable. |
| Message | id, conversationId, role, redactedContent, entityType, entityId | Content is redacted before persistence. |
| Tool run | id, conversationId, toolName, redactedInput, redactedOutput, source | Tool name must be in the read allowlist. |
| Confirmation | id, conversationId, ownerUserId, proposal, token hash, expiresAt, consumedAt, status | Token is one-time, expires, and cannot cross owner/business boundaries. |

Relationships: a conversation has messages, tool runs and confirmations. Business and branch references use the existing business domain identifiers.
