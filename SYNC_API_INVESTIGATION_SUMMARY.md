# Sync API Architecture Investigation - Complete Summary

## Overview

You have a well-structured NestJS backend (`sync_api`) managing a multi-tenant POS/ERP system for restaurants and cafeterias. The system handles inventory, products, orders, and data synchronization between Flutter tablets and a PostgreSQL server.

## Key Findings

### 1. No Bulk Upload Features Exist

The API is built around single-operation endpoints:
- Create 1 product at a time
- Create 1 inventory receipt at a time
- No CSV/Excel import
- No batch product upload
- No bulk stock level updates

This is YOUR opportunity to design and implement the bulk inventory feature!

### 2. Architecture is Modular & Scalable

15 distinct modules with clear separation of concerns:
- **Inventory Module**: Stock management, receipts, production runs
- **Catalog Module**: Products and categories
- **Sync Module**: Bidirectional data sync for tablets
- **Supporting Modules**: Warehouses, providers, recipes, branches, orders, etc.

### 3. Database Design is Production-Ready

PostgreSQL with Drizzle ORM provides:
- Strong typing via TypeScript schema definitions
- Transactional safety (atomic operations)
- Soft deletes for audit trail
- Version fields for conflict detection
- Multi-tenant isolation (business ID scoping)

### 4. Data Sync is Sophisticated

Three-phase sync mechanism:
1. **Push**: Tablets send offline changes (orders, payments)
2. **Pull**: Server returns all changes since last sync
3. **ACK**: Device acknowledges receipt (prevents re-syncing)

Security: Sensitive fields (passwords, PINs) stripped before sending to tablets.

## Architecture Layers

```
HTTP REST Layer (Controllers)
    ↓
Business Logic Layer (Services)
    ↓
Data Access Layer (Repositories)
    ↓
Database Query Layer (Drizzle ORM)
    ↓
PostgreSQL Database
```

Each module follows this pattern with dependency injection via NestJS.

## Inventory Management Flow

### Stock Levels
- Live inventory tracked per product per location (warehouse OR branch)
- Precision: 3 decimal places (supports fractional units)
- Updated atomically on:
  - Inbound receipts (received inventory)
  - BOM assembly (ingredients consumed, finished goods created)
  - Stock transfers (inter-warehouse movements)

### Receipts (Inbound Goods)
```
Receipt Document
├── Provider, warehouse/branch, notes
└── Line Items
    ├── Product 1: Qty 100 @ $5.00 = $500
    ├── Product 2: Qty 50 @ $10.00 = $500
    └── Stock levels auto-updated (+100 for P1, +50 for P2)
```

### Production Runs (BOM Assembly)
```
Finished Product Recipe
├── Ingredient 1: 2 units needed per batch
├── Ingredient 2: 0.5 units needed per batch
└── On assembly of 10 units:
    ├── Decrement: Ingredient 1 by 20, Ingredient 2 by 5
    └── Increment: Finished Product by 10
```

### Query Patterns
- Get stock for a business
- Filter by warehouse or branch
- Get receipt history with provider details
- Get production run audit trail

## Key Tables for Bulk Import Planning

| Table | Purpose | Batch Consideration |
|-------|---------|---------------------|
| **products** | Catalog items | Bulk create from CSV |
| **stockLevels** | Current inventory | Bulk upload initial levels |
| **categories** | Product grouping | Pre-create or bulk load |
| **providers** | Suppliers | Reference for receipts |
| **inventoryReceipts** | Inbound docs | Bulk create from PO/manifest |
| **inventoryReceiptItems** | Line items | Attached to receipts |

## Recommended Bulk Upload Approach

### 1. Bulk Product Import
- Accept CSV with columns: `name, sku, barcode, categoryId, providerId?, cost, price, isSellable, isIngredient`
- Validate all rows before transaction
- Create in single batch transaction
- Return success/failure per row

### 2. Bulk Inventory Upload
- Accept CSV with columns: `productId, quantity, warehouseId/branchId`
- Validate product existence + location validity
- Create/update stockLevels in transaction
- Atomicity ensures consistency

