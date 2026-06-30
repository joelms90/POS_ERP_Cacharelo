# Sync API - Quick Reference Guide

## Module Structure at a Glance

### 15 Modules Total

```
auth/              - Authentication & JWT
sync/              - Tablet data synchronization (push/pull/ack)
catalog/           - Products & Categories
inventory/         - Stock, receipts, production
warehouses/        - Warehouse management
branches/          - Business branch management
providers/         - Supplier management
recipes/           - Bill of Materials (BOM)
orders/            - POS orders
kitchen/           - Kitchen Display System (KDS)
shifts/            - Cash management
users/             - User management
inquiries/         - Data queries
database/          - PostgreSQL connection & schema
```

## API Endpoints by Module

### Inventory (`/api/inventory`)
- `GET /stock?businessId=X&warehouseId=Y&branchId=Z` - Query stock levels
- `GET /receipts?businessId=X` - Get purchase receipts
- `POST /receipts` - Record inbound inventory
- `GET /production?businessId=X` - Get production runs
- `POST /production` - Create production run (BOM assembly)

### Products (`/api/products`)
- `GET /?businessId=X&categoryId=Y` - List products
- `GET /:id` - Get product
- `POST` - Create product
- `PATCH /:id` - Update product
- `DELETE /:id` - Delete product (soft delete)

### Categories (`/api/categories`)
- `GET /?businessId=X`
- `GET /:id`
- `POST`
- `PATCH /:id`
- `DELETE /:id`

### Warehouses (`/api/warehouses`)
- `GET /?businessId=X`
- `GET /:id`
- `POST`
- `PATCH /:id`
- `DELETE /:id`

### Providers (`/api/providers`)
- `GET /?businessId=X`
- `GET /:id`
- `POST`
- `PATCH /:id`
- `DELETE /:id`

### Recipes (`/api/recipes`)
- `GET ?productId=X` - Get recipe for product
- `POST` - Set recipe

### Sync (`/api/sync`)
- `POST /push` - Push offline changes from tablet
- `POST /pull` - Pull changes since last sync
- `POST /ack` - Acknowledge sync receipt

## Database Tables - Inventory Focus

### Core Inventory Tables
| Table | Rows | Purpose |
|-------|------|---------|
| `products` | ~1000s | Catalog items |
| `stockLevels` | ~1000s | Live inventory (per product per location) |
| `categories` | ~10s | Product grouping |
| `providers` | ~10s | Suppliers |
| `warehouses` | ~10s | Storage locations |
| `branches` | ~10s | Business locations |
| `businesses` | ~1s | Tenants |

### Inventory Transaction Tables
| Table | Rows | Purpose |
|-------|------|---------|
| `inventoryReceipts` | ~100s/month | Inbound documents |
| `inventoryReceiptItems` | ~1000s/month | Receipt line items |
| `recipes` | ~100s | BOM definitions |
| `productionRuns` | ~100s/month | Assembly executions |
| `stockTransfers` | ~100s/month | Inter-location movements |

### Order Processing Tables
| Table | Purpose |
|-------|---------|
| `orders` | POS orders |
| `orderItems` | Order line items |
| `payments` | Payment records (append-only log) |
| `cashShifts` | Shift records |
| `cashTransactions` | Financial transactions (append-only log) |

## Data Types

### Decimal Precision
- **Prices**: `decimal(10,2)` = up to 99,999.99
- **Quantities**: `decimal(12,3)` = up to 999,999,999.999 with 3 decimal places
- **Supports fractional measurements**: 0.250 kg, 0.5 L, etc.

### Key Timestamps
- `createdAt` - Record creation (immutable)
- `updatedAt` - Last modification (updated on each change)
- `deletedAt` - Soft delete marker (nullable)

### Business Organization
```
Business (tenant root)
├── Branches (multiple locations)
│   ├── Branch Tables (dining areas)
│   ├── Users (employees)
│   └── Devices (tablets/terminals)
├── Warehouses (storage)
├── Products (catalog, scoped to business)
├── Categories (scoped to business)
├── Providers (suppliers, scoped to business)
└── Stock Levels (per product per warehouse/branch)
```

## Current Operations

### Recording Inbound Inventory
```typescript
POST /inventory/receipts
{
  businessId: "uuid",
  providerId: "uuid",
  branchId: "uuid" OR warehouseId: "uuid",  // NOT both
  documentNumber: "PO-2025-001",
  items: [
    { productId: "uuid", quantity: 100, unitCost: 5.00 },
    { productId: "uuid", quantity: 50, unitCost: 10.00 }
  ]
}

Response:
{
  success: true,
  receiptId: "uuid",
  itemsProcessed: 2
}

Side Effects:
- Creates receipt record
- Creates receipt items
- Updates stock levels (creates if doesn't exist)
```

### Production Run (BOM Assembly)
```typescript
POST /inventory/production
{
  warehouseId: "uuid",
  productId: "uuid",  // Must have recipe
  quantityProduced: 10,
  notes: "Batch #42"
}

Response:
{
  success: true,
  productionRunId: "uuid"
}

Side Effects:
- Validates recipe exists
- Checks ingredient stock
- Decrements all ingredients
- Increments finished product
- Logs production run
```

