---
type: "architecture"
title: "Kitchen Display System (KDS) Architecture"
description: "Architecture of real-time kitchen and bar display routing, ticket emission, WebSocket broadcasting, and physical thermal ticket printing."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "kds"
  - "kitchen"
  - "thermal-printing"
  - "websockets"
  - "architecture"
sources:
  - "apps/sync_api/src/modules/kitchen/"
  - "docs/THERMAL_PRINTER_KNOWLEDGE_BASE.md"
  - "apps/sync_api/src/database/schema.ts"
---

# Kitchen Display System (KDS) Architecture

The **Kitchen Display System (KDS)** connects waitstaff entering orders on tables to the kitchen cooks and bar staff preparing food and beverages.

---

## 1. Preparation Routing Pipeline

```text
[Waiter adds items to Table] ──▶ "Enviar a Cocina"
                                       │
                  ┌────────────────────┴────────────────────┐
                  ▼                                         ▼
         Category `target_station`               Category `target_station`
               = 'cocina'                                = 'barra'
                  │                                         │
                  ▼                                         ▼
           [Cocina Ticket]                           [Barra Ticket]
       status: 'pending'                        status: 'pending'
                  │                                         │
      WebSocket: `ticket:new:cocina`            WebSocket: `ticket:new:barra`
```

1. **Station Resolution**: Category configuration defines `targetStation` (`cocina`, `barra`, or `null`).
2. **Atomic Dispatch**: When the order is sent to preparation, items are marked `is_sent = true`, and tickets are inserted into `kitchen_tickets`.
3. **Ticket Lifecycle**:
   - `pending`: Newly arrived ticket, audible chime triggers on screen.
   - `preparing`: Cook taps ticket to signify work has started (`started_at`).
   - `ready`: Preparation complete (`ready_at`), waiter is notified via tablet.
   - `served`: Runner delivers dish to table (`served_at`).

---

## 2. Thermal Printer Integration

In addition to digital screens, physical ticket printers provide redundant station receipts:
- Hardware print stations register heartbeats in `print_stations`.
- Outgoing print jobs are queued in `print_jobs` (`status = 'queued'`).
- Local agent daemons poll and format ESC/POS command sequences over USB/Ethernet raw sockets (port 9100).
- Detailed hardware escape codes and troubleshooting are documented in [Thermal Printer Knowledge Base](../../docs/THERMAL_PRINTER_KNOWLEDGE_BASE.md).
