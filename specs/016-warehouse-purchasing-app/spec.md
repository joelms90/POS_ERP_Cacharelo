# Feature Specification: Dedicated Warehouse & Purchasing Operator App

**Feature Branch**: `016-warehouse-purchasing-app`  
**Created**: 2026-10-24  
**Status**: Draft  
**Input**: Dedicated application experience for the canonical role `warehouse_purchasing_operator` across the Flutter client (`apps/pos_flutter`), consuming backend purchase orders, receipts, transfers, and requisitions contracts.

---

## 1. Summary

Currently, when a user with the canonical role `warehouse_purchasing_operator` logs into the Flutter POS client, they are redirected to `EncargadoDashboardScreen(showFullFeatures: false)`. This screen was originally designed for retail store counters (displaying POS tables, waiter orders, cash drawer, and tickets), which does not align with the operational needs of a central warehouse or commissary bodega.

This feature introduces a **dedicated, tablet/desktop-optimized Warehouse & Purchasing Operator workspace in Flutter (`WarehouseDashboardScreen`)**. It empowers the warehouse operator to:
1. **Receive supplier purchase orders (Órdenes de Compra)** with quantity and unit cost verification, registering discrepancies and computing weighted average costs.
2. **Review, approve, and dispatch branch requisitions (Requisiciones de Sucursal)** into stock transfers with picking guidance.
3. **Audit warehouse stock levels and conduct quick counts** with barcode/SKU search and variance logging.
4. **Draft and issue new purchase orders to suppliers** when inventory drops below safety thresholds.

---

## 2. User Scenarios & Testing *(mandatory)*

### User Story 1 - Recepción de Órdenes de Compra de Proveedores (Priority: P1)

As a **Warehouse & Purchasing Operator**,  
I need to inspect incoming supplier deliveries against issued Purchase Orders (`sent` or `partially_received`),  
So that I can verify delivered quantities, update real unit costs, log discrepancies/damaged goods, and immediately update warehouse stock and weighted average costs.

**Why this priority**: Core responsibility of warehouse receiving. Without PO receipt, central inventory is inaccurate, preventing branch distribution.

**Independent Test**: Can be tested by selecting an existing PO in `sent` status, entering received quantities and unit costs (with 1 item partial or damaged), confirming reception, and verifying that warehouse stock increases and the PO status transitions to `received` or `partially_received`.

**Acceptance Scenarios**:
1. **Given** an open PO in `sent` status, **When** the operator opens the PO reception view, **Then** all line items display requested quantities, expected unit costs, and input fields for `receivedQuantity`, `actualUnitCost`, and `rejectionReason`.
2. **Given** complete delivery of all items at the agreed cost, **When** the operator submits the reception, **Then** warehouse stock is incremented, weighted average cost is recalculated in `products.cost`, and the PO status updates to `received`.
3. **Given** a delivery with missing or damaged items, **When** the operator enters a received quantity less than ordered and provides a discrepancy note, **Then** only the received quantity increments stock, the rejected items are audited, and the PO status updates to `partially_received`.

---

### User Story 2 - Aprobación y Despacho de Requisiciones de Sucursales (Priority: P1)

As a **Warehouse & Purchasing Operator**,  
I need to review material requisitions sent by store branches (cafeterías, kioscos, cocina),  
So that I can verify warehouse stock availability, approve or place on standby, and dispatch the requested stock as an inter-branch transfer.

**Why this priority**: Required for store replenishment. Branches cannot fulfill customer orders without stock shipped from the central warehouse.

**Independent Test**: Can be tested by creating a branch requisition from the POS or Admin, viewing it in the Warehouse app, approving it, and marking it as dispatched.

**Acceptance Scenarios**:
1. **Given** a requisition in `pending_approval` status, **When** the warehouse operator views the requisition, **Then** the screen shows requested quantities alongside current warehouse stock availability (highlighting shortages in red/amber).
2. **Given** sufficient stock, **When** the operator approves the requisition, **Then** the system transitions the status to `approved`, creates a linked `stock_transfers` record in `in_transit`, and decrements available warehouse stock.
3. **Given** the separation-of-duties rule, **When** the operator who created the requisition attempts to approve their own requisition, **Then** the system prevents self-approval and displays an explanatory security notice.
4. **Given** stock shortages or unconfirmed delivery dates, **When** the operator marks the requisition as `standby` with a note, **Then** the branch receives the status update and the request remains open for future fulfillment.

---

### User Story 3 - Auditoría Rápida de Stock y Conteo Físico en Bodega (Priority: P2)

As a **Warehouse Operator**,  
I need a tactile, fast stock lookup and cycle count screen with barcode / SKU filtering,  
So that I can verify real-time physical inventory in the bodega and register manual stock adjustments for waste, expiration, or count corrections.

**Why this priority**: Daily warehouse operations require verifying physical boxes/bins on shelves without walking back to an office computer.

**Independent Test**: Can be tested by scanning or typing a product SKU, displaying its current ledger stock, entering a counted quantity with a variance reason, and checking that the stock adjustment is logged in `stock_ledger`.

