# Tasks: Supervisor de Sucursal — Fase 1

**Branch**: `019-supervisor-sucursal` · **Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md) · **Data model**: [data-model.md](data-model.md)

Reglas de ejecución (dueño, 2026-11-22):
- Solo en local: sin push, sin deploy, sin staging ni producción.
- Migraciones solo contra el Postgres de Docker local (`postgres://pos_user:pos_password@localhost:5432/pos_dev`).
- Commits pequeños por paso; sin merge a `main`.
- C-1 y C-2 se implementan como constantes configurables y siguen "por confirmar".

Leyenda: `[ ]` pendiente · `[x]` hecho · `[~]` parcial / diferido (con nota)

---

## 0. Preparación
- [x] T000 Escribir `tasks.md`.
- [x] T001 Instalar dependencias del backend en el worktree y correr la suite base (24 suites, 179 tests en verde).

## 1. Backend (`apps/sync_api`)

### 1.1 Modelo y migración
- [x] T101 Rol `branch_supervisor` (`SUPERVISION_ROLES`, `BRANCH_SUPERVISOR_ROLE`, `CASH_APPROVAL_ADMIN_ROLES = ['owner']`), fuera de `ADMIN_ROLES`.
- [x] T102 `schema.ts`: columnas de revisión en `cash_shifts`; ledger en `cash_transactions` (`entry_kind`, `reverses/replaces_transaction_id`, `cash_effect` generada, `approval_status`, …); tablas `supervisor_branch_assignments`, `cashier_debts`, `notifications`, `audit_log`.
- [x] T103 Migración SQL `0022_supervisor_cash_approvals.sql` + bloque idempotente en `scripts/idempotent-deploy-migrations.ts` (incluye triggers de inmutabilidad de `cash_transactions` y `audit_log`).
- [x] T104 Aplicar la migración **solo** en la base local de Docker y verificar el esquema. (Dos corridas OK; neto histórico sin cambios; triggers verificados.)

### 1.2 Reglas puras (sin BD)
- [x] T110 `cash-approval.config.ts`: C-1 (`N2_MUST_DIFFER_FROM_N1`), C-2 (`OIS_CLOSE_BLOCKS_OPENING_UNTIL_N1`), `ENFORCE_OPEN_BLOCK` (variable de entorno).
- [x] T111 `cash-approval.rules.ts`: estado inicial del corte y del movimiento, resolución de N1 (OIS o supervisor, S-3), transiciones del Corte Z (N1/N2, reconteos, S-5), transiciones de movimientos (S-1), no auto-aprobación, C-1, `cashEffect`, agrupación de movimientos (aprobados/pendientes/revertidos/ajustados), `reconciliationStatus`, condición de bloqueo de apertura (D-4, C-2, P-2).
- [x] T112 Tests jest de cada regla de T111 (50 tests).

### 1.3 Servicios transversales
- [x] T120 `AuditModule`: `AuditLogService` (insert dentro de la transacción del llamador) y `NotificationsService` (fan-out por destinatario, marcar leídas).
- [x] T121 `SupervisorScopeService`: sucursales asignadas, `canActN1` / `canActN2` / `canCancelOrAdjust`, destinatarios de notificaciones.

### 1.4 Turnos (`modules/shifts`)
- [x] T130 `closeShift`: `closed_by`, `n1_resolver_role`, `review_status = pendiente_n1`, idempotencia por `clientUuid`, bitácora y notificación.
- [x] T131 `openShift`: bloqueo de apertura (D-4/C-2) con desbloqueo del owner (P-2), detrás de `CASH_APPROVALS_ENFORCE_OPEN_BLOCK`.
- [x] T132 `createTransaction`: asiento de ledger (`created_by`, `category`, `clientUuid` idempotente, `pendiente_n1`), egreso nuevo no puede dejar el esperado < 0 (MV-05).
- [x] T133 `buildShiftReport`: esperado con `cashEffect` (incluye reversos) y grupos de movimientos.
- [x] T134 `POST /cash-shifts/:id/recount` (S-5: tras `rechazado_n1` → `pendiente_n1`; tras `rechazado_n2` → `pendiente_n2`).
- [x] T135 Tests: los existentes siguen en verde + nuevos (bloqueo, idempotencia, MV-05, recount).

