# Sync API Architecture Overview

## Executive Summary

The `sync_api` is a NestJS-based backend service that manages a multi-tenant POS/ERP system. It handles:
- Inventory and stock management
- Product catalog with categories and providers
- Data synchronization between server and Flutter tablets
- Order processing and payment workflows
- Recipe/Bill of Materials (BOM) management
- Warehouse and branch management

**Key Observation**: There are NO existing bulk import/upload features. Individual operations are implemented via transactional endpoints.

---

## 1. Module Architecture

### Core Modules (15 total)

| Module | Purpose |
|--------|---------|
| **auth** | User authentication, JWT, device login |
| **sync** | Core data sync (push/pull/ack) for tablet synchronization |
| **catalog** | Products and Categories management |
| **inventory** | Stock levels, receipts, production runs |
| **warehouses** | Warehouse management and organization |
| **branches** | Business branch management and tables |
| **providers** | Supplier/vendor management |
| **recipes** | Bill of Materials (BOM) - ingredient combinations |
| **orders** | POS order processing and items |
| **kitchen** | Kitchen ticket management (KDS) |
| **shifts** | Cash shift and transaction management |
| **users** | User management and roles |
| **inquiries** | Additional data queries |
| **database** | Database connection and schema |

---

## 2. Database Schema - Key Tables for Inventory

### Business Organization Hierarchy
```
businesses (multi-tenant root)
├── branches (per-business locations)
├── branch_tables (dining tables per branch)
├── users (employees, scoped to business/branch)
├── devices (tablets/POS terminals)
└── warehouses (central storage per business)
```

### Inventory Core Tables

#### Stock Management
- **stockLevels** (main inventory)
  - Fields: `productId, quantity (decimal 12.3), branchId/warehouseId, updatedAt`
  - Location: Stock can exist at branch OR warehouse level
  - Precision: 3 decimal places for precise measurements

- **products** (catalog items)
  - Fields: `id, businessId, categoryId, providerId, name, sku, barcode, cost, price, isSellable, isIngredient, version`
  - Supports: Individual products OR recipe ingredients
  - Pricing: Cost and retail price stored

- **categories** (product grouping)
  - Fields: `id, businessId, name, description, version`

#### Receipt Management
- **inventoryReceipts** (incoming goods documentation)
  - Fields: `id, businessId, providerId, branchId/warehouseId, documentNumber, receivedAt, notes`

- **inventoryReceiptItems** (line items in receipts)
  - Fields: `id, receiptId, productId, quantity, unitCost, totalCost`
  - Automatic stock level updates via transaction

#### Production (BOM Fulfillment)
- **recipes** (Bill of Materials definition)
  - Fields: `id, parentProductId, ingredientProductId, quantityNeeded`
  - Enables assembly of finished goods from ingredients

- **productionRuns** (assembly execution)
  - Fields: `id, warehouseId, productId, quantityProduced, assembledAt, notes`
  - Transaction includes: ingredient decrement + parent product increment

#### Transfers (Inter-location Movement)
- **stockTransfers** (warehouse-to-warehouse or warehouse-to-branch)
  - Fields: `id, businessId, fromWarehouseId, fromBranchId, toWarehouseId, toBranchId, status, notes`

- **stockTransferItems** (items per transfer)
  - Fields: `id, transferId, productId, quantity`

### Order Processing Tables (for context)
- **orders**: POS orders with state (open → billing → closed)
- **orderItems**: Individual products ordered
- **payments**: Payment records (immutable logs)
- **cashShifts** & **cashTransactions**: Financial tracking

---

## 3. Current API Endpoints

### Inventory Endpoints (`/api/inventory`)
```
GET  /inventory/stock
     Query: businessId, warehouseId?, branchId?
     Returns: Stock levels with product details

GET  /inventory/receipts
     Query: businessId
     Returns: Purchase receipts with provider info

POST /inventory/receipts
     Body: CreateReceiptDto (see below)
     Creates receipt + updates stock in transaction

GET  /inventory/production
     Query: businessId
     Returns: Production run history

POST /inventory/production
     Body: CreateProductionRunDto
     Validates BOM, decrements ingredients, increments parent
```

