# Phase 0 Research: Purchase Orders & Inventory Requisitions

This document details the architectural decisions, rationale, and alternatives considered for the implementation of the Purchase Orders & Requisitions module.

---

## 1. Average Cost Recalculation Scope

### Decision
Average cost will be calculated **business-wide** and updated directly on the `products.cost` column.

### Rationale
- The existing codebase uses `products.cost` as the source of truth for ingredient costs, recipes, and margin calculations.
- Having location-specific average costs would require adding `cost` to `stock_levels` or creating a new `location_product_costs` table, which would break compatibility with the current simplified reporting structure.
- Business-wide average cost is standard for businesses with centralized procurement (e.g., central warehouse sourcing everything).

### Alternatives Considered
- **Per-location average cost**: Tracking different average costs for the same product at different warehouses or branches.
  - *Why rejected*: Increased query complexity for recipe cost calculations (requires location context) and lacks business justification at this stage.

---

## 2. Offline Requisition Synchronization

### Decision
Store branch requisitions in a new Isar collection `LocalBranchRequisition` and enqueue sync actions using the existing `SyncOperation` model.

### Rationale
- Requisitions are non-critical operational intents (unlike sales which directly affect cashier shifts and must be logged instantly).
- Placing them in `SyncOperation` ensures they are sent automatically once network connectivity is restored, following the exact same pipeline as offline sales.
- Using a separate Isar collection allows POS terminals to show a history of locally created requisitions even while offline.

### Alternatives Considered
- **Direct API calls only (blocking when offline)**:
  - *Why rejected*: Violates Constitution Principle I (Offline-First operation must be possible for moving inventory and requisitions).

---

## 3. Database Schema for Line Items

### Decision
Use standard normalized tables (`purchase_order_items` and `branch_requisition_items`) rather than JSONB arrays in the header tables.

### Rationale
- Allows simple indexing and joining for reporting (e.g., checking total quantity ordered of a specific product).
- Easier Drizzle migrations and type safety.
- Individual item state transitions (e.g., marking specific items as partially received or returned) are much cleaner with distinct rows.

### Alternatives Considered
- **JSONB arrays in header tables**:
  - *Why rejected*: Difficult to query, index, and write granular audits or updates (like updating single items during partial reception).
