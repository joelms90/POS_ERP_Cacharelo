# Specification: 015-resumen-sucursal — Resumen de Sucursal y Cortes de Caja (Corte X / Corte Z)

**Status:** Draft / Active  
**Author:** Lead Architect (Orchestrator)  
**Target Apps:** `apps/pos_flutter`, `apps/business_control_tauri`, `apps/sync_api`

---

## 1. Problem Statement
The branch operator (`branch_operator`) and cashier (`cashier`) need a clear, reliable workflow to inspect daily branch financial performance, verify physical cash against recorded sales, perform interim non-closing cash drawer audits (**Corte X**), and execute official shift closures with denomination counts and discrepancy calculation (**Corte Z**).

The backend endpoints are already implemented and verified in `apps/sync_api` (`/cash-shifts` and `/reports`). The Flutter POS client and Admin UI need client services and UI screens wired to these canonical endpoints.

---

## 2. Verified Backend Contracts

### A. Cash Shifts (`apps/sync_api/src/modules/shifts/shifts.controller.ts`)
- **Base Route:** `/cash-shifts`
- **Guards:** `@UseGuards(JwtAuthGuard, RolesGuard)`
- **Authorized Roles:** `cashier`, `branch_operator`
- **Key Methods:**
  - `POST /cash-shifts`: Open shift (`OpenShiftDto`: `initialFloat`).
  - `GET /cash-shifts/active?branchId=...&cashierId=...`: Get active shift for the logged-in operator.
  - `GET /cash-shifts/:id`: Retrieve specific shift.
  - `POST /cash-shifts/:id/transactions`: Record cash in/out (`CreateTransactionDto`: `type` ['cash_in', 'cash_out'], `amount`, `reason`).
  - `POST /cash-shifts/:id/close`: Close shift / Corte Z (`CloseShiftDto`: `finalAmount`, `expectedAmount`, `discrepancy`, `denominationCounts`, `notes`).

### B. Reports & Audits (`apps/sync_api/src/modules/reports/reports.controller.ts`)
- `GET /reports/cash-shifts/:id/audit`: Live Corte X audit report (breakdown of sales, taxes, discounts, payment methods, cash movements).
- `GET /reports/sales/payment-methods?businessId=...&startDate=...&endDate=...&branchId=...`: Cash vs. card vs. transfer summary.
- `GET /reports/cash-shifts?businessId=...&startDate=...&endDate=...&branchId=...`: List historical shifts.

---

## 3. Scope of Implementation

### App 1: POS Flutter (`apps/pos_flutter`) — Specialist: `codex`
1. **API Service Extension (`lib/services/api_service.dart`)**:
   - `Future<Map<String, dynamic>?> getActiveShift()`
   - `Future<Map<String, dynamic>> openShift(double initialFloat)`
   - `Future<Map<String, dynamic>> addShiftTransaction(String shiftId, String type, double amount, String reason)`
   - `Future<Map<String, dynamic>> getShiftAuditReport(String shiftId)` (Corte X)
   - `Future<Map<String, dynamic>> closeShift(String shiftId, Map<String, dynamic> closeData)` (Corte Z)
2. **UI Screens & Modals (`lib/ui/encargado/`)**:
   - Add **"Resumen de Turno" / "Caja"** section to `operator_operations_tabs.dart`.
   - **Corte X Modal**: View current drawer balance, sales breakdown (Efectivo, Tarjeta, Transferencia), and option to print comanda audit ticket.
   - **Corte Z Modal**: Bill/coin denomination counter (billetes de $500, $200, $100, $50, $20, monedas), automatic discrepancy calculation (`diferencia = contado - esperado`), closure notes, and confirmation to close shift.
3. **Thermal Receipt Printing**:
   - Format and print the official Corte X and Corte Z ticket on the thermal printer.

### App 2: Admin Dashboard (`apps/business_control_tauri`) — Specialist: `opencode` / `claude`
1. **API Service Extension (`src/services/api.ts`)**:
   - `getCashShifts(params)`
   - `getCashShiftAudit(id)`
2. **UI Pages & Components (`src/pages/DashboardPage.tsx` or new `src/pages/CashShiftsPage.tsx`)**:
   - Display active and closed shifts table with branch filter, cashier name, open date, close date, opening float, expected amount, actual counted amount, and discrepancy badge (verde: $0, rojo: faltante/sobrante).
   - Modal to inspect full audit report breakdown.

---

## 4. Acceptance Criteria
- [ ] Active shift correctly fetched and displayed in Flutter POS.
- [ ] Corte X displays live metrics without closing the shift.
- [ ] Corte Z requires denomination count, records discrepancy, and marks shift closed.
- [ ] Admin dashboard displays shift history and audit details with discrepancy status.
- [ ] `make check-all` passes (backend, admin build, flutter analyze).
