---
type: "rule"
title: "Kitchen Display System (KDS) Routing Rules"
description: "Authoritative business rules for routing ordered items to kitchen and bar stations, handling untargeted categories, and transitional heuristics."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "kds"
  - "kitchen"
  - "tickets"
  - "routing"
  - "business-rules"
sources:
  - "apps/sync_api/src/modules/kitchen/repositories/kitchen.repository.ts"
  - "apps/sync_api/src/database/schema.ts"
---

# Kitchen Display System (KDS) Routing Rules

These rules determine how items in an active restaurant order are divided into preparation tickets for display screens in the kitchen and bar.

---

## Decision Table

| Category `target_station` | KDS Route | Ticket Emitted |
| :--- | :--- | :--- |
| `cocina` | Cocina Screen | Kitchen ticket (`station='cocina'`) |
| `barra` | Barra Screen | Bar ticket (`station='barra'`) |
| `null` or empty (`""`) | None | No KDS ticket emitted |
| Legacy / unknown | Heuristic fallback | Transitional name-based fallback (pending deprecation) |

---

## BR-KDS-001 — No station means no KDS routing

- **Statement**: A product whose category has `target_station` set to `null`, `"sin_estacion"`, or empty must not appear in or create any kitchen or bar KDS ticket.
- **Owner**: Food & Beverage Operations / Catalog Administration.
- **Authority**: `KitchenRepository.resolveTargetStation()`.
- **Examples**: Retail items or prepackaged goods (e.g., bottled sodas, bags of potato chips) categorized with no station are omitted when the order is sent to preparation.
- **Verification**: Order dispatch tests verifying that items from unassigned categories do not generate `kitchen_tickets` rows.

---

## BR-KDS-002 — Explicit station routes exactly once

- **Statement**: A category assigned to `cocina` routes strictly to Cocina; a category assigned to `barra` routes strictly to Barra. An order containing items for both stations generates exactly two independent tickets, with each item appearing solely on its designated station ticket.
- **Owner**: F&B Operations / Catalog Administration.
- **Authority**: `KitchenRepository` ticket generation and WebSocket station filtering.
- **Consequence**: Kitchen cooks only see food preparation items; bartenders only see beverage items. Neither station is cluttered with unrelated work.
- **Verification**: Multi-item order tests asserting station partitioning and isolation.

---

## BR-KDS-003 — Legacy routing heuristic is transitional

- **Statement**: Only categories with unrecognized historical values may use string-matching heuristics; explicitly configured categories must strictly adhere to the decision table.
- **Owner**: Engineering / Technical Operations.
- **Exit Criterion**: Deprecate and remove fallback heuristics once 100% of active categories are migrated to explicit `target_station` values (`cocina`, `barra`, or `null`).