### Catalog Endpoints (`/api/products`, `/api/categories`)
```
GET  /products?businessId=&categoryId=
POST /products
PATCH /products/:id
DELETE /products/:id

GET  /categories?businessId=
POST /categories
PATCH /categories/:id
DELETE /categories/:id
```

### Providers Endpoints (`/api/providers`)
```
GET  /providers?businessId=
POST /providers
PATCH /providers/:id
DELETE /providers/:id
```

### Recipes Endpoints (`/api/recipes`)
```
GET  /recipes?productId=
     Returns: Ingredient list for assembled product

POST /recipes
     Sets recipe for a product (parent + ingredients)
```

### Warehouses Endpoints (`/api/warehouses`)
```
GET  /warehouses?businessId=
POST /warehouses
PATCH /warehouses/:id
DELETE /warehouses/:id
```

### Sync Endpoints (`/api/sync`)
```
POST /sync/push
     Body: PushSyncDto (orders, orderItems, payments, cashShifts, cashTransactions)
     Action: Atomic upsert from tablet

POST /sync/pull
     Body: PullSyncDto { lastSyncedAt?: ISO-8601 }
     Returns: All changes since lastSyncedAt across all tables

POST /sync/ack
     Body: AckSyncDto { deviceId, lastSyncedAt }
     Action: Records sync checkpoint for device
```

---

## 4. Data Sync Architecture (Tablet ↔ Server)

### Sync Flow
```
Tablet (Flutter App)
   ↓
[1] POST /sync/push (orders, orderItems, payments, cashShifts from offline)
   ↓
Server: Atomic upsert + transaction
   ↓
[2] POST /sync/pull (retrieve changes since lastSyncedAt)
   ↓
Server: Query all tables WHERE updatedAt/createdAt > lastSyncedAt
Returns: businesses, branches, branchTables, users, categories, 
         products, orders, orderItems, payments, cashShifts, cashTransactions
   ↓
[3] POST /sync/ack (confirm receipt of changes)
   ↓
Server: Store deviceSyncCheckpoints for resumption
```

### Sync Strategy
- **Ordered data** (products, categories): Query via `updatedAt`
- **Immutable logs** (payments, cashTransactions): Query via `createdAt`
- **Partial sync**: Only return changes since `lastSyncedAt`
- **Device tracking**: `deviceSyncCheckpoints` prevents re-syncing
- **Security**: PINs and password hashes stripped from `users` before push

### Transactional Safety
- Conflicts handled with `onConflictDoUpdate` (upsert)
- Payments/transactions use `onConflictDoNothing()` (append-only)
- Database transactions ensure atomicity

---

## 5. Inventory Management - Current Flows

### A. Recording Stock Receipt (Inbound)
```
POST /inventory/receipts
Input:
{
  businessId: UUID,
  providerId: UUID,
  branchId?: UUID,        // EITHER branch OR warehouse
  warehouseId?: UUID,
  documentNumber?: string,
  notes?: string,
  items: [
    { productId: UUID, quantity: number, unitCost: number }
  ]
}

Transaction:
1. Validate provider exists
2. Ensure branchId XOR warehouseId (not both/neither)
3. Insert inventoryReceipts record
4. For each item:
   a. Insert inventoryReceiptItems (calculates totalCost)
   b. Query stockLevels for product + location
   c. IF EXISTS: UPDATE quantity += received
      ELSE: INSERT new stockLevel row
5. Return: { success, receiptId, itemsProcessed }
```

### B. Production Run (BOM Assembly)
```
POST /inventory/production
Input:
{
  warehouseId: UUID,
  productId: UUID (must have recipe),
  quantityProduced: number,
  notes?: string
}

Flow:
1. Query recipes WHERE parentProductId = productId
   - Must have at least one ingredient
   - Returns: ingredientProductId, quantityNeeded
2. Validate stock for each ingredient:
   - required = quantityNeeded * quantityProduced
   - actual = stockLevel.quantity in warehouse
   - Throw error if insufficient
3. Transaction:
   a. For each ingredient: UPDATE stockLevels -= (quantityNeeded * qty)
   b. For parent product: UPDATE/INSERT stockLevels += quantityProduced
   c. INSERT productionRuns record
4. Return: { success, productionRunId }
```

