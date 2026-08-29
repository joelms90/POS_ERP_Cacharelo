# Phase 1 Data Model: Control Inteligente de Inventario

This document describes the new database tables for PostgreSQL (Drizzle ORM). No existing tables are modified. No local Isar models are needed (this feature is server-side only).

---

## 1. Cloud Database Schema (PostgreSQL via Drizzle)

### 1.1 Branch Stock Thresholds (`branch_stock_thresholds`)

Per-branch override for product minimum and maximum stock levels. When no row exists for a product+branch pair, the system falls back to the global `products.minStock` and `products.maxStock`.

```typescript
export const branchStockThresholds = pgTable('branch_stock_thresholds', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .references(() => products.id)
    .notNull(),
  branchId: uuid('branch_id')
    .references(() => branches.id)
    .notNull(),
  minStock: decimal('min_stock', { precision: 12, scale: 3 })
    .default('0.000'), // 0 means "use global"
  maxStock: decimal('max_stock', { precision: 12, scale: 3 })
    .default('0.000'), // 0 means "use global"
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedBy: uuid('updated_by')
    .references(() => users.id)
    .notNull(),
}, (table) => ({
  // One threshold per product per branch
  unqProductBranch: uniqueIndex('unq_bst_product_branch')
    .on(table.productId, table.branchId),
  // Fast lookup by branch for dashboard
  idxBranch: index('idx_bst_branch').on(table.branchId),
  // Fast lookup by product for threshold resolution
  idxProduct: index('idx_bst_product').on(table.productId),
}));
```

**Effective threshold resolution** (application-level logic, not SQL):

```typescript
function getEffectiveThreshold(
  branchThreshold: BranchStockThreshold | null,
  product: Product
): { minStock: number; maxStock: number } {
  const min = branchThreshold?.minStock && parseFloat(branchThreshold.minStock) > 0
    ? parseFloat(branchThreshold.minStock)
    : parseFloat(product.minStock || '0');
  const max = branchThreshold?.maxStock && parseFloat(branchThreshold.maxStock) > 0
    ? parseFloat(branchThreshold.maxStock)
    : parseFloat(product.maxStock || '0');
  return { minStock: min, maxStock: max };
}
```

---

### 1.2 Inventory Alerts (`inventory_alerts`)

Low-stock and out-of-stock detection records. Exactly one active alert per product-branch pair at any time.

```typescript
export const inventoryAlerts = pgTable('inventory_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businesses.id)
    .notNull(),
  productId: uuid('product_id')
    .references(() => products.id)
    .notNull(),
  branchId: uuid('branch_id')
    .references(() => branches.id)
    .notNull(),
  alertType: varchar('alert_type', { length: 20 })
    .notNull(), // 'low_stock' | 'out_of_stock'
  threshold: decimal('threshold', { precision: 12, scale: 3 })
    .notNull(), // The effective minStock at time of alert creation
  currentQty: decimal('current_qty', { precision: 12, scale: 3 })
    .notNull(), // Updated on each stock change while alert is active
  status: varchar('status', { length: 20 })
    .default('active')
    .notNull(), // 'active' | 'acknowledged' | 'resolved'
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  acknowledgedBy: uuid('acknowledged_by')
    .references(() => users.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (table) => ({
  // Only ONE active/acknowledged alert per product+branch
  unqActiveAlert: uniqueIndex('unq_ia_product_branch_active')
    .on(table.productId, table.branchId)
    .where(sql`${table.status} IN ('active', 'acknowledged')`),
  // Fast dashboard queries: active alerts by business
  idxBusinessStatus: index('idx_ia_business_status')
    .on(table.businessId, table.status),
  // Fast dashboard queries: active alerts by branch
  idxBranchStatus: index('idx_ia_branch_status')
    .on(table.branchId, table.status),
  // Lookup by product for dedup checks
  idxProduct: index('idx_ia_product').on(table.productId),
}));
```