### Data Sync (Tablet)
```typescript
// 1. Push offline changes
POST /sync/push
{
  orders: [...],
  orderItems: [...],
  payments: [...],
  cashShifts: [...],
  cashTransactions: [...]
}

// 2. Pull changes since last sync
POST /sync/pull
{
  lastSyncedAt: "2025-06-30T12:00:00Z"
}

Response:
{
  timestamp: "2025-06-30T12:05:00Z",
  changes: {
    businesses: [],
    branches: [],
    products: [],
    categories: [],
    // ... all tables
  }
}

// 3. Acknowledge receipt
POST /sync/ack
{
  deviceId: "tablet-uuid",
  lastSyncedAt: "2025-06-30T12:05:00Z"
}
```

## Transaction Patterns

### Atomic Receipt Creation
```typescript
db.transaction(async (tx) => {
  // All succeed or all rollback
  const receipt = await tx.insert(inventoryReceipts).values(...);
  for (each item) {
    await tx.insert(inventoryReceiptItems).values(...);
    await tx.insert/update(stockLevels);
  }
});
```

### Conditional Updates
```typescript
// Check if stock exists
const existing = await db.select().from(stockLevels).where(...);

if (existing.length > 0) {
  // Update existing
  await db.update(stockLevels).set({ quantity: newQty });
} else {
  // Insert new
  await db.insert(stockLevels).values({ quantity: newQty });
}
```

### Upsert with Conflict Handling
```typescript
await tx.insert(orders)
  .values(orderData)
  .onConflictDoUpdate({
    target: orders.id,
    set: { state: sql`excluded.state`, updatedAt: sql`excluded.updated_at` }
  });
```

## Queries

### Get Stock for Business + Location
```sql
SELECT 
  sl.id, sl.product_id, p.name, sl.quantity, 
  sl.warehouse_id, sl.branch_id
FROM stock_levels sl
INNER JOIN products p ON sl.product_id = p.id
WHERE p.business_id = ? AND (sl.warehouse_id = ? OR sl.branch_id = ?)
```

### Get Receipt with Provider Details
```sql
SELECT 
  ir.id, ir.document_number, ir.received_at,
  pr.name AS provider_name,
  w.name AS warehouse_name
FROM inventory_receipts ir
INNER JOIN providers pr ON ir.provider_id = pr.id
LEFT JOIN warehouses w ON ir.warehouse_id = w.id
WHERE ir.business_id = ?
```

### Get Recipe Components
```sql
SELECT 
  r.ingredient_product_id, r.quantity_needed,
  p.name AS ingredient_name
FROM recipes r
INNER JOIN products p ON r.ingredient_product_id = p.id
WHERE r.parent_product_id = ?
```

## Validation Rules

### Stock Receipt
- Must specify EITHER `branchId` OR `warehouseId`, not both
- Provider must exist
- All products in items must exist
- All quantities must be positive

### Product Creation
- Category must exist
- Provider must exist (if provided)
- Name: 2-150 characters
- Default: isSellable=true, isIngredient=false

### Production Run
- Warehouse must exist
- Product must exist and have a recipe
- All recipe ingredients must exist
- Stock for each ingredient >= required quantity

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Category/Provider not found | Invalid reference ID | Verify ID exists in DB |
| Stock insuficient | BOM assembly failed | Check ingredient stock |
| Must specify branchId OR warehouseId | Receipt validation | Provide one location |
| Product has no recipe | Production run failed | Set recipe first |
| Duplicate SKU | (Not enforced yet) | Consider adding unique constraint |

## Key Files to Modify for Bulk Feature

### To Add Bulk Products
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/catalog/products.service.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/catalog/products.controller.ts`
- Create: `.../catalog/dto/bulk-products.dto.ts`

### To Add Bulk Receipts
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/inventory/inventory.service.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/inventory/inventory.controller.ts`
- Create: `.../inventory/dto/bulk-receipt.dto.ts`

### To Add Bulk Stock Upload
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/inventory/inventory.service.ts`
- Create: `.../inventory/dto/bulk-stock-levels.dto.ts`

## Performance Considerations

### Current Bottlenecks
1. N+1 queries in repository joins (not using select optimization)
2. No pagination on pull sync (returns all changes)
3. No indexing strategy documented
4. Large batches hit transaction timeout

### For Bulk Uploads
1. Batch size limit: ~1000 items per request
2. Use transactions for atomicity
3. Pre-validate before inserting
4. Return partial success when safe
5. Consider async processing for very large batches

## Security Notes

1. Soft deletes preserve audit trail
2. PIN/password hashes stripped before push sync
3. Business ID scoping prevents cross-tenant leaks
4. Role-based access (not yet implemented)
5. No rate limiting on bulk endpoints (add this!)

---

**Last Updated**: June 30, 2026
**Status**: Architecture stable, ready for bulk feature enhancement
