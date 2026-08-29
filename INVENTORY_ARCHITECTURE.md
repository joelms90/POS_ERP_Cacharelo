# POS-ERP Codebase Architecture Summary
## Inventory, Transfer, Order & Branch System Analysis

**Generated:** 2026-07-11  
**Codebase:** Multi-app monorepo - NestJS backend (sync_api), React-Tauri desktop (business_control_tauri), Flutter POS app

> ⚠️ **UPDATED 2026-08-29** — the inventory model changed fundamentally. See **§0. Recent Changes** below before reading the (now partially outdated) sections that follow.

---

## 0. Recent Changes (2026-08-29)

### 0.1 Inventory is now ledger-driven (immutable)

- **New table `stock_ledger`** — the single source of truth. Every stock movement is an immutable row with `quantity_delta` (+ in / − out) and `event_type` (`receipt`, `sale`, `production_input/output`, `transfer_out/in`, `transit_in/out`, `adjustment`, `initial`).
- `stock_levels` is now a **read model** kept in sync by `LedgerService.applyMovement()` inside the same transaction. Business logic must NOT write `stock_levels` directly.
- Stock on hand is `SUM(quantity_delta) GROUP BY product, location`.

### 0.2 Product model

- `products` gained `item_type` (`raw_material` | `wip` | `finished_good` | `service`), `production_strategy` (`none` | `backflush` | `work_order`), and `uom`.
- Legacy `is_sellable`/`is_ingredient` are **derived** from `item_type` (see `scripts/reconcile-product-item-type.ts`).

### 0.3 Per-sucursal stock & catalog

- **Sales deduct the selling branch's stock** (no longer the warehouse).
- **`branch_products`** = per-branch catalog override (which products a sucursal can sell; can mark an insumo sellable, or hide a finished good).
- **`branch_stock_thresholds`** = per-branch min/max (fallback to `products.minStock`/`maxStock`).

### 0.4 Intelligent inventory control

- **`inventory_alerts`** — `branchId NULL` = global "compra sugerida" (global stock < `products.minStock` → OC); `branchId` set = "requisición sugerida" (branch stock < branch threshold, only when there is transferable stock).
- **`business_inventory_settings`** — auto-requisition flag + default warehouse.

### 0.5 Transfers use a transit location

- `warehouses.location_type` supports a virtual `En Tránsito` warehouse.
- Transfer lifecycle: `pending` → (ship: origin −qty, transit +qty) `in_transit` → (receive: transit −qty, destination +qty) `received`.

---

## 1. DATABASE SCHEMA ANALYSIS

### 1.1 Product & Inventory Core Tables

#### Products Table
- **Location:** `products` table
- **Key Fields:**
  - `id` (UUID, PK)
  - `businessId` (FK → businesses)
  - `categoryId` (FK → categories)
  - `providerId` (FK → providers, optional)
  - `name, sku, barcode, internalCode`
  - `cost` (decimal 10,2) - purchase cost
  - `price` (decimal 10,2) - retail price
  - `priceWholesale` (decimal 10,2)
  - `minStock, maxStock` (decimal 12,3) - inventory thresholds
  - `saleType` (default: 'pieza') - unit of measurement
  - `isSellable, isIngredient, isActive`
  - `imageUrl`
  - Timestamps: `createdAt, updatedAt, deletedAt`
  - `version` (for soft-delete tracking)

#### Stock Levels Table
- **Location:** `stock_levels` table
- **Purpose:** Maintains real-time inventory quantities across warehouses and branches
- **Key Fields:**
  - `id` (UUID, PK)
  - `productId` (FK → products)
  - `branchId` (FK → branches, optional)
  - `warehouseId` (FK → warehouses, optional)
  - `quantity` (decimal 12,3) - current stock
  - `updatedAt` - last modification timestamp
- **Pattern:** One row per product per location (branch OR warehouse, not both)

