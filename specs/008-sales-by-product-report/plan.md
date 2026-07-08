# Implementation Plan: Reporte de Ventas por Producto Vendido

**Branch**: `008-sales-by-product-report` | **Date**: 2026-07-07 | **Spec**: [spec.md](file:///Users/joelmorales/web/POS-ERP/specs/008-sales-by-product-report/spec.md)

**Input**: Feature specification from `/specs/008-sales-by-product-report/spec.md`

## Summary

This feature adds a new reports view in the business administrative dashboard (Tauri app) and backend endpoints (NestJS sync API) to analyze product-level sales. The report lists all items sold in a filtered date range, including total quantities, average price, gross sales, included 16% IVA tax, and net sales, with CSV, Excel, and PDF export functionality.

## Technical Context

**Language/Version**: 
- Backend: NestJS / TypeScript
- Frontend: React / TypeScript / Vite (Tauri)
- Database/ORM: PostgreSQL with Drizzle ORM

**Primary Dependencies**: 
- Backend: `@nestjs/common`, `drizzle-orm`
- Frontend: `xlsx` (already present in `package.json`), React, standard browser APIs for CSV and PDF print triggers.

**Storage**: Queries read-only from `orders`, `order_items`, `products`, and `categories` tables. No schema migrations needed.

**Testing**: Jest for NestJS endpoints; React testing library for front-end report rendering.

**Target Platform**: Tauri Web Admin (Desktop) and NestJS Cloud API.

**Project Type**: Web Admin Panel + Cloud reporting API endpoints.

**Performance Goals**: Aggregate up to 15,000 order item rows and return results in under 2.0s.

**Constraints**: Cost values are hidden for non-admin/auditor roles (cajeros, meseros). Only closed orders are computed.

## Constitution Check

- **Offline continuity**: Read-only reporting is naturally online-only for consolidation; local fallback is N/A.
- **Local authority**: N/A for consolidated business reports.
- **Sync contract**: Read-only queries pull live data from consolidated cloud tables.
- **Cloud role**: Heavy aggregation queries use optimized indexes on `orders.created_at`, `orders.business_id`, and `order_items.product_id`.
- **Verification**: Tests verify exact mathematical formulas for tax (`Gross - (Gross / 1.16)`) and net sales.

## Project Structure

### Documentation (this feature)

```text
specs/008-sales-by-product-report/
├── spec.md              # Functional specification
├── plan.md              # This file
├── checklists/
│   └── requirements.md  # Requirements checklist
└── tasks.md             # Implementation tasks
```

### Source Code

```text
apps/sync_api/src/modules/reports/
├── reports.controller.ts     # Expose new endpoint GET /reports/sales/products
└── reports.service.ts        # Query and aggregate database rows

apps/business_control_tauri/src/
├── services/
│   └── api.ts                # Add getProductSalesReport client method
└── pages/
    └── ReportsPage.tsx       # Render the new reports tab and filters
```

**Structure Decision**: Single repository layout matching NestJS backend and React frontend paths.

## Proposed API Contract

### Request: `GET /api/reports/sales/products`
**Query Parameters**:
* `businessId` (string, required)
* `startDate` (string, optional, YYYY-MM-DD)
* `endDate` (string, optional, YYYY-MM-DD)
* `branchId` (string, optional)
* `categoryId` (string, optional)

### Response: `ProductSalesReportLine[]`
```json
[
  {
    "productId": "a50c82f9-7151-4043-a6fe-4f811566cf2c",
    "productName": "Chocolatín",
    "sku": "CHOCO-01",
    "categoryName": "Repostería",
    "quantitySold": 120,
    "averagePrice": 65.00,
    "grossSales": 7800.00,
    "taxAmount": 1075.86,
    "netSales": 6724.14
  }
]
```

## Detailed Technical Design

### 1. Database Querying
The backend query will fetch and join the tables as follows:
```typescript
const items = await this.db
  .select({
    productId: schema.orderItems.productId,
    productName: schema.products.name,
    sku: schema.products.sku,
    categoryName: schema.categories.name,
    price: schema.orderItems.price,
    quantity: schema.orderItems.quantity,
  })
  .from(schema.orderItems)
  .leftJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
  .leftJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
  .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
  .where(
    and(
      eq(schema.orders.businessId, businessId),
      eq(schema.orders.state, 'closed'),
      isNull(schema.orders.deletedAt),
      isNull(schema.orderItems.deletedAt),
      startDate ? gte(schema.orders.createdAt, new Date(startDate + 'T00:00:00')) : undefined,
      endDate ? lte(schema.orders.createdAt, new Date(endDate + 'T23:59:59')) : undefined,
      branchId ? eq(schema.orders.branchId, branchId) : undefined,
      categoryId ? eq(schema.products.categoryId, categoryId) : undefined,
    )
  );
```
Aggregations will be computed in memory:
* `grossSales` = `sum(price * quantity)`  (Note: `price` from database is gross, including 16% IVA)
* `averagePrice` = `grossSales / sum(quantity)`
* `taxAmount` = `grossSales - (grossSales / 1.16)`
* `netSales` = `grossSales / 1.16` (or `grossSales - taxAmount`)

### 2. Export Implementations
* **CSV**: Loop over dataset, escape strings, separate with commas, create Blob, and download as `reporte-ventas-productos-[timestamp].csv`.
* **XLSX**: Import `xlsx` in `ReportsPage.tsx`, format the headers and columns, write rows with total footer, and call `XLSX.writeFile(wb, 'filename.xlsx')`.
* **PDF**: Add `@media print` CSS classes inside `index.css` to hide headers, sidebar, buttons, and filters. Inside React, call `window.print()` to print only the table.
