# Feature Specification: Control Inteligente de Inventario por Sucursal

**Feature Branch**: `012-intelligent-inventory-control`

**Created**: 2026-08-05

**Status**: Draft — Pending review and validation

**Input**: User description: "Improve control of inventory between sucursales in a Business. As an owner I need to easily know when a sucursal needs to ask for more inventory using max and minimos per branch, not just globally. I want a dashboard where I can see when a sucursal has reached minimos with alerts, and the ability to generate automatic requisitions from alerts. Also when global inventory decreases to minimum, generate purchase orders automatically. Merma is out of scope for now."

## Vision & Goal

Currently, inventory control operates at a global level within a business: products have a single `minStock` and `maxStock`, stock levels are aggregated across all branches and warehouses for display, and the only "alert" is a red CSS pulse on the inventory table. Branch managers must manually decide when to create requisitions, and owners/admins must manually create purchase orders.

The goal of this feature is to evolve inventory control from **manual-reactive** to **intelligent-proactive** by:

1. **Per-branch stock thresholds** — Each branch (sucursal) can define its own `minStock` and `maxStock` per product, reflecting real local demand and storage capacity. Falls back to global product thresholds when not set per-branch.

2. **Automated low-stock alerts** — The system automatically detects when any branch's stock drops below its minimum threshold and generates persistent alerts visible on a dedicated dashboard. No more scanning spreadsheets or remembering to check.

3. **Alert Dashboard** — A single pane of glass (`Panel de Inventario`) where owners and inventory admins can see the health of all branches at a glance: critical (out of stock), low stock, and healthy counts. Filterable by branch and product. Quick-action buttons to resolve alerts.

4. **Auto-generated requisitions** — From an alert, the user can one-click generate a branch requisition to replenish stock from the warehouse up to the branch's `maxStock`. The requisition enters the existing approval workflow. Optionally, the system can auto-create requisitions without human intervention.

5. **Auto-generated purchase orders** — When global stock (sum across all locations) of a product drops below its `products.minStock`, the system auto-creates a `draft` purchase order for manual review before sending to the provider.

**Out of scope for this spec**: merma (shrinkage/waste), demand forecasting, seasonal adjustments, automatic PO sending without review.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Per-Branch Stock Thresholds (Priority: P1)

Inventory administrators and owners can set minimum and maximum stock levels per product per branch. When no branch-level threshold is defined, the global `products.minStock` and `products.maxStock` serve as the fallback.

**Why this priority**: Foundational. Without per-branch thresholds, the alert engine cannot determine what "low stock" means for a specific branch. All subsequent stories depend on this.

**Independent Test**: Set a per-branch `minStock` for a product at Sucursal A and a different one at Sucursal B. Verify that each branch uses its own threshold, and a branch with no override falls back to the global product threshold.

**Acceptance Scenarios**:

1. **Given** a product with `minStock=20` globally and no branch thresholds, **When** viewing stock thresholds for Sucursal A, **Then** the effective `minStock` for that product at Sucursal A is `20`.
2. **Given** an admin sets `minStock=10` for Product X at Sucursal A, **When** the branch threshold is saved, **Then** Product X at Sucursal A now has effective `minStock=10`, while Sucursal B continues using the global default `20`.
3. **Given** a branch threshold exists for a product, **When** the admin clears/resets it, **Then** the system falls back to the global product threshold.

---

### User Story 2 — Low-Stock Alert Engine (Priority: P1)

The system automatically monitors stock levels at all branches and generates alerts when a product's stock at a branch drops below its effective minimum threshold.

**Why this priority**: Core value proposition. Without automatic detection, users still need to manually scan inventory tables branch by branch. Alerts are the "proactive" in intelligent-proactive.

**Independent Test**: Simulate a stock decrease at a branch so it falls below `minStock`. Verify an alert record is created with the correct product, branch, threshold, and current quantity.

**Acceptance Scenarios**:

