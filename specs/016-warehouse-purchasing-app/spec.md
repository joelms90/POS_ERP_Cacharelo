# Feature Specification: Dedicated Warehouse Operator App (Almacén y Bodega)

**Feature Branch**: `016-warehouse-purchasing-app`  
**Created**: 2026-10-24  
**Status**: Draft  
**Input**: Dedicated application experience in the Flutter client (`apps/pos_flutter`) for the canonical role `warehouse_purchasing_operator`, strictly scoped to warehouse physical operations: receiving goods from suppliers into storage and dispatching stock transfers to fulfill branch requisitions.

---

## 1. Summary & Core Purpose

Currently, when a user with the canonical role `warehouse_purchasing_operator` logs into the Flutter POS client, they are redirected to `EncargadoDashboardScreen(showFullFeatures: false)`. This screen was originally designed for retail store counters (displaying POS tables, waiter orders, cash drawer, and tickets), which does not align with the operational reality of a central warehouse or commissary bodega.

This feature introduces a **dedicated, tablet/desktop-optimized Warehouse Operator workspace in Flutter (`WarehouseDashboardScreen`)**. It is strictly focused on the physical inventory flow of the warehouse:
1. **Recepción de Proveedores (Entradas a Bodega)**: El operador recibe la mercancía física que llega de proveedores contra Órdenes de Compra previamente emitidas, valida cantidades reales, reporta mermas o daños y confirma la entrada al inventario de la bodega.
2. **Surtido y Despacho a Sucursales (Salidas de Bodega)**: El operador recibe las solicitudes de insumos (requisiciones) emitidas por las sucursales, realiza el surtido físico en bodega (*picking*) y despacha el traspaso para entregarlo a la sucursal.
3. **Auditoría de Existencias y Conteo Físico**: Consulta rápida de stock físico en bodega con escáner de código de barras / SKU y registro de ajustes por merma o rotura.

---

## 2. Segregation of Duties & Boundaries *(mandatory)*

To maintain strict internal controls, anti-fraud standards, and audit integrity, the Warehouse Operator terminal in Flutter adheres to the following explicit boundaries:

### ❌ Lo que el Operador de Almacén NO puede hacer en la app:
- **NO puede crear, editar ni eliminar Órdenes de Compra (OC) originales**: La negociación, creación de órdenes y acuerdo de precios con proveedores es responsabilidad exclusiva de Compras / Administración desde el panel web central (`business_control_tauri`). El operador de almacén solo recibe lo que Compras ya autorizó.
- **NO puede crear, editar ni eliminar Requisiciones de Sucursales**: Las requisiciones son generadas exclusivamente por el personal de cada sucursal (tienda, cafetería o cocina). El operador de almacén no puede inventar ni alterar los pedidos originales de las tiendas; únicamente puede surtirlos, aprobarlos según el stock disponible o reportar desabasto.

### ✅ Lo que el Operador de Almacén SÍ hace en la app:
- **Recibir entregas físicas**: Coteja lo que el camión o proveedor entrega físicamente contra la OC emitida, anota piezas faltantes o dañadas y da entrada al stock de la bodega.
- **Surtir y despachar pedidos a sucursales**: Prepara los insumos solicitados por las sucursales y registra la salida del inventario de bodega hacia la sucursal.
- **Auditar y ajustar stock físico de bodega**: Realiza conteos de bodega y registra ajustes justificados (mermas, roturas, caducidades).

---

## 3. User Scenarios & Testing *(mandatory)*

### User Story 1 - Recepción de Mercancía de Proveedores y Entrada a Bodega (Priority: P1)

As a **Warehouse Operator**,  
I need to open an issued Purchase Order (`sent` or `partially_received`) when a supplier arrives at the warehouse dock,  
So that I can verify physically delivered items against the PO, record damaged/missing units, and confirm the formal entry into the bodega's inventory.

**Why this priority**: Essential inbound workflow. Without receiving verification, physical items sitting in the warehouse do not exist in the system ledger.

**Independent Test**: Can be tested by selecting an issued PO in `sent` status, entering received quantities and actual invoice costs, confirming reception, and verifying that the destination warehouse stock increments in `stock_ledger` and the PO transitions to `received` or `partially_received`.

**Acceptance Scenarios**:
1. **Given** an open PO in `sent` status emitted by administration, **When** the operator opens the reception view, **Then** all line items display original ordered quantities and expected costs as read-only references, with editable fields for `receivedQuantity`, `actualUnitCost`, and `rejectionReason`.
2. **Given** complete delivery of all items, **When** the operator submits the reception, **Then** warehouse stock is incremented, weighted average cost is recalculated in `products.cost`, and the PO status updates to `received`.
3. **Given** missing or damaged items, **When** the operator inputs a quantity less than ordered and enters a discrepancy reason (e.g. `Empaque roto por transportista`), **Then** only the sound units enter inventory, the rejected units are audited, and the PO status updates to `partially_received`.
4. **Given** an issued PO, **When** viewing it in the warehouse app, **Then** the operator has NO options to add new products, delete line items, or cancel the original PO.

---

### User Story 2 - Surtido y Despacho de Requisiciones a Sucursales (Priority: P1)

As a **Warehouse Operator**,  
I need to inspect pending requisitions sent by store branches (cafeterías, cocinas, kioscos),  
So that I can verify on-hand warehouse stock, pack the items (*picking*), and dispatch the stock transfer to the destination branch.

**Why this priority**: Essential outbound workflow. Retail branches cannot operate or serve customers without receiving their requested supplies from the central warehouse.