#### Inventory Movements Table
- **Location:** `inventory_movements` table (audit log)
- **Purpose:** Complete audit trail of all inventory changes
- **Key Fields:**
  - `id` (UUID, PK)
  - `businessId, productId`
  - `branchId, warehouseId` (one location)
  - `quantity` (decimal 12,3) - positive = entry, negative = exit
  - `type` (varchar 30):
    - `'receipt'` - purchase from provider
    - `'sale'` - sales transaction
    - `'production_input'` - ingredient consumed
    - `'production_output'` - product assembled
    - `'transfer_out'` - stock moved out
    - `'transfer_in'` - stock received
    - `'adjustment'` - manual correction
    - `'initial'` - opening balance
  - `referenceId` (FK to originating document ID)
  - `documentNumber` (e.g., purchase order number)
  - `lotNumber, expirationDate` - batch tracking
  - `drawerLocation` - physical location
  - `createdAt, createdById` (user who recorded)
  - Indexes on: (businessId, productId), (branchId), (warehouseId), (createdAt)

### 1.2 Locations & Organization

#### Businesses Table
- **Location:** `businesses` table
- **Purpose:** Top-level tenant/organization entity
- **Key Fields:**
  - `id` (UUID, PK)
  - `name, taxId`
  - `isActive`
  - Timestamps and versioning

#### Branches (Sucursales) Table
- **Location:** `branches` table
- **Purpose:** Individual POS locations/stores
- **Key Fields:**
  - `id` (UUID, PK)
  - `businessId` (FK → businesses)
  - `name` - branch name (e.g., "Sucursal Centro")
  - `address, phone`
  - `roomConfigs` (text) - JSON storing room/area configurations
  - Soft delete support
  - Version tracking
- **Relations:**
  - Has many `branchTables` (dining tables for restaurant)
  - Can hold stock levels
  - Destination for inventory transfers and receipts

#### Warehouses Table
- **Location:** `warehouses` table
- **Purpose:** Central distribution/storage locations
- **Key Fields:**
  - `id` (UUID, PK)
  - `businessId` (FK → businesses)
  - `name, code` - warehouse identifier
  - `address`
  - `isActive`
  - Soft delete, versioning

#### Branch Tables Table
- **Location:** `branch_tables` table
- **Purpose:** Restaurant table management
- **Key Fields:**
  - `branchId` (FK → branches)
  - `label, capacity` - e.g., "Mesa 1", 4 seats
  - `room` - area/section (Terraza, Salon, etc.)
  - `state` - (free, occupied, billing, cleaning)
  - `x, y` - coordinates for floor plan
  - `shape` - visual representation (square, round, etc.)

### 1.3 Suppliers & Costs

#### Providers Table
- **Location:** `providers` table
- **Purpose:** Vendor/supplier master data
- **Key Fields:**
  - `id` (UUID, PK)
  - `businessId` (FK → businesses)
  - `name, contactName, phone, email, address`
  - Soft delete, versioning

#### Supplier Products Table
- **Location:** `supplier_products` table
- **Purpose:** Mapping between internal products and supplier catalogs
- **Key Fields:**
  - `id` (UUID, PK)
  - `businessId, productId` (FK → products), `providerId` (FK → providers)
  - `providerProductName` - supplier's product name
  - `providerSku` - supplier's SKU
  - `cost` (decimal 10,2) - cost from this specific supplier
  - `conversionFactor` (decimal 10,4) - unit conversion ratio
  - Allows same product from multiple suppliers with different costs

### 1.4 Inventory Receipt System

#### Inventory Receipts Table
- **Location:** `inventory_receipts` table
- **Purpose:** Purchase order receipt documents from suppliers
- **Key Fields:**
  - `id` (UUID, PK)
  - `businessId, providerId`
  - `branchId, warehouseId` (one destination)
  - `documentNumber` - receipt/invoice number
  - `receivedAt` - receipt timestamp
  - `notes`
  - `createdAt`

#### Inventory Receipt Items Table
- **Location:** `inventory_receipt_items` table
- **Purpose:** Line items in a receipt
- **Key Fields:**
  - `id` (UUID, PK)
  - `receiptId` (FK → inventory_receipts)
  - `productId` (FK → products)
  - `quantity` (decimal 12,3)
  - `unitCost, totalCost` (both decimal 10,2)
- **Process:**
  1. Receipt created with destination (branch OR warehouse)
  2. Items added with quantities and costs
  3. Stock levels updated automatically
  4. Inventory movements logged for audit trail

### 1.5 Transfers System (Traspasos)

#### Stock Transfers Table
- **Location:** `stock_transfers` table
- **Purpose:** Inter-location stock movements
- **Key Fields:**
  - `id` (UUID, PK)
  - `businessId`
  - `fromWarehouseId, fromBranchId` (one origin)
  - `toWarehouseId, toBranchId` (one destination)
  - `transferredAt` - timestamp
  - `status` (default: 'completed')
  - `notes`