1. **Given** Sucursal A has Product X with effective `minStock=10` and current stock `12`, **When** a sale or transfer reduces stock to `8`, **Then** the system creates an alert with `alertType='low_stock'`, `threshold=10`, `currentQty=8`, and `status='active'`.
2. **Given** an active `low_stock` alert already exists for Product X at Sucursal A, **When** another sale reduces stock further to `5`, **Then** the system updates the existing alert's `currentQty` to `5` instead of creating a duplicate.
3. **Given** Sucursal A has Product X with current stock `0`, **When** the alert engine runs, **Then** the system creates an alert with `alertType='out_of_stock'` and `currentQty=0`.
4. **Given** an active alert exists and a stock receipt or transfer brings stock above `minStock` again, **When** the alert engine detects the stock increase, **Then** the alert status transitions to `resolved` with `resolvedAt` timestamp.
5. **Given** the alert engine runs, **When** multiple products at multiple branches are below their minimums, **Then** the system creates/updates an alert for each affected product-branch pair, all in a single operation for efficiency.

---

### User Story 3 — Alert Dashboard / Panel de Inventario (Priority: P2)

Owners and inventory admins access a new dashboard page (`Panel de Inventario`) that provides a bird's-eye view of inventory health across all branches, with active alerts, summary statistics, and quick-action buttons.

**Why this priority**: The UI that delivers value from the alert engine. Users need to see and act on alerts. Without the dashboard, alerts are invisible.

**Independent Test**: Open the Panel de Inventario with pre-existing alerts. Verify the summary counters (critical, low, healthy) are correct, alerts are listed with all relevant data, and filtering by branch works.

**Acceptance Scenarios**:

1. **Given** the user navigates to `Panel de Inventario`, **When** the page loads, **Then** the user sees summary cards: total products in critical state (`stock=0`), products below minimum, and products healthy (at or above minimum), all filterable by branch.
2. **Given** active alerts exist for multiple branches, **When** the user selects a specific branch from the branch filter, **Then** the alert list and summary counters update to show only alerts for that branch.
3. **Given** an alert row for Product X at Sucursal A showing `currentQty=5` and `minStock=10`, **When** the user clicks "Generar Requisición", **Then** a requisition is pre-filled with Product X, quantity = `maxStock - currentQty`, source = main warehouse, destination = Sucursal A.
4. **Given** an alert has been acknowledged or resolved, **When** viewing the dashboard, **Then** the alert appears with its current status badge (active/acknowledged/resolved) and resolved alerts can be hidden via a toggle.

---

### User Story 4 — Auto-Generated Requisitions from Alerts (Priority: P2)

From the alert dashboard, users can generate a branch requisition in one click. The requisition pre-fills the product, quantity (replenish to `maxStock`), source warehouse, and destination branch. Optionally, the system can auto-create requisitions when alerts are generated, without human intervention.

**Why this priority**: Bridges the gap between "seeing a problem" and "solving it." Reduces the workflow from 5+ manual steps to 1 click, or zero with auto-generation.

**Independent Test**: Trigger an alert for Product X at Sucursal A. Use the "Generar Requisición" button. Verify a branch requisition is created in `pending_approval` status with the correct items, quantities, and source/destination.

**Acceptance Scenarios**:

1. **Given** an active alert for Product X at Sucursal A with `currentQty=5`, `minStock=10`, `maxStock=30`, **When** the user clicks "Generar Requisición", **Then** the system creates a `branchRequisitions` record with `fromBranchId=Sucursal A`, `toWarehouseId=Main`, `status='pending_approval'`, and a requisition item with `quantityRequested=25` (maxStock - currentQty).
2. **Given** auto-requisition generation is enabled (business-level setting), **When** an alert is created for a product-branch pair, **Then** the system automatically creates a branch requisition without user intervention, with status `pending_approval`.
3. **Given** a branch has multiple products below minimum simultaneously, **When** auto-requisition is enabled, **Then** the system groups all low-stock products from that branch into a single requisition.
4. **Given** a requisition already exists in `pending_approval` status for the same product and branch, **When** the user or auto-generation attempts to create another, **Then** the system skips creation to avoid duplicates and optionally updates the existing requisition item quantity.

---

### User Story 5 — Auto-Generated Purchase Orders from Global Minimums (Priority: P3)

When the global stock of a product (sum across all locations) drops below its `products.minStock`, the system automatically creates a `draft` purchase order for manual review before sending to the provider. The system selects the cheapest registered provider for each product.

**Why this priority**: Completes the inventory replenishment loop at the supply-side. Lower priority because (a) purchase orders require provider selection which adds complexity, and (b) global minimums trigger less frequently than branch minimums since warehouse stock typically buffers branch demand.