### C. Query Stock Levels
```
GET /inventory/stock?businessId=X&warehouseId=Y&branchId=Z
Query strategy:
- Filter by businessId (required)
- Optionally filter by warehouseId OR branchId
- Join: stockLevels → products
- Select: id, productId, productName, isIngredient, quantity, warehouseId, branchId
```

### D. Query Receipts
```
GET /inventory/receipts?businessId=X
Returns:
- receiptId, providerName, documentNumber, receivedAt, notes
- warehouseName/branchName (joined from receipts)
- Sorted by timestamp
```

---

## 6. Product/Catalog Management

### Product Creation
```
POST /products
Input:
{
  businessId: UUID,
  categoryId: UUID (must exist),
  providerId?: UUID (optional, must exist if provided),
  name: string (2-150 chars),
  sku?: string,
  barcode?: string,
  cost?: numeric string,
  price?: numeric string,
  isSellable?: boolean (default: true),
  isIngredient?: boolean (default: false)
}

Validations:
- Category must exist
- Provider must exist (if provided)
- Soft delete supported (deletedAt field)
```

### Product Versioning
- All product records include `version` integer (default: 1)
- Updated via sync mechanism
- Enables conflict detection in distributed systems

---

## 7. Business/Organization Structure

### Multi-Tenancy Model
```
Business (Root entity)
├── name, taxId, isActive
├── Branches (multiple per business)
│   ├── name, address, phone
│   ├── BranchTables (for restaurants)
│   │   ├── label (e.g., "Mesa 1")
│   │   ├── capacity
│   │   ├── room (e.g., "Terraza")
│   │   └── state (free|occupied|billing|cleaning)
│   ├── Users (employees)
│   │   ├── name, email, pin
│   │   ├── role (waiter, cashier, kitchen, admin)
│   │   ├── passwordHash
│   │   └── businessId (nullable for system admins)
│   └── Devices (tablets/POS terminals)
│       ├── deviceUuid (unique device identifier)
│       ├── name (e.g., "Tablet Mesero 1")
│       ├── role (ordering, kds, cashier)
│       ├── lastSyncAt
│       └── isActive
│
├── Warehouses (central storage)
│   ├── name, code, address
│   ├── isActive
│   └── Stock stored here
│
├── Products (catalog)
│   ├── categoryId
│   ├── providerId (optional)
│   ├── sku, barcode
│   ├── cost, price
│   ├── isSellable, isIngredient flags
│   └── version (for sync)
│
├── Providers (suppliers)
│   ├── name, contactName, email, phone
│   └── address
│
└── Categories
    ├── name
    └── description
```

### Data Scoping
- **Products**: Scoped to business
- **Stock**: Can exist at warehouse OR branch (not both)
- **Users**: Scoped to business + optional branch
- **Categories**: Business-specific
- **Providers**: Business-specific

---

## 8. Key Design Patterns

### Pattern 1: Transactional Operations
- Inventory receipts, production runs, stock transfers use DB transactions
- Ensures consistency: receipt + stock update atomic
- Guards against partial failures

### Pattern 2: Soft Deletes
- Products use soft delete (deletedAt field)
- Queries filter: WHERE deletedAt IS NULL
- Enables audit trail and recovery

### Pattern 3: Version Fields
- Products, branches, users, categories have `version: integer`
- Supports optimistic locking in distributed sync
- Prevents overwriting newer changes

### Pattern 4: Timestamp Tracking
- All entities have `createdAt`, `updatedAt`, optional `deletedAt`
- Sync uses `updatedAt` for delta queries
- Immutable logs (payments) use `createdAt`

### Pattern 5: Upsert Handling
- Sync service uses Drizzle's `onConflictDoUpdate` for idempotency
- Mutable data (orders, cashShifts): update on conflict
- Immutable logs (payments): `onConflictDoNothing()`

---

## 9. Current Limitations & Gaps

### NO Bulk Features Exist
1. No bulk product import (CSV, Excel)
2. No bulk inventory upload
3. No batch stock level updates
4. No bulk receipt generation
5. No batch categorization

### Transactional Constraints
- Receipt creation: One receipt per request
- Product creation: One product per request
- Stock transfer: Requires manual transfer creation

