# Tasks: Reporte de Ventas por Producto Vendido

**Input**: Design documents from `/specs/008-sales-by-product-report/`

**Prerequisites**: plan.md (required), spec.md (required)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Includes exact file paths.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Route and client setup

- [ ] T001 [P] Create directory structure for test files: `apps/sync_api/src/modules/reports/tests/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend service and API client definitions

- [ ] T002 Implement database aggregation method `getProductSalesReport` in `apps/sync_api/src/modules/reports/reports.service.ts`
- [ ] T003 Expose the GET `/reports/sales/products` route in `apps/sync_api/src/modules/reports/reports.controller.ts`
- [ ] T004 Define the `getProductSalesReport` HTTP query fetcher in client services file `apps/business_control_tauri/src/services/api.ts`

**Checkpoint**: Foundation ready - API endpoint and UI API client functions are integrated.

---

## Phase 3: User Story 1 - Visualización del Reporte (Priority: P1) 🎯 MVP

**Goal**: Display basic report with main filters in Tauri panel.

**Independent Test**: Load the reports dashboard, click the "Ventas por Producto" tab, select date range and branch, and verify that the items match POS closed orders.

### Implementation for User Story 1

- [ ] T005 [P] Add `salesByProduct` tab selector state in `apps/business_control_tauri/src/pages/ReportsPage.tsx`
- [ ] T006 [P] Add the tab header button labeled "Ventas por Producto" in `apps/business_control_tauri/src/pages/ReportsPage.tsx`
- [ ] T007 Implement the core table layout displaying columns (Producto, Categoría, Unidades, Precio Unitario Promedio, Venta Bruta, IVA, Venta Neta) in `apps/business_control_tauri/src/pages/ReportsPage.tsx`
- [ ] T008 Implement the aggregate calculation row at the bottom of the table to display totals of units, gross sales, tax, and net sales in `apps/business_control_tauri/src/pages/ReportsPage.tsx`
- [ ] T009 Add basic branch and date-picker query fetch triggers in `apps/business_control_tauri/src/pages/ReportsPage.tsx`

**Checkpoint**: User Story 1 is fully functional. The sales report can be loaded, filtered by branch/date, and viewed.

---

## Phase 4: User Story 2 - Filtros Avanzados y Búsqueda (Priority: P2)

**Goal**: Search and filter by category or state

**Independent Test**: Search for a specific product name in the search bar and verify only that product remains in the list.

### Implementation for User Story 2

- [ ] T010 Add product name/SKU search input filter in `apps/business_control_tauri/src/pages/ReportsPage.tsx`
- [ ] T011 Add Category selection dropdown filter in `apps/business_control_tauri/src/pages/ReportsPage.tsx`
- [ ] T012 Integrate text search and category select filters into front-end state filters in `apps/business_control_tauri/src/pages/ReportsPage.tsx`

**Checkpoint**: Advanced filters are active and allow searching and category segmentation.

---

## Phase 5: User Story 3 - Exportación de Datos (Priority: P3)

**Goal**: Download report as CSV, Excel, or PDF.

**Independent Test**: Download the CSV and Excel files and verify that they open with the exact filtered data. Click Print PDF and check layout.

### Implementation for User Story 3

- [ ] T013 Implement CSV generation string builder and download trigger in `apps/business_control_tauri/src/pages/ReportsPage.tsx`
- [ ] T014 Implement Excel (`xlsx`) export using the `xlsx` library in `apps/business_control_tauri/src/pages/ReportsPage.tsx`
- [ ] T015 Add print-friendly CSS rules to hide sidebars, filters, and buttons in `apps/business_control_tauri/src/index.css`
- [ ] T016 Add print trigger callback invoking `window.print()` in `apps/business_control_tauri/src/pages/ReportsPage.tsx`

---

## Phase 6: Polish & Verification

- [ ] T017 Verify currency rendering format using `Intl.NumberFormat` for Mexican Pesos
- [ ] T018 Run backend tests to verify database query speed and tax math correctness
- [ ] T019 Verify responsive table overflow layout on smaller tablet/laptop screens
