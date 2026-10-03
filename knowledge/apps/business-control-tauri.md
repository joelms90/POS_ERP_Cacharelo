---
type: "app"
title: "Business Control Admin Dashboard"
description: "Architecture, pages, component design, and deployment model for apps/business_control_tauri."
status: "verified"
generated:
  at: "2026-09-25"
  by: "Antigravity Agent"
tags:
  - "frontend"
  - "react"
  - "vite"
  - "tailwind"
  - "tauri"
  - "apps"
sources:
  - "apps/business_control_tauri/package.json"
  - "apps/business_control_tauri/src/App.tsx"
---

# Business Control Admin Dashboard

The **Business Control Dashboard** (`apps/business_control_tauri`) is the administrative back-office interface for restaurant owners, general managers, and inventory admins.

---

## 1. Tech Stack & Architecture

- **UI Framework**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Lucide React icons
- **State & Data Fetching**: TanStack React Query / Axios
- **Packaging**: Dual target — runs as a desktop application via Tauri and deploys as a web app on Firebase Hosting (`https://cacharelo-central.web.app`).

---

## 2. Page & Feature Map

```text
apps/business_control_tauri/src/pages/
├── DashboardPage.tsx            # Sales metrics, live occupancy, shift totals
├── ProductsPage.tsx             # Master catalog, prices, wholesale, recipe links
├── CategoriesPage.tsx           # Category list with KDS targetStation configuration
├── InventoryPage.tsx            # Multi-warehouse stock balances, Kardex ledger
├── InventoryAlertsPage.tsx      # Low-stock alerts, suggested PO / requisition actions
├── PurchaseOrdersPage.tsx       # Supplier purchase orders (draft -> sent -> received)
├── RequisitionsPage.tsx         # Branch replenishment approval and dispatch
├── StockTransfersPage.tsx       # Inter-warehouse/branch transfers with transit tracking
├── AssemblyPage.tsx             # Work orders (OP) and recipe bill of materials (BOM)
├── UsersPage.tsx                # Multi-role user creation, PIN assignment, permissions
└── SettingsPage.tsx             # Fiscal configuration, print stations, business info
```

---

## 3. UI Responsiveness Rules

Per repository guidelines:
- Never apply fixed viewport heights like `h-screen` or `h-full` to page container panels on mobile.
- Use `lg:h-full min-h-full` with `overflow-y-auto lg:overflow-hidden`.
- Long headers must scale gracefully (`!text-lg sm:!text-2xl`).
- Two-panel views must stack vertically on mobile screens: `flex flex-col lg:flex-row gap-6`.

---

## 4. Key Commands

```bash
# Start local dev server (port 5173)
cd apps/business_control_tauri && pnpm dev

# Build production web bundle
cd apps/business_control_tauri && pnpm build

# Deploy to Firebase Hosting
make admin-deploy
```