**Acceptance Scenarios**:
1. **Given** the warehouse catalog view, **When** the operator types a search term or scans a barcode with a USB/Bluetooth scanner, **Then** matching products are filtered instantly with their current on-hand stock in the active warehouse.
2. **Given** a physical variance (e.g., damaged bag of coffee beans), **When** the operator logs an adjustment with quantity delta `-2` and reason `Merma por rotura de empaque`, **Then** the adjustment is saved, ledger updated, and audit log recorded.

---

### User Story 4 - Creación y Envío Rápido de Órdenes de Compra (Priority: P3)

As a **Purchasing Operator**,  
I need to quickly create and send Purchase Orders to registered suppliers when inventory is low,  
So that we reorder raw materials before stockouts affect production.

**Why this priority**: Allows the purchasing operator to close the procurement loop directly from their terminal without switching to the full desktop Admin panel.

**Independent Test**: Can be tested by selecting a supplier, adding 3 products with target quantities, saving as `draft`, and clicking `Enviar Orden` to transition to `sent`.

**Acceptance Scenarios**:
1. **Given** the purchase orders tab, **When** the operator taps `Nueva Orden de Compra`, **Then** they select a provider, add products from that provider's catalog, specify estimated quantities and unit costs, and save the draft.
2. **Given** a draft order, **When** reviewed and confirmed, **Then** the operator taps `Enviar al Proveedor`, setting status to `sent` and generating folio `OC-XXXX`.

---

## 3. Dedicated Flutter Navigation & UI Architecture

### 3.1 Routing on Login
In [`apps/pos_flutter/lib/ui/login_screen.dart`](file:///Users/joelmorales/web/POS-ERP/apps/pos_flutter/lib/ui/login_screen.dart):
- When `currentUserRole == UserRole.warehousePurchasingOperator`, route to `WarehouseDashboardScreen` instead of `EncargadoDashboardScreen`.
- If an operator possesses multiple roles (e.g. `['branch_operator', 'warehouse_purchasing_operator']`), provide a clean workspace switcher in the header.

### 3.2 Navigation Tabs in `WarehouseDashboardScreen`
The interface is structured for landscape tablets, touch all-in-one terminals, and desktop displays:
1. **📥 Recepciones (PO Receiving)**: List of incoming orders (`sent`, `partially_received`). Detailed check-in view with numeric keypad for actual counts and unit costs.
2. **📋 Requisiciones (Branch Requests)**: Incoming requests grouped by branch and urgency. One-tap approval, partial fulfillment, and dispatch to transit.
3. **📦 Inventario de Bodega (Stock & Counts)**: Live on-hand stock by category/shelf, barcode search, and quick adjustment modal.
4. **📝 Órdenes de Compra (Purchasing)**: Procurement pipeline (`draft`, `sent`, `received`, `cancelled`) with PO creation flow.

---

## 4. Requirements & Business Rules *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST route `UserRole.warehousePurchasingOperator` to a dedicated `WarehouseDashboardScreen` in Flutter POS.
- **FR-002**: PO Receiving screen MUST display the original ordered quantity and cost as reference while allowing the operator to enter actual delivered values.
- **FR-003**: System MUST require an auditable discrepancy note whenever received quantity is less than ordered or damaged items are rejected.
- **FR-004**: Completing a PO receipt MUST trigger the weighted average cost recalculation on the backend and update destination warehouse stock.
- **FR-005**: Requisition approvals MUST prevent self-approval (the user ID approving cannot match `requested_by`).
- **FR-006**: Requisition dispatch MUST generate a corresponding `stock_transfers` record moving inventory into `in_transit` state.
- **FR-007**: Physical counts and adjustments MUST capture adjustment reason codes: `merma`, `conteo_fisico`, `caducidad`, `rotura`, or `correccion`.
- **FR-008**: Warehouse operator UI MUST display the currently active Warehouse (Bodega) with selector support if the business has multiple warehouses.
- **FR-009**: The Flutter app MUST support USB and Bluetooth barcode scanners transmitting newline-terminated strings into product lookup fields.
- **FR-010**: The warehouse workspace MUST function with offline resilience: cached product catalogs and offline requisition queues sync automatically upon reconnection.

---

## 5. Success Criteria *(mandatory)*

- **SC-001**: Warehouse operators can complete a full PO reception (verifying items, costs, and saving) in under 60 seconds on a tablet.
- **SC-002**: Requisitions sent from any retail branch appear in the Warehouse screen within 5 seconds via existing WebSocket sync or 15-second polling fallback.
- **SC-003**: 100% of inventory movements generated from warehouse receipts and transfers reflect correctly in the backend `stock_ledger` and `inventory_movements`.
- **SC-004**: No store counter artifacts (tables, table layouts, guest seats, cash drawer float/arqueos) are displayed to the warehouse operator.
- **SC-005**: Unit and widget tests for the new Flutter screens pass with 0 errors.