### 3. Bulk Receipt Import
- Accept receipt data with line items
- Create receipt + all items in single transaction
- Auto-update stock levels
- Document import source for audit trail

### 4. Implementation Strategy

**Endpoint Design**:
```
POST /inventory/bulk-receipts
POST /products/bulk-import
POST /inventory/bulk-stock-levels
```

**DTO Pattern**:
```typescript
class BulkReceiptImportDto {
  businessId: UUID;
  receipts: CreateReceiptDto[];  // Array of existing DTO
}

class BulkImportResponse {
  successful: number;
  failed: number;
  errors: { row: number, message: string }[];
  receiptIds?: UUID[];  // If all succeeded
}
```

**Service Pattern**:
```typescript
async bulkImportReceipts(dto: BulkReceiptImportDto) {
  const errors = [];
  const results = [];

  // Pre-validation pass
  for (let i = 0; i < dto.receipts.length; i++) {
    const receipt = dto.receipts[i];
    // Validate provider, items, etc.
    if (error) errors.push({ row: i+1, message: error });
  }

  if (errors.length > 0) {
    return { successful: 0, failed: dto.receipts.length, errors };
  }

  // Transaction: process all receipts
  return db.transaction(async (tx) => {
    for (const receipt of dto.receipts) {
      const result = await this.recordReceiptInTx(tx, receipt);
      results.push(result);
    }
    return { successful: results.length, failed: 0, receiptIds: results };
  });
}
```

## File Locations (Absolute Paths)

### Core Schema
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/database/schema.ts`

### Inventory Module
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/inventory/inventory.controller.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/inventory/inventory.service.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/inventory/repositories/inventory.repository.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/inventory/dto/create-receipt.dto.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/inventory/inventory.module.ts`

### Catalog Module
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/catalog/products.service.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/catalog/products.controller.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/catalog/repositories/products.repository.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/catalog/dto/create-product.dto.ts`

### Sync Module
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/sync/sync.service.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/sync/sync.controller.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/sync/dto/push-sync.dto.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/sync/dto/pull-sync.dto.ts`

### Root
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/app.module.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/main.ts`

## Dependencies

**Production**:
- NestJS 11.0.1
- Drizzle ORM 0.45.2
- PostgreSQL 8.22.0
- class-validator, class-transformer
- JWT, bcrypt

**Development**:
- TypeScript 5.7.3
- Jest 30.0.0
- Prettier, ESLint

## Next Steps for Bulk Import Feature

1. **Design Phase**:
   - Decide: CSV upload vs JSON batch endpoint?
   - Error handling: Fail fast vs partial success?
   - Progress tracking: Need polling/webhooks?

2. **Implementation Phase**:
   - Create DTOs for bulk operations
   - Extend inventory/catalog services
   - Add validation middleware
   - Implement error collection + reporting

3. **Testing Phase**:
   - Unit tests for validation
   - Integration tests for transactions
   - Load testing for large batches

4. **Documentation**:
   - API endpoint documentation
   - CSV/JSON schema examples
   - Error code reference

## Key Architectural Decisions You Can Leverage

1. **Transactions**: All bulk operations should use `db.transaction()` for atomicity
2. **Validation**: Pre-validate entire batch before touching DB
3. **Error Reporting**: Return line-by-line feedback for user correction
4. **Idempotency**: Consider if re-uploads should be safe (upsert vs insert)
5. **Audit Trail**: Log all bulk operations with user, timestamp, row count

---

## Questions to Guide Your Implementation

1. Will bulk imports come from web UI or integration API?
2. Should failed rows prevent entire import or allow partial success?
3. Do you need import history/audit trail?
4. Should bulk uploads go through approval workflow?
5. What's the expected max batch size? (affects pagination strategy)
6. Should imports be async (fire & forget) or synchronous (wait for results)?

---

**Investigation Date**: June 30, 2026
**Branch**: 004-business-control-ui
**API Version**: 1.0 (no versioning yet)
**Status**: Ready for enhancement with bulk upload feature