- **Valid Scenarios:**
  - Warehouse → Branch (distribution)
  - Branch → Warehouse (returns/consolidation)
  - Warehouse → Warehouse
  - Branch → Branch

#### Stock Transfer Items Table
- **Location:** `stock_transfer_items` table
- **Purpose:** Line items in a transfer
- **Key Fields:**
  - `id` (UUID, PK)
  - `transferId` (FK → stock_transfers)
  - `productId` (FK → products)
  - `quantity` (decimal 12,3)
  - `unitCost, totalCost` (both decimal 10,2)
- **Process:**
  1. Transfer header created with source and destination
  2. Items added with quantities
  3. Source stock decremented
  4. Destination stock incremented
  5. Two movement records logged (transfer_out, transfer_in)

### 1.6 Production / Assembly & Production Orders (OP) System

#### Recipes Table (BOM)
- **Location:** `recipes` table
- **Purpose:** Bill of Materials (BOM) for assembled / manufactured products
- **Key Fields:**
  - `id` (UUID, PK)
  - `parentProductId` (FK → products) - finished good or WIP product
  - `ingredientProductId` (FK → products) - raw material or WIP input
  - `quantityNeeded` (decimal 12,3) - amount of ingredient per 1 unit of parent product
  - `wastePercent` (decimal 5,2) - estimated shrinkage/waste percentage
  - `createdAt, updatedAt`

#### Production Runs / Orders (OP) Table
- **Location:** `production_runs` table
- **Purpose:** Tracks planned production orders (OP) and immediate assemblies across warehouses
- **Key Fields:**
  - `id` (UUID, PK)
  - `warehouseId` (FK → warehouses) - **Origin Warehouse** (where raw materials/ingredients are deducted)
  - `destinationWarehouseId` (FK → warehouses, optional) - **Destination Warehouse** (where finished goods are delivered/stocked)
  - `productId` (FK → products) - finished product being produced
  - `quantityProduced` (decimal 12,3) - planned target quantity
  - `actualQuantityProduced` (decimal 12,3, nullable) - actual quantity produced/yield upon completion
  - `status` (varchar 20, default `'completed'`) - `'pending'` | `'in_progress'` | `'completed'` | `'cancelled'`
  - `startedAt` (timestamp with time zone, nullable) - when production was started by kitchen/plant
  - `assembledAt` (timestamp with time zone, nullable) - when production was completed
  - `notes` (text, optional) - instructions, batch notes, or quality remarks
  - `createdAt` (timestamp with time zone)

#### OP Operational Workflows:
1. **Planned Production Order (OP) Workflow**:
   - **Step 1 (Creation - `pending`)**: Admin/manager plans a production batch, specifying target product, planned quantity, Origin Warehouse (raw materials), and Destination Warehouse (delivery destination). Insumos are NOT deducted yet.
   - **Step 2 (Execution - `in_progress`)**: Kitchen/plant operator starts the OP via `POST /api/inventory/production/:id/start`. Sets `startedAt = now()`.
   - **Step 3 (Completion & Yield - `completed`)**: Operator marks OP as finished via `POST /api/inventory/production/:id/complete` confirming `actualQuantityProduced`, final `destinationWarehouseId`, and yield notes.
     - Validates ingredient availability in origin warehouse.
     - Decrements ingredient stocks from Origin Warehouse (`eventType: 'production_input'`).
     - Increments finished product stock in Destination Warehouse (`eventType: 'production_output'`).
     - Updates OP record to `status: 'completed'`, `assembledAt: now()`.
   - **Cancellation (`cancelled`)**: Pending or in-progress OPs can be cancelled via `POST /api/inventory/production/:id/cancel` with zero stock impact.

2. **Direct / Express Assembly Workflow**:
   - For immediate restaurant prep (e.g. salsa batch made on the spot).
   - Created with `status: 'completed'`, performing stock validations and immediate ledger movements in a single atomic database transaction.

### 1.7 POS Order System

#### Orders Table
- **Location:** `orders` table
- **Purpose:** Restaurant/POS transactions
- **Key Fields:**
  - `id` (UUID, PK)
  - `branchId, tableId` (FK → branchTables)
  - `waiterId` (FK → users)
  - `state` - (open, billing, closed, cancelled)
  - `subtotal, discount, tax, total` (decimal 10,2)
  - Timestamps and versioning