### 1.5 Supervisión (`modules/supervision`)
- [x] T140 Aprobar / rechazar / ajustar Corte Z (N1/N2) con `version` (409), no auto-aprobación (403), CZ-06 (422 si hay movimientos pendientes), `approval_snapshot` al aprobar en N2.
- [x] T141 Reabrir (owner) y desbloquear apertura (owner, P-2).
- [x] T142 Aprobar / rechazar movimiento (N1) con asiento de reverso; cancelar / ajustar (supervisor u owner) con reverso + asiento `ajuste`, solo antes de la aprobación final del corte.
- [x] T143 Adeudos (D-8, P-1): crear al aprobar con faltante; anular al reabrir; consulta.
- [x] T144 Bandejas `GET /supervision/approvals` (+ `count`), detalle del corte con esperado ajustado y ajustes posteriores al cierre.
- [x] T145 Asignaciones de supervisores (owner), bitácora (`GET /supervision/audit-log`), notificaciones (`GET /notifications`, `unread-count`, `read`, `read-all`).
- [x] T146 Tests de autorización HTTP (401/403/409/422) y de servicio para cada regla.

### 1.6 Reportes
- [x] T150 Guards en endpoints de reportes sin protección (R-1) y alcance del supervisor a sus sucursales (D-9/P-3).
- [x] T151 `getCashShiftAuditReport` / `getCashShiftsList`: `reviewStatus`, `approvedDifference`, `postCloseEntries`, `adjustedExpected`, `reconciliationStatus` del backend.
- [x] T152 Tests.

### 1.7 Cierre del backend
- [x] T160 `npx tsc --noEmit`, `npx jest`, `npm run build`; resumen.

## 2. Admin web (`apps/business_control_tauri`)
- [x] T201 `services/api.ts`: tipos y métodos de supervisión y notificaciones.
- [x] T202 `roleTabs`: `branch_supervisor` + pestañas nuevas para owner; pestañas calculadas con la unión de `user.roles` (R-4).
- [x] T203 `ApprovalsPage`: bandeja de Cortes Z y movimientos (owner y supervisor).
- [x] T204 Detalle de Corte Z: esperado al cierre + ajustes posteriores = esperado ajustado; movimientos agrupados; aprobar / rechazar (motivo) / ajustar; **impacto mostrado antes de confirmar** rechazos y cancelaciones; cancelar / ajustar movimientos; desbloqueo (owner).
- [x] T205 `NotificationsPage` + campana con contador en el layout.
- [x] T206 Gestión de asignaciones de supervisores (owner) y consulta de adeudos y bitácora.
- [x] T207 `ReportsPage`: `reconcileCash` usa el `reconciliationStatus` del backend cuando está disponible; columna de revisión.
- [x] T208 `npx tsc --noEmit` + `vite build`; resumen.

## 3. POS Flutter (`apps/pos_flutter`)
- [ ] T301 `app_state.dart`: movimientos con categoría estructurada y `clientUuid`; leer `approvalStatus` y `reviewStatus`.
- [ ] T302 Pestaña Caja → sección **"Por aprobar"** para el OIS (cortes y movimientos de cajeros de su sucursal): aprobar / rechazar con motivo.
- [ ] T303 Estados visibles para el cajero (chips en movimientos y en el resumen del Corte Z; aviso de corte rechazado con "Recontar").
- [ ] T304 Manejo del 409 de apertura bloqueada (mensaje y acceso a "Por aprobar").
- [ ] T305 `flutter test` + `flutter analyze` de los archivos tocados (sin fallos nuevos respecto a los 15 preexistentes).
- [~] T306 Cola offline de movimientos y Corte Z offline (D-5): ver nota al cerrar la app.

## 4. Cierre
- [ ] T401 Handoff en `docs/handoffs/019-supervisor-sucursal.md`, `.claude/workspaces.md` y marcas finales en este archivo.