### Sync Limitations
- Pull sync returns ALL changes (no per-table filtering yet)
- Sync DTOs use `any[]` (weak typing on sync payloads)
- No compression or pagination for large syncs

### Query Limitations
- No full-text search on products
- No stock level aggregations (sum by category, etc.)
- No forecasting/low-stock alerts

---

## 10. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    NestJS Sync API                          │
├─────────────────────────────────────────────────────────────┤
│  Controllers (HTTP Endpoints)                               │
│  ├─ /inventory  ├─ /products  ├─ /categories              │
│  ├─ /sync       ├─ /providers ├─ /warehouses              │
│  └─ /recipes    ├─ /branches  └─ ...                       │
├─────────────────────────────────────────────────────────────┤
│  Services (Business Logic)                                  │
│  ├─ InventoryService   ├─ ProductsService                 │
│  ├─ SyncService        ├─ RecipesService                   │
│  ├─ WarehousesService  ├─ ProvidersService                │
│  └─ ...                                                     │
├─────────────────────────────────────────────────────────────┤
│  Repositories (Data Access)                                 │
│  ├─ InventoryRepository    ├─ ProductsRepository          │
│  ├─ CategoriesRepository   ├─ ProvidersRepository         │
│  ├─ WarehousesRepository   └─ ...                         │
├─────────────────────────────────────────────────────────────┤
│  Drizzle ORM (Query Builder)                               │
│  └─ Typed schema from database/schema.ts                   │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL Database                                        │
│  ├─ businesses, branches, users, devices                   │
│  ├─ products, categories, providers                        │
│  ├─ stockLevels, inventoryReceipts, recipes               │
│  ├─ orders, orderItems, payments                           │
│  ├─ warehouses, stockTransfers, productionRuns            │
│  └─ devices, sync checkpoints, shifts, kitchen tickets    │
└─────────────────────────────────────────────────────────────┘
     ↑                                      ↑
     │ HTTP (REST)                         │ TCP/Pool
     │                                      │
  Flutter Tablets (Tablets/Terminals)    PostgreSQL Server
  - Sync push (offline data)
  - Sync pull (updates)
  - Order entry
  - Payments
```

---

## 11. Technology Stack

| Layer | Technology |
|-------|------------|
| **Framework** | NestJS 11.0.1 |
| **Database ORM** | Drizzle 0.45.2 |
| **Database** | PostgreSQL 8.22.0 |
| **Validation** | class-validator, class-transformer |
| **Authentication** | @nestjs/jwt 11.0.2 |
| **Hashing** | bcrypt 6.0.0 |
| **API** | @nestjs/platform-express |
| **Testing** | Jest 30.0.0 |
| **Type Safety** | TypeScript 5.7.3 |

---

## 12. Data Types & Precision

### Numeric Precision
- **Prices/Costs**: `decimal(10, 2)` = $999,999.99 max
- **Quantities**: `decimal(12, 3)` = 999,999,999.999 units (supports fractional units like ml, kg)
- **Stock movements** support precise measurements (e.g., 0.250 kg)

### Timestamps
- All use `timestamp with timezone`
- Sync queries rely on `updatedAt` for delta identification
- Immutable logs (payments) indexed on `createdAt`

---

## 13. Recommended Starting Point for Bulk Import

To implement a bulk inventory upload feature:

1. **Create new endpoint**: `POST /inventory/bulk-receipt`
   - Accept array of receipt items
   - Or leverage multer for CSV upload

2. **Add DTO validation**: 
   - `BulkReceiptDto { receipts: CreateReceiptDto[] }`
   - Batch processing with rollback capability

3. **Process in batches**:
   - Transaction per N items
   - Progress tracking
   - Error collection and rollback

4. **Response format**:
   - Success count
   - Failure list with line numbers
   - Overall status

5. **Consider pagination**:
   - Split large uploads (>1000 items) into multiple requests
   - Return partial success status

---

## 14. Migration/Schema Evolution

Migrations stored in: `/apps/sync_api/migrations/`
- Uses Drizzle migrations
- Auto-run on startup via `runMigrations()`
- Snapshots in `migrations/meta/`
