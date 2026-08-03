# 📊 Active Task Tracker (TRACKER.md)

This table tracks active, completed, and upcoming feature tasks for the POS-ERP (Cacharelo) monorepo.

| Task ID / Description | Module | Assigned To | Status | Last Updated | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Multi-Station KDS Routing** | `sync_api` / `pos_flutter` | Antigravity | `#completed` | 2026-07-31 | Station splitting (`cocina` vs `barra`), filter chips, and colored ticket badges. |
| **Admin Category KDS Station Selector** | `business_control_tauri` | Antigravity | `#completed` | 2026-07-31 | `targetStation` dropdown & table column badges in `CategoriesPage.tsx`. |
| **Cafeteria Jáltipan Business Provisioning** | `sync_api` / DB | Antigravity | `#completed` | 2026-08-01 | Provisioned business `e00079b3...`, cloned catalog & copied branch table layout. |
| **Device Thermal Paper Width (50mm/58mm/80mm)** | `pos_flutter` | Antigravity | `#completed` | 2026-08-01 | 3 paper width profiles (26, 32, 48 cols) saved locally per device in `SecureStorageService`. |
| **Dynamic Receipt Height & Zero Tail Waste** | `pos_flutter` | Antigravity | `#completed` | 2026-08-01 | Computed dynamic receipt height per line count to stop 15cm blank tail feeding. |
| **Bold Monospace Thermal Print Legibility** | `pos_flutter` | Antigravity | `#completed` | 2026-08-01 | `pw.Font.courierBold()` & `FontWeight.bold` at 7.5pt/8.0pt for thick crisp characters. |
| **Header User Session Profile Badge** | `pos_flutter` | Antigravity | `#completed` | 2026-08-01 | Sleek `👤 <currentUserName>` badge chip in Cashier & Waiter headers. |
| **Flexible Division Equitativa (Split Overrides)** | `pos_flutter` | Antigravity | `#completed` | 2026-08-01 | Cashier can set custom person amount (e.g. $100); auto-rebalances remaining balance. |
| **Waiter Ready Orders Pickup Tray** | `pos_flutter` | Antigravity | `#completed` | 2026-07-31 | Bell icon (`🛎️`) counter badge and slide-over modal for marking tickets delivered. |
| **Sellable Menu Product Filtering** | `pos_flutter` | Antigravity | `#completed` | 2026-07-31 | Filtered sales menu to `isSellable = true` items, hiding raw ingredients. |
| **Public Download Portal (`9876`)** | `pos_flutter` / Firebase | Antigravity | `#completed` | 2026-07-31 | Built `descargas.html` portal page for APK and Web POS distribution. |
| **Automated Release Deployment** | Monorepo / Makefile | Antigravity | `#completed` | 2026-07-31 | Added `make flutter-portal-deploy` target to build APK, sync GCS, & deploy web. |
| **Encargado Direct Checkout Flow** | `pos_flutter` | Antigravity | `#in-progress` | 2026-07-31 | Counter order layout & direct payment for take-out operations. |
| **Purchase Order UI Component Reuse** | `business_control_tauri` | Antigravity | `#todo` | 2026-07-31 | Reusing product search & item list components from *Traspasos* into *Nueva Orden de Compra*. |
| **Branch Requisitions Approval Workflow** | `sync_api` / `pos_flutter` | Antigravity | `#todo` | 2026-07-31 | Branch-to-warehouse stock requests & approval endpoints. |

---

## 💡 Status Tag Conventions
- `#todo`: Planned feature, ready to start.
- `#in-progress`: Currently being designed or coded.
- `#blocked`: Blocked by an external dependency or design decision.
- `#completed`: Feature implemented, tested, and deployed to production.
