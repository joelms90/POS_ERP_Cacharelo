# KDS Routing Rules

## Decision table

| Category `target_station` | KDS route |
|---|---|
| `cocina` | Cocina |
| `barra` | Barra |
| `null` or empty | No KDS ticket |
| Unknown legacy value | Existing name-based fallback; remove after catalogue data is normalized |

## BR-KDS-001 — No station means no KDS routing

- **Statement:** A category whose `target_station` is `null` or empty must not
  appear in, or create, a Cocina or Barra KDS ticket.
- **Owner:** Operations / catalogue administration.
- **Authority:** Backend KDS routing.
- **Examples:** Category “Sams” is saved with “Sin estación”. A new order that
  contains a Sams product creates no KDS item for that product.
- **Implementation:**
  `apps/sync_api/src/modules/kitchen/repositories/kitchen.repository.ts`,
  `resolveTargetStation()`.
- **Verification:** Add a repository/integration scenario before changing this
  decision again.

## BR-KDS-002 — Explicit station routes exactly once

- **Statement:** A category explicitly assigned to Cocina routes only to
  Cocina; one explicitly assigned to Barra routes only to Barra.
- **Owner:** Operations / catalogue administration.
- **Authority:** Backend KDS routing.
- **Implementation:** `resolveTargetStation()` and the station-specific ticket
  creation/filtering in `KitchenRepository`.
- **Verification:** An order containing one Cocina item and one Barra item
  produces one ticket per required station, with each item shown only in its
  matching ticket.

## BR-KDS-003 — Legacy routing is transitional

- **Statement:** Only categories with an unknown legacy station value may use
  the historical name-based route heuristic; explicitly configured categories
  never do.
- **Owner:** Engineering, until catalogue normalization is complete.
- **Exit criterion:** Remove the fallback after every active category has an
  explicit KDS station or an explicit no-station value.

## Workflow: send order to preparation

The workflow finds unsent order items, resolves each item’s station using the
decision table, creates only the required station tickets, marks the items as
sent, and notifies clients. This workflow is not itself a business rule; it is
the process that applies the rules above.
