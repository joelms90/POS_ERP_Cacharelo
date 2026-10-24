# Phase 0 Research: Dedicated Warehouse Operator App

This document details the architectural decisions, UX ergonomics, and segregation-of-duties boundaries for the Flutter Warehouse Operator application (`016-warehouse-purchasing-app`).

---

## 1. Segregation of Duties & Boundary Enforcement

### Decision
The Flutter warehouse client is strictly an **execution interface**. It explicitly removes all capabilities to create, edit line items, or delete original Purchase Orders or Branch Requisitions.

### Rationale
- In warehouse management and anti-fraud protocols, warehouse personnel must not have permissions to initiate procurement contracts with suppliers or modify agreed purchase prices. That power belongs to Administration / Purchasing in `business_control_tauri`.
- Similarly, store branch requests (Requisitions) represent branch demand. Warehouse operators must not forge or tamper with original store orders; they only confirm what physical inventory they are dispensing.

### UI & API Enforcement
- **UI Level**: No `Nueva Orden de Compra` or `Nueva Requisición` buttons exist in `WarehouseDashboardScreen`.
- **API Level**: Endpoints like `POST /purchase-orders` remain restricted to administrative roles (`owner`, `inventory_admin`). The warehouse operator only accesses `POST /purchase-orders/:id/receive` and `POST /branch-requisitions/:id/approve`.

---

## 2. PO Receiving UI Ergonomics for Warehouse Environments

### Decision
The PO receiving modal defaults all received quantities to match ordered quantities (`Recibir Completo`) while providing a dedicated numeric keypad and item inspection view for partial or damaged deliveries.

### Rationale
- In 85% of standard deliveries, suppliers deliver the complete order as agreed. Having to manually type quantities for 30 products causes friction and operator fatigue.
- With "Recibir Completo" as the initial baseline:
  - If everything is correct: Operator reviews line items, enters invoice/remisión cost, and confirms in 1 tap.
  - If an item is missing or damaged: Operator taps that specific line, taps the keypad to adjust the actual quantity (e.g. from 20 to 18), and selects a mandatory discrepancy code (`Faltante en camión`, `Empaque roto`, `Caducidad próxima`).

---

## 3. Hardware Barcode Scanner Integration

### Decision
Support standard USB and Bluetooth barcode scanners in keyboard emulation (HID) mode without requiring third-party native scanner drivers.

### Rationale
- Physical warehouse handheld scanners (Zebra, Honeywell, Inateck) behave as standard HID keyboards that rapidly type ASCII characters followed by a newline `\n` or `Key.enter`.
- In `WarehouseStockTab`, a persistent `FocusNode` with an `onSubmitted` handler captures scanned barcodes, finds the corresponding product by `barcode` or `sku`, and highlights its card/row with current on-hand stock in < 150ms.

---

## 4. Active Warehouse Context & Switching

### Decision
When the operator logs in, the app binds to their assigned warehouse (`user.branchId` or central bodega). If the user has access to multiple warehouses (e.g. `Bodega Matriz` and `Bodega Fríos`), the top header displays a dropdown to select the active bodega.

### Rationale
- Inventory movements and stock adjustments must be strictly localized to the physical building where goods are being received or picked.
- A prominent header badge prevents an operator from accidentally receiving products into the dry storage bodega when unloading into cold storage.