**Independent Test**: Can be tested by creating a requisition from a store branch, opening it in the Warehouse app, approving/packing the available items, and tapping `Despachar Traspaso`, verifying that warehouse stock decrements and the transfer transitions to `in_transit`.

**Acceptance Scenarios**:
1. **Given** a branch requisition in `pending_approval` status, **When** the warehouse operator views the request, **Then** the requested items and quantities appear as read-only from the branch, displayed alongside current warehouse stock availability.
2. **Given** sufficient stock in bodega, **When** the operator approves and prepares the order, **Then** tapping `Despachar Traspaso` decrements available warehouse stock and creates/transitions the linked `stock_transfers` record to `in_transit`.
3. **Given** insufficient stock in bodega for certain items, **When** the operator cannot fulfill a request immediately, **Then** the operator can place the requisition in `standby` with an explanation note (e.g. `En espera de entrega de proveedor martes`).
4. **Given** the segregation-of-duties rule, **When** an operator attempts to approve a requisition where `requested_by == current_user_id`, **Then** the system blocks self-approval and displays a security notice.

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

### User Story 4 - Historial de Movimientos de Bodega (Priority: P3)

As a **Warehouse Operator**,  
I need to review recent receipts and outbound dispatches completed during the shift,  
So that I can verify what was received, what was shipped, and provide handover notes to the next warehouse shift.

**Why this priority**: Operational traceability and shift handover verification.

**Independent Test**: Can be tested by completing a PO receipt and a transfer dispatch, opening the Historial tab, and verifying that both entries appear with timestamp, folio, and item summary.

**Acceptance Scenarios**:
1. **Given** completed receipts or dispatches, **When** the operator visits the Historial tab, **Then** records are listed chronologically with badges indicating `Entrada (Proveedor)` or `Salida (Traspaso a Sucursal)`.
2. **Given** an entry in the history, **When** tapped, **Then** the operator can inspect the full breakdown of quantities received/dispatched and discrepancy notes.

---

## 4. Dedicated Flutter Navigation & UI Architecture

### 4.1 Routing on Login
In [`apps/pos_flutter/lib/ui/login_screen.dart`](file:///Users/joelmorales/web/POS-ERP/apps/pos_flutter/lib/ui/login_screen.dart):
- When `currentUserRole == UserRole.warehousePurchasingOperator`, route directly to `WarehouseDashboardScreen`.
- Complete removal of restaurant/cafetería artifacts: no dining tables, no dining rooms, no waiter carts, no cash drawer / corte X / corte Z panels.

### 4.2 Navigation Tabs in `WarehouseDashboardScreen`
The interface is structured for landscape tablets, touch all-in-one terminals, and desktop displays:
1. **📥 Entradas (Recepciones OC)**: Lista de Órdenes de Compra enviadas por Compras listas para recibir. Modal de check-in físico con teclado numérico para cantidades reales, costos de factura y mermas.
2. **📤 Salidas (Surtido a Sucursales)**: Bandeja de Requisiciones solicitadas por las sucursales. Lista de picking físico y botón `Despachar Traspaso`.
3. **📦 Inventario de Bodega**: Existencias en vivo de insumos por categoría/estante, buscador por código de barras y modal de ajuste por merma/conteo.
4. **📜 Historial de Turno**: Registro cronológico de recepciones y despachos ejecutados durante la jornada.

---

## 5. Requirements & Business Rules *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST route `UserRole.warehousePurchasingOperator` to a dedicated `WarehouseDashboardScreen` in Flutter POS.
- **FR-002**: PO Receiving screen MUST display the original ordered quantity and cost as read-only reference while allowing the operator to enter actual delivered values.
- **FR-003**: System MUST NOT allow the warehouse operator in Flutter to create, edit line items, or delete original Purchase Orders.
- **FR-004**: System MUST NOT allow the warehouse operator in Flutter to create or delete branch requisitions on behalf of branches.
- **FR-005**: System MUST require an auditable discrepancy note whenever received quantity is less than ordered or damaged items are rejected.
- **FR-006**: Completing a PO receipt MUST trigger the weighted average cost recalculation on the backend and update destination warehouse stock in `stock_ledger`.
- **FR-007**: Requisition approvals MUST prevent self-approval (the user ID approving cannot match `requested_by`).
- **FR-008**: Requisition dispatch MUST generate a corresponding `stock_transfers` record moving inventory into `in_transit` state.
- **FR-009**: Physical counts and adjustments MUST capture adjustment reason codes: `merma`, `conteo_fisico`, `caducidad`, `rotura`, or `correccion`.
- **FR-010**: Warehouse operator UI MUST display the currently active Warehouse (Bodega) with selector support if the business has multiple warehouses.
- **FR-011**: The Flutter app MUST support USB and Bluetooth barcode scanners transmitting newline-terminated strings into product lookup fields.
- **FR-012**: The warehouse workspace MUST function with offline resilience: cached product catalogs and offline requisition queues sync automatically upon reconnection.

---

## 6. Success Criteria *(mandatory)*

- **SC-001**: Warehouse operators can complete a full PO reception (verifying items, costs, and saving) in under 60 seconds on a tablet.
- **SC-002**: Requisitions sent from any retail branch appear in the Warehouse screen within 5 seconds via existing WebSocket sync or 15-second polling fallback.
- **SC-003**: 100% of inventory movements generated from warehouse receipts and transfers reflect correctly in the backend `stock_ledger` and `inventory_movements`.
- **SC-004**: Zero store counter artifacts (tables, table layouts, guest seats, cash drawer float/arqueos) are displayed to the warehouse operator.
- **SC-005**: Unit and widget tests for the new Flutter screens pass with 0 errors.