#### Order Items Table
- **Location:** `order_items` table
- **Purpose:** Line items in orders
- **Key Fields:**
  - `orderId, productId`
  - `quantity, price`
  - `assignedGuest` - guest number
  - `isSent` - sent to kitchen
  - `notes`

#### Payments Table
- **Location:** `payments` table
- **Purpose:** Payment records for orders
- **Key Fields:**
  - `orderId`
  - `amount` (decimal 10,2)
  - `paymentMethod` - (cash, card)
  - `referenceCode` - card reference
  - `createdAt`

---

## 2. API ENDPOINTS & SERVICES

### 2.1 Inventory Management Endpoints

#### Stock Level Queries
```
GET /inventory/stock?businessId={id}&warehouseId={id}&branchId={id}
Response: Array of stock records with product name, quantity, location
```

#### Receipt Operations
```
GET /inventory/receipts?businessId={id}
  → List all purchase receipts with provider and location info

POST /inventory/receipts
Body: {
  businessId, providerId, branchId/warehouseId, documentNumber?, notes?,
  items: [{ productId, quantity, unitCost }]
}
Response: { success: true, receiptId, itemsProcessed }
```

#### Production/Assembly
```
GET /inventory/production?businessId={id}
  → List all production runs with warehouse and product details

POST /inventory/production
Body: { warehouseId, productId, quantityProduced, notes? }
Response: { success: true, productionRunId }
  Validates recipe exists and ingredients available before proceeding
```

### 2.2 Transfer Operations Endpoints

#### List Transfers
```
GET /inventory/transfers?businessId={id}
Response: Array with fromWarehouse/BranchName, toWarehouse/BranchName
```

#### Create Transfer
```
POST /inventory/transfers
Body: {
  businessId, fromWarehouseId?, fromBranchId?, toWarehouseId?, toBranchId?,
  notes?, items: [{ productId, quantity }]
}
Response: { success: true, transferId }
  Validates source has sufficient stock, updates both locations, logs movements
```

#### Transfer Reports
```
GET /inventory/reports/transfers-summary?businessId={id}&startDate={date}&endDate={date}
  → Total costs by branch receiving transfers

GET /inventory/reports/transfers-detailed?businessId={id}&branchId={id}&startDate={date}&endDate={date}
  → Detailed by product with quantities and costs
```

### 2.3 Warehouse Management

#### List/Create Warehouses
```
GET /warehouses?businessId={id}
  → All warehouses for business

POST /warehouses
Body: { businessId, name, code?, address? }
Response: Warehouse object

PATCH /warehouses/{id}
DELETE /warehouses/{id}
  → Soft delete support
```

### 2.4 Inventory Adjustment

#### Stock Adjustment
```
POST /inventory/stock/adjust
Body: {
  productId, warehouseId/branchId, quantity (absolute)
}
Response: { success: true }
  Calculates difference from current and logs adjustment movement
```

### 2.5 Inventory Service Implementation

**File:** `/apps/sync_api/src/modules/inventory/inventory.service.ts`

Key operations:
- `getStockLevels()` - query with filtering
- `recordReceipt()` - insert receipt + items + stock update + movement log (transactional)
- `assembleProduct()` - validate BOM → decrement ingredients → increment product → log
- `recordTransfer()` - validate source → decrement source → increment dest → log both movements
- `adjustStock()` - update to absolute quantity, log difference
- `getTransfersSummaryReport()` - aggregate by destination branch
- `getTransfersDetailedReport()` - aggregate by product

All operations use **database transactions** to ensure consistency.

---

## 3. FRONTEND COMPONENTS & UI

### 3.1 Inventory Management Page
**File:** `/apps/business_control_tauri/src/pages/InventoryPage.tsx`

**Tabs:**
1. **Products Tab**
   - View all products with current stock levels
   - Search and filter by category
   - Edit product details (name, cost, price, min/max stock)
   - Audit trail modal showing:
     - Current stock by location
     - Complete Kardex (movement history)
   - Create/update products

2. **Deprecated Products Tab**
   - Manage discontinued items

3. **Bulk Import Tab**
   - Upload Excel/CSV with product catalog
   - Validate before import
   - Track import history with success/error counts
   - View import details