**Independent Test**: Set up a product with `minStock=50` globally, stock across all locations at `30`, and a registered provider in `supplierProducts`. Trigger the auto-PO engine. Verify a `draft` purchase order is created with the correct product, suggested quantity (= global maxStock - currentStock), and cheapest provider selected.

**Acceptance Scenarios**:

1. **Given** Product X has global `minStock=50`, global `maxStock=200`, current total stock across all locations = `30`, and one registered provider with cost $10/unit, **When** the auto-PO engine runs, **Then** a `draft` purchase order is created with status `draft`, provider selected, and one item: Product X with `quantityOrdered=170` (maxStock - currentStock), `unitCostEstimated=$10`.
2. **Given** Product X has multiple providers at different costs, **When** the auto-PO engine runs, **Then** the provider with the lowest unit cost in `supplierProducts` is selected.
3. **Given** Product X has no registered provider in `supplierProducts`, **When** the auto-PO engine runs, **Then** the product is skipped with a log entry and an alert is raised: "Producto sin proveedor registrado" for manual resolution.
4. **Given** a `draft` auto-PO already exists for the same product and its stock is still below minimum, **When** the auto-PO engine runs again, **Then** the system updates the existing draft PO's `quantityOrdered` instead of creating a duplicate.

---

### Edge Cases

- **Concurrent Stock Changes**: What happens if stock changes while the alert engine is processing?
  - *Resolution*: The engine runs within a database transaction per product-branch pair. If stock has already recovered above minimum by the time the engine processes it, the engine skips alert creation for that pair.
- **Branch Threshold vs Global Threshold Conflict**: If a branch threshold is set higher than the global `maxStock`, is that valid?
  - *Resolution*: The system does not enforce cross-threshold validation. Branch thresholds are independent of global thresholds. The effective threshold is always the branch-level one when set.
- **Requisition Merging**: If a branch has 10 products below minimum and auto-requisition is enabled, does it create 10 separate requisitions or one?
  - *Resolution*: One requisition per branch, grouping all low-stock products. This minimizes approval overhead and creates a single transfer for the warehouse manager to process.
- **Draft PO Duplication**: If multiple products from the same provider hit global minimum simultaneously, are they grouped into one PO?
  - *Resolution*: Yes. The auto-PO engine groups products by provider: all products below global minimum from the same provider go into a single draft purchase order.
- **Stock at Zero with No maxStock Defined**: If `maxStock` is `0` or unset, what replenishment quantity should auto-requisitions use?
  - *Resolution*: Fall back to `quantityRequested = minStock * 2` as a heuristic. If `minStock` is also `0`, skip the product (cannot determine replenishment quantity).
- **Performance with Large Inventory**: If a business has 10,000+ products across 20+ branches, could the alert engine be slow?
  - *Resolution*: The engine uses a single SQL query to find all stock-level rows where `quantity < effectiveMinStock`, fetching only columns needed. Indexes on `stockLevels(productId, branchId)` and `stockLevels(quantity)` ensure efficient scans.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support setting per-branch stock thresholds (`minStock`, `maxStock`) for each product. Fallback to global `products.minStock` / `products.maxStock` when no branch threshold is defined.
- **FR-002**: System MUST provide an endpoint to upsert (create or update) and delete branch-level stock thresholds.
- **FR-003**: System MUST provide an endpoint to compute the "effective threshold" for a product at a branch, returning the branch threshold if set, otherwise the global product threshold.
- **FR-004**: System MUST run a low-stock detection engine (triggered on each inventory-affecting operation OR on a scheduled interval) that identifies all product-branch pairs where `currentStock < effectiveMinStock`.
- **FR-005**: System MUST create, update, or resolve `inventoryAlerts` records automatically based on stock level changes vs effective thresholds:
  - **Create** alert when stock drops below `effectiveMinStock` and no active alert exists.
  - **Update** alert `currentQty` when stock changes and an active alert exists.
  - **Resolve** alert when stock rises to or above `effectiveMinStock`.
- **FR-006**: System MUST support alert statuses: `active`, `acknowledged` (viewed but unresolved), `resolved` (stock recovered above minimum).
- **FR-007**: Alert deduplication: only ONE active alert per product-branch pair at any time.
- **FR-008**: System MUST provide an `inventoryAlerts` API endpoint to list, filter (by branch, status, product), and update alert status.
- **FR-009**: Admin frontend MUST have a new "Panel de Inventario" page showing:
  - Summary counters: products out of stock, products below minimum, products healthy.
  - Filterable alert list with product name, branch, current stock, effective minimum, suggested replenishment quantity.
  - "Generar Requisición" quick-action button per alert row.
