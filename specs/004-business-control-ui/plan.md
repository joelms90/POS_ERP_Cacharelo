# Implementation Plan: Tauri Business Control Admin UI

**Branch**: `004-business-control-ui` | **Date**: 2026-06-11 | **Spec**: [spec.md](file:///Users/joelmorales/web/POS-ERP/specs/004-business-control-ui/spec.md)

**Input**: Feature specification from `/specs/004-business-control-ui/spec.md`

## Summary

Implement a dedicated desktop administration console using React, Vite, TypeScript, and Tauri. The application will consume the existing `apps/sync_api` Express API to manage employee login PINs, verify database connectivity, and monitor POS synchronization health. Visuals will follow the premium "Empire Noir" design language (obsidian backgrounds, Champagne Gold interactive elements, Aged Bronze outlines) implemented via custom Tailwind CSS tokens. The UI code will be modularly organized following the Atomic Component Strategy (Atoms, Molecules, Organisms, Templates, Pages).

## Technical Context

**Language/Version**: 
- Desktop Client Frontend: React 18+, TypeScript 5+, Vite 5+
- Desktop Wrapper: Tauri v2
- Backend Service: Node.js 20+ (Express / TypeScript in `apps/sync_api`)

**Primary Dependencies**:
- Frontend: `react`, `react-dom`, `@tauri-apps/api` (Tauri desktop system integration)
- Styling: `tailwindcss`, `postcss`, `autoprefixer`
- Dev/Test: `vitest`, `@testing-library/react` (component and unit testing)

**Storage**:
- Local Client: `localStorage` for caching the administrative authorization token (`X-Admin-Token`).
- Backend Storage: Direct writes to PostgreSQL database (or fallback `data/users.json` file) managed by `apps/sync_api`.

**Testing**:
- Unit/Component: `vitest` and `@testing-library/react` to test form validators, inputs, button states, and state containers.
- Mocking: Mock `fetch` requests to verify API error/success integration states.

**Target Platform**: 
- macOS (Desktop Client WebKit Webview)
- Windows 10/11 (Desktop Client WebView2)

**Project Type**: 
- React-Tauri Desktop Application + REST Client

**Performance Goals**:
- Application cold launch to interactive login screen: < 800ms
- Employee list render latency: < 150ms post-API response
- Tailwind utility compilation: < 100ms in hot reload

**Constraints**:
- Must run in desktop-native wrapper window.
- The UI must adapt cleanly to sizes down to 1024x768.
- Strictly adhere to visual tokens in `THEME_SPEC.md` / `003-waiter-cashier-screens` plan (obsidian/gold palette).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Offline continuity**: PASS. The admin app operates back-office tasks, not front-line POS orders. It degrades gracefully when the sync backend is unreachable, displaying clear system alerts and disabling actions rather than freezing or crashing.
- **Local authority**: PASS. Authentication state and token are cached locally in the Tauri client webview storage to prevent repeated login prompts.
- **Sync contract**: PASS. Uses the REST API contract exposed by `apps/sync_api`. All mutations use idempotent IDs (UUIDs) and propagate immediately to the backend database.
- **Cloud role**: PASS. The desktop app does not modify the PostgreSQL schema. It depends on the Express API server to synchronize and persist user data.
- **Verification**: PASS. Front-end unit tests check that invalid PINs and empty user records are blocked locally before making server requests.

## Project Structure

### Documentation (this feature)

```text
specs/004-business-control-ui/
├── plan.md              # This file
├── research.md          # Technology choices and theme alignment details
├── data-model.md        # UI models and TypeScript interface schemas
├── quickstart.md        # Command line instructions for starting the app
├── checklists/
│   └── requirements.md  # Spec quality validation checklist
└── contracts/
    └── api.md           # API request/response specifications
```

### Source Code

The new React Tauri project will reside inside `apps/business_control_tauri/`:

```text
apps/business_control_tauri/
├── src-tauri/
│   ├── src/
│   │   └── main.rs             # Tauri rust entrypoint
│   └── tauri.conf.json         # Window boundaries, permissions, and build targets
├── src/
│   ├── components/
│   │   ├── atoms/              # Simple style-heavy tags
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── Heading.tsx
│   │   ├── molecules/          # Multi-atom compounds
│   │   │   ├── FormField.tsx
│   │   │   ├── UserCardHeader.tsx
│   │   │   └── StatusIndicator.tsx
│   │   ├── organisms/          # Business logic blocks
│   │   │   ├── UserForm.tsx
│   │   │   ├── UsersGrid.tsx
│   │   │   └── LoginForm.tsx
│   │   └── templates/          # Standard layout wrappers
│   │       └── AdminLayout.tsx
│   ├── pages/                  # Page route components
│   │   ├── LoginPage.tsx
│   │   └── DashboardPage.tsx
│   ├── services/
│   │   └── api.ts              # Fetch client wrapper for backend API calls
│   ├── hooks/
│   │   └── useAuth.ts          # Authentication state hook
│   ├── main.tsx
│   └── index.css               # Tailwind directives and core fonts loading
├── package.json
├── postcss.config.js
├── tailwind.config.js          # Extended with Obsidian, Onyx, Gold, and Bronze colors
└── tsconfig.json
```

**Structure Decision**: Create the dedicated subproject `apps/business_control_tauri` using the standard Tauri template structure. Organize frontend React code strictly within `src/components/` separated into atomic subfolders (`atoms`, `molecules`, `organisms`, `templates`) and `src/pages/` for route handlers. This separates pure UI elements from page-level state management and backend services.

## Complexity Tracking

*No constitution violations detected. Fits within standard web application design guidelines.*

## Reports Intelligence Addendum

**Date**: 2026-07-07

### Problem Statement

The current `Reportes e Inteligencia de Ventas` section relies on `/api/reports/sales-dashboard`, but the response can be misleading because it aggregates different concepts without reconciliation:

- `totalSales` is calculated from `orders.total` for closed orders.
- `topProducts.totalSales` is calculated from `order_items.price * quantity`.
- Zero-total or unpaid closed orders still contribute product rows.
- Hourly sales are bucketed from server-side `Date.getHours()`, which can use Cloud Run UTC rather than the restaurant's local business timezone.
- Product history excludes inactive products, which can erase historical sales from product rankings.

### Design Direction

Use a reconciled dashboard contract with these sections:

- `financial`: gross order sales, discounts, taxes, net order sales, collected payments, average check, contribution margin, and payment mix.
- `operations`: order count, item count, hourly sales, kitchen ticket speed, and unsupported operational metrics with missing-data reasons.
- `menu`: top 10 products by quantity, revenue, and contribution margin.
- `staff`: waiter and cashier rankings based on the selected sales basis.
- `inventory`: stock value, low-stock count, and future actual-vs-theoretical variance status.
- `reconciliation`: order/payment/item mismatch counts and detail rows.

### Metric Feasibility

Available now from the existing schema:

- Gross sales, discounts, taxes, net order sales, order count, average check.
- Collected sales and payment mix from `payments`.
- Item velocity and contribution margin from `order_items` and `products.cost`.
- Branch/user rankings from `orders`, `branches`, and `users`.
- Hourly sales after timezone normalization.
- Kitchen ticket speed from `kitchen_tickets`.
- Inventory stock value and Kardex from stock/movement tables.

Blocked until data model changes:

- Prime cost percentage: needs labor cost records.
- Labor cost percentage: needs employee hourly wages and shift attendance.
- PPA / covers: needs guest count at order/table level.
- RevPASH: needs seat capacity and occupied-seat-hour tracking.
- Dining duration: needs table/order lifecycle timestamps beyond `createdAt`.
- Actual vs theoretical food-cost variance: needs recipe depletion snapshots and physical count adjustments.

### Implementation Plan

1. Fix report accounting basis in `ReportsService.getSalesDashboard`.
   - Use closed paid orders for primary financial KPIs.
   - Sum `payments.amount` for collected sales and payment mix.
   - Return reconciliation exceptions for closed orders with zero total, missing payments, or mismatched payment totals.
   - Keep item velocity separate from financial totals unless reconciled to the selected basis.

2. Update the API contract and TypeScript models.
   - Add `financial`, `operations`, `menu`, `staff`, `inventory`, and `reconciliation` sections.
   - Preserve compatibility by keeping legacy fields only if needed during UI migration.

3. Redesign `ReportsPage` sales tab.
   - Default view should show the highest-signal restaurant metrics first: gross/net/collected sales, orders, average check, contribution margin, payment mix, item velocity, and reconciliation warnings.
   - Move currently unsupported metrics to a "Pendiente de captura de datos" panel.

4. Add verification fixtures.
   - Include paid orders, zero-total closed orders, inactive products, multiple payment methods, and Mexico timezone boundaries.
   - Assert financial totals reconcile within MXN 0.01.

5. Defer schema changes to a later feature.
   - Add future migrations for channel, covers, labor cost, seat capacity, table lifecycle timestamps, and physical inventory counts only after the reporting foundation is correct.