**Features:**
- Toast notifications for async operations
- Synchronized data fetching (categories, products, providers, stock)
- Automatic stock level updates

### 3.2 Receipts (Ingresos) Page
**File:** `/apps/business_control_tauri/src/pages/ReceiptsPage.tsx`

**Left Panel - Receipt Creation:**
- Select provider from dropdown
- Select destination (branch or warehouse)
- Enter document number (invoice)
- Add line items:
  - Product autocomplete
  - Quantity input
  - Unit cost (auto-populated from product)
  - Total cost calculation
- Bulk add items
- Edit/delete line items inline
- Notes field
- Submit button (creates receipt + updates stock)

**Right Panel - Two Sub-tabs:**
1. **Stock View**
   - Current stock levels by branch/warehouse
   - Filter by location
   - Highlight low-stock items

2. **Receipt History**
   - List all receipts
   - Provider, date, location
   - Click to view receipt details

**Features:**
- Inline editing of quantity/cost
- Real-time cost calculations
- Pre-loads product costs

### 3.3 Transfers (Traspasos) Page
**File:** `/apps/business_control_tauri/src/pages/TransfersPage.tsx`

**Tabs:**

1. **Create Transfer Tab**
   - From: warehouse or branch (radio toggle)
   - To: warehouse or branch (radio toggle)
   - Product list with quantities
   - Add items with autocomplete
   - Notes
   - Submit button

2. **History Tab**
   - List all transfers
   - Source/destination info
   - Date, status
   - Item count

3. **Report - Summary Tab**
   - Date range filters
   - Total cost by destination branch
   - Aggregated view

4. **Report - Detailed Tab**
   - Date range + branch selector
   - Product-level details
   - Quantity, cost per product
   - Grouped totals

**Features:**
- Source/destination type toggling (warehouse ↔ branch)
- Multiple product addition
- Inline item management
- Real-time report generation

### 3.4 Warehouses Page
**File:** `/apps/business_control_tauri/src/pages/WarehousesPage.tsx`

**Features:**
- List all warehouses
- Create new warehouse (name, code, address)
- Edit warehouse details
- Delete (soft delete)

### 3.5 Categories, Products, Providers Pages

Standard CRUD pages for managing:
- **Categories** - product classification
- **Products** - master product catalog
- **Providers** - supplier information

---

## 4. CURRENT WORKFLOW FOR INVENTORY TRANSFERS

### 4.1 Warehouse → Branch (Distribution)

**Scenario:** Central warehouse distributes stock to retail branches

**Flow:**
1. Inventory admin opens Transfers page
2. Selects "From: Warehouse" and "To: Branch"
3. Adds products with quantities needed by branch
4. Enters notes (e.g., "Weekly replenishment")
5. Submits transfer

**Backend Process (Transactional):**
```
1. Create stock_transfer record with:
   - fromWarehouseId = central warehouse
   - toBranchId = target branch
   - status = 'completed'
   
2. For each item:
   a. Validate source warehouse has stock
   b. Decrement warehouse stock_levels
   c. Increment branch stock_levels (create if not exists)
   d. Insert stock_transfer_item with quantity & cost
   e. Log inventory_movement (transfer_out, warehouse)
   f. Log inventory_movement (transfer_in, branch)
```

**Reporting:**
- Summary: Total cost distributed to each branch (period view)
- Detailed: Products sent to specific branch (product breakdown)

### 4.2 Branch → Warehouse (Returns/Consolidation)

**Scenario:** Branch returns excess stock or slow-moving items

**Flow:** Same as above, but directions reversed
- From: Branch
- To: Warehouse

### 4.3 Receipt from Provider

**Scenario:** New purchase arrives from supplier

**Flow:**
1. Admin opens Receipts page
2. Selects provider
3. Selects destination (warehouse OR branch directly)
4. Enters invoice number
5. Adds line items (product, qty, unit cost)
6. Submits

**Backend Process (Transactional):**
```
1. Create inventory_receipt with:
   - providerId
   - destination (branchId OR warehouseId)
   - documentNumber
   
2. For each item:
   a. Create inventory_receipt_item
   b. Look up or create stock_level at destination
   c. Increment quantity
   d. Log inventory_movement (type: 'receipt')
```

### 4.4 Assembly/Production