- **FR-010**: "Generar Requisición" MUST create a `branchRequisitions` record in `pending_approval` status pre-filled with:
  - `fromBranchId` = the alert's branch
  - `toWarehouseId` = the business's primary/default warehouse
  - `quantityRequested` = `effectiveMaxStock - currentQty`
- **FR-011**: System MUST support an optional auto-requisition mode (business-level toggle) that automatically creates branch requisitions from new alerts without user intervention.
- **FR-012**: System MUST support an auto-PO engine that detects products where global stock (sum of all `stockLevels` for the product) is below `products.minStock`, and creates a `draft` purchase order grouping products by the cheapest registered provider.
- **FR-013**: The auto-PO engine MUST skip products with no registered provider and log a notification.
- **FR-014**: The auto-PO engine MUST NOT create duplicate draft POs for the same product; it updates the existing draft PO's quantities instead.
- **FR-015**: Both the alert engine and auto-PO/reconciliation jobs MUST be idempotent (safe to run multiple times without side effects).

### Key Entities

- **BranchStockThreshold**: Per-branch override for a product's stock threshold. Attributes: `id`, `productId`, `branchId`, `minStock` (decimal, nullable — null means use global), `maxStock` (decimal, nullable — null means use global), `updatedAt`, `updatedBy`.
- **InventoryAlert**: A low-stock or out-of-stock detection record. Attributes: `id`, `businessId`, `productId`, `branchId`, `alertType` (`low_stock` | `out_of_stock`), `threshold` (the effective minStock at time of alert), `currentQty`, `status` (`active` | `acknowledged` | `resolved`), `createdAt`, `acknowledgedAt`, `resolvedAt`.
- **BusinessInventorySettings** (extend existing `businesses` table or new table): Per-business configuration flags. Attributes: `autoRequisitionEnabled` (boolean, default false), `defaultWarehouseId` (the fallback warehouse for requisitions), `alertEngineIntervalMinutes` (how often the alert engine checks, default 15).

Existing entities reused without schema changes:
- `products` (global `minStock`, `maxStock`, `cost`)
- `stockLevels` (per-location quantity — no schema change needed; thresholds are in the separate `branchStockThresholds` table)
- `branchRequisitions` + `branchRequisitionItems` (requisitions workflow)
- `purchaseOrders` + `purchaseOrderItems` (PO workflow)
- `supplierProducts` (provider-to-product mapping with cost)
- `branches`, `warehouses`

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Branch managers can view a real-time dashboard of inventory health at their branch, with alerts refreshing within 60 seconds of a stock change.
- **SC-002**: The alert engine processes a business with 5,000 product-branch pairs in under 2 seconds.
- **SC-003**: An alert-to-requisition action takes exactly 1 click and completes in under 3 seconds (API response time).
- **SC-004**: Auto-requisitions group all low-stock products from the same branch into a single requisition, reducing approval overhead.
- **SC-005**: 100% of stock drops below `minStock` generate a corresponding alert within one alert engine cycle (no missed detections).
- **SC-006**: The auto-PO engine correctly identifies the cheapest provider for each product in ≥95% of cases (the 5% margin accounts for suppliers not yet registered in `supplierProducts`).

---

## Assumptions

- **A-001**: The `stockLevels` table already correctly tracks per-location quantities. No schema changes are needed to `stockLevels` itself — thresholds live in the new `branchStockThresholds` table.
- **A-002**: The alert engine runs as an on-demand triggered operation (on each receipt, sale, transfer, production) AND on a configurable scheduled interval (e.g., every 15 minutes via a cron/scheduler) to catch any edge cases.
- **A-003**: Requisitions created via auto-generation follow the exact same workflow as manually created requisitions (approval → transfer → completion). Auto-generation only removes the creation step.
- **A-004**: Purchase orders created via auto-generation are always `draft` status and require manual review before being sent to the provider. The system never sends POs without human approval.
- **A-005**: "Default warehouse" for requisitions is configurable per business. If not set, the system uses the first active warehouse found for that business.
- **A-006**: Merma (waste/shrinkage) is out of scope. Inventory decreases only via sales and transfers. Future versions may add merma tracking which would also trigger the alert engine.