**Alert lifecycle** (application-level logic):

```
Stock drops below minStock
  → CREATE alert (status='active', alertType='low_stock' | 'out_of_stock')
  → IF auto-requisition enabled → CREATE requisition

Stock changes further (still below min)
  → UPDATE alert.currentQty

Stock rises to or above minStock
  → UPDATE alert.status='resolved', alert.resolvedAt=now()

User views alert in dashboard
  → UPDATE alert.status='acknowledged', alert.acknowledgedAt=now()
```

**Deduplication**: The partial unique index `unq_ia_product_branch_active` ensures only one `active` or `acknowledged` alert exists per product+branch pair. The application also checks before creating to handle race conditions gracefully.

---

### 1.3 Business Inventory Settings (`business_inventory_settings`)

Per-business configuration flags controlling inventory automation behavior. One row per business (optional, defaults apply if no row exists).

```typescript
export const businessInventorySettings = pgTable('business_inventory_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .references(() => businesses.id)
    .unique()
    .notNull(),
  autoRequisitionEnabled: boolean('auto_requisition_enabled')
    .default(false)
    .notNull(),
  defaultWarehouseId: uuid('default_warehouse_id')
    .references(() => warehouses.id),
  alertEngineIntervalMinutes: integer('alert_engine_interval_minutes')
    .default(15)
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedBy: uuid('updated_by')
    .references(() => users.id),
});
```

**Default behavior** (when no row exists for a business):
- `autoRequisitionEnabled`: `false` (no auto-generation)
- `defaultWarehouseId`: first active warehouse found for the business
- `alertEngineIntervalMinutes`: `15`

---

## 2. Relationships Diagram

```
┌─────────────────────┐     ┌──────────────────────────────┐
│     products        │     │  branch_stock_thresholds     │
│  - minStock         │◄────│  - productId (FK)           │
│  - maxStock         │     │  - branchId (FK)             │
└─────────────────────┘     │  - minStock (override)       │
                            │  - maxStock (override)       │
┌─────────────────────┐     └──────────┬───────────────────┘
│     stockLevels     │                │
│  - productId (FK)   │                │  (fallback: if no threshold row,
│  - branchId (FK)    │                │   use products.minStock/maxStock)
│  - quantity         │                │
└─────────┬───────────┘                │
          │                            │
          │ (alert engine compares     │
          │  stockLevels.quantity      │
          │  vs effectiveThreshold)    │
          ▼                            │
┌──────────────────────────────────────┴───────────┐
│              inventory_alerts                    │
│  - productId, branchId, businessId               │
│  - alertType (low_stock|out_of_stock)            │
│  - threshold, currentQty                         │
│  - status (active|acknowledged|resolved)         │
└──────┬───────────────────────────────────────────┘
       │
       │ ("Generar Requisición" button
       │  or auto-requisition enabled)
       ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  branch_requisitions     │    │  business_inventory_     │
│  (existing table,        │    │  settings                │
│   reused as-is)          │    │  - autoRequisitionEnabled│
└──────────────────────────┘    │  - defaultWarehouseId    │
                                └──────────────────────────┘

Auto-PO Engine (separate flow):
  Global stock (SUM of stockLevels for product) < products.minStock
    → Find cheapest provider in supplierProducts
    → Create draft purchaseOrders + purchaseOrderItems
```

---

## 3. No Local/Flutter Models

This feature is entirely server-side plus admin dashboard. No Isar models are needed. The Flutter POS already syncs inventory movements and sales; those syncs trigger the existing `inventoryMovements` entries which the alert engine monitors.

---

## 4. Migration Notes

All three tables are new (not modifying existing tables). Migration should:

1. Create `branch_stock_thresholds` table
2. Create `inventory_alerts` table
3. Create `business_inventory_settings` table

Rollback is safe: dropping these tables has no impact on existing functionality. No data migration needed for existing tables.