**Scenario:** Ingredients combined to create finished product

**Flow:**
1. Admin opens Assembly page
2. Selects warehouse and product to assemble
3. Enters quantity to produce
4. Submits

**Backend Process (Transactional):**
```
1. Fetch recipe for product
2. Validate sufficient ingredients in warehouse
3. Create production_run record
4. For each ingredient:
   a. Decrement stock_level
   b. Log inventory_movement (type: 'production_input', qty: negative)
5. Increment finished product stock_level
6. Log inventory_movement (type: 'production_output', qty: positive)
```

### 4.5 Branch Organization

**Multi-Branch Network:**
- Each branch has independent stock_levels (can't see other branches' stock without permission)
- Central warehouse supplies all branches
- Transfers between branches require going through warehouse
- Each location maintains audit trail of all movements

**User Access:**
- Branch staff: see their own branch stock
- Warehouse staff: manage warehouse stock and outbound transfers
- Inventory admin: see all locations, create transfers, manage suppliers
- Admin users: full system access

---

## 5. KEY ARCHITECTURAL PATTERNS

### 5.1 Stock Level Pattern

**Rule:** One `stock_levels` row per (product, location)
- `location` = either `branchId` OR `warehouseId` (not both)
- `quantity` updated atomically on every transaction
- `updatedAt` tracks last change

**Audit:** `inventory_movements` provides complete history

### 5.2 Transaction Handling

**All inventory operations use database transactions:**
- Receipt: insert receipt → insert items → update stocks → log movements
- Transfer: validate source → decrement source → increment dest → log both sides
- Assembly: validate recipe → decrement ingredients → increment product → log all

**Failure = rollback, no partial updates**

### 5.3 Cost Tracking

**Product Level:** `products.cost` = standard cost
**Supplier Level:** `supplier_products.cost` = per-supplier cost
**Movement Level:** `inventory_movements` doesn't track cost, but:
- `stock_transfer_items` stores unitCost and totalCost at time of transfer
- `inventory_receipt_items` stores unitCost and totalCost

### 5.4 Reporting Architecture

**Summary Reports:**
- Aggregate costs by destination (transfers to branches)
- Group by time periods

**Detailed Reports:**
- Product-level breakdown
- Supports branch-specific queries
- Time range filtering

**Audit Trails:**
- Inventory movements provide complete ledger
- Can trace product through entire supply chain

---

## 6. EXISTING ORDER SYSTEM (POS)

### 6.1 Order Structure
```typescript
Order {
  id, branchId, tableId, waiterId
  state: 'open' | 'billing' | 'closed' | 'cancelled'
  subtotal, discount, tax, total (decimal 10,2)
  items: OrderItem[]
  payments: Payment[]
}

OrderItem {
  id, orderId, productId, quantity
  price (at time of order)
  assignedGuest, isSent, notes
}

Payment {
  id, orderId, amount, paymentMethod, referenceCode
}
```

### 6.2 Order Lifecycle
1. **Open**: New order created, items being added
2. **Billing**: Ready for payment
3. **Closed**: Paid, completed
4. **Cancelled**: Not completed

### 6.3 No Purchase Order System Currently

**Current inventory flow:**
- Receipts from providers (manual entry)
- Transfers between locations
- No formal purchase order workflow
- No pending/approval/receiving stages

---

## 7. IMPORTANT OBSERVATIONS FOR PURCHASE ORDERS

### 7.1 Differences from POS Orders

| Aspect | POS Orders | Purchase Orders (Needed) |
|--------|-----------|------------------------|
| Entity | Branches (customers) | Warehouses/Branches (internal) |
| Items | Finished products | Raw materials/supplies |
| Payment | Cash/Card | Credit terms with suppliers |
| Tracking | Simple (closed/open) | Complex (ordered→received→paid) |
| Quantity | Units sold | Bulk quantities |
| Unit Cost | Retail price | Wholesale/cost price |
| Frequency | Transactional | Periodic |

### 7.2 Integration Points with Existing System

**Leverage Existing:**
- `providers` table (suppliers already defined)
- `supplier_products` table (cost mapping)
- `inventory_receipts` table (can reuse for received POs)
- `stock_levels` and `inventory_movements` (update on receipt)
- Transaction pattern (atomic operations)
- Audit trail (movements logging)

