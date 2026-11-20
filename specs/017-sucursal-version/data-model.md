# Data Model: Active Sucursal in App Version Badge

## Terminal Display Context

| Field | Source | Rules |
|---|---|---|
| Application version | Existing application state | Always displayed where the version area exists. |
| Sucursal display name | Existing terminal configuration in application state | Display only when non-empty after trimming whitespace. |

No new persisted entity, synchronization payload, API field, or database column is introduced.