**Needed Additions:**
- Purchase Order header table (`purchase_orders`)
- PO line items table (`purchase_order_items`)
- PO status workflow (draft→sent→confirmed→partial→received→paid)
- Quantity received tracking (vs ordered)
- Expected delivery dates
- Approval workflow (if needed)

### 7.3 Cost Tracking Strategy

**Current gaps:**
- Products have `cost` but no historical cost tracking
- `supplier_products.cost` could change per supplier/time
- No way to track cost variances (ordered vs actual)

**Recommendation:**
- Store confirmed cost in PO at creation time
- Track cost changes via inventory movements
- Variance analysis = PO cost vs actual receipt cost

---

## 8. RECOMMENDED PO SCHEMA ADDITIONS

```sql
-- Purchase Orders header
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY,
  businessId UUID NOT NULL,
  warehouseId UUID NOT NULL,
  providerId UUID NOT NULL,
  poNumber VARCHAR(50) UNIQUE NOT NULL,
  
  status VARCHAR(20) DEFAULT 'draft', -- draft, sent, confirmed, partial, received, invoiced, paid
  
  orderDate TIMESTAMP NOT NULL,
  expectedDeliveryDate TIMESTAMP,
  actualDeliveryDate TIMESTAMP,
  
  subtotal DECIMAL(10,2),
  tax DECIMAL(10,2),
  total DECIMAL(10,2),
  
  notes TEXT,
  createdBy UUID NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP,
  deletedAt TIMESTAMP
);

-- Purchase Order line items
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY,
  poId UUID NOT NULL,
  productId UUID NOT NULL,
  
  quantityOrdered DECIMAL(12,3) NOT NULL,
  quantityReceived DECIMAL(12,3) DEFAULT 0,
  
  unitCost DECIMAL(10,2) NOT NULL,
  totalCost DECIMAL(10,2) NOT NULL,
  
  createdAt TIMESTAMP DEFAULT NOW()
);

-- Receiving tracking (per PO item)
CREATE TABLE po_receiving_items (
  id UUID PRIMARY KEY,
  poItemId UUID NOT NULL,
  quantityReceived DECIMAL(12,3) NOT NULL,
  receivedAt TIMESTAMP DEFAULT NOW(),
  receivedBy UUID NOT NULL,
  notes TEXT
);
```

---

## 9. KEY FILES REFERENCE

### Backend (NestJS)
- **Schema:** `/apps/sync_api/src/database/schema.ts`
- **Inventory Service:** `/apps/sync_api/src/modules/inventory/inventory.service.ts`
- **Inventory Controller:** `/apps/sync_api/src/modules/inventory/inventory.controller.ts`
- **Inventory Repository:** `/apps/sync_api/src/modules/inventory/repositories/inventory.repository.ts`
- **DTOs:** `/apps/sync_api/src/modules/inventory/dto/`
- **Orders Service:** `/apps/sync_api/src/modules/orders/orders.service.ts`

### Frontend (React-Tauri)
- **Inventory Page:** `/apps/business_control_tauri/src/pages/InventoryPage.tsx`
- **Receipts Page:** `/apps/business_control_tauri/src/pages/ReceiptsPage.tsx`
- **Transfers Page:** `/apps/business_control_tauri/src/pages/TransfersPage.tsx`
- **Warehouses Page:** `/apps/business_control_tauri/src/pages/WarehousesPage.tsx`
- **API Client:** `/apps/business_control_tauri/src/services/api.ts`

### Migrations (DDL)
- **Migration 0005:** Inventory tables (receipts, transfers, production, recipes, warehouses)
- **Migration 0010:** Supplier products, stock transfer costs
- **Migration 0013:** Inventory movements (audit log)

---

## 10. SUMMARY

The POS-ERP system has a **solid foundation** for inventory management:

✅ **What's Working:**
- Multi-location stock tracking (branches + warehouses)
- Complete audit trail via inventory movements
- Transactional integrity on all operations
- Cost tracking at product and supplier levels
- Receipt and transfer workflows
- Reporting infrastructure (summary + detailed)

⚠️ **Gaps for Purchase Orders:**
- No formal PO workflow (draft → sent → received)
- No partial receipt tracking
- No supplier payment/invoice linking
- No approval routing
- No quantity variance tracking

**The existing inventory transfer and receipt patterns provide an excellent template for implementing a Purchase Orders module.**

