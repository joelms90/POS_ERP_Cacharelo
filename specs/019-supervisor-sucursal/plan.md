# Implementation Plan: Supervisor de Sucursal — Fase 1

**Branch**: `019-supervisor-sucursal` | **Date**: 2026-11-22 (segunda ronda de decisiones del dueño) | **Spec**: [spec.md](spec.md) | **Data model**: [data-model.md](data-model.md)

> Propuesta. No se ha implementado ni migrado nada. D-1 a D-11, S-1 a S-6 y P-1 a P-3 están resueltos. C-1 quedó resuelta el 2026-11-23; queda C-2 (consecuencia de S-3, con propuesta por defecto en spec §15.2).

## Summary

- **Corte Z**: dos niveles obligatorios. N1 = OIS en el POS (o el supervisor asignado, u owner actuando como supervisor, si el corte lo cerró el OIS, S-3). N2 = supervisor asignado u owner en el Admin web; C-1 confirmada: puede ser la misma persona que hizo N1, y el owner audita después. Tras un rechazo de N2, el reconteo va directo a N2 (S-5).
- **Ingresos/egresos**: ledger append-only. Cuentan desde que se registran y solo los aprueba N1 (OIS, o el supervisor si el autor es el OIS; S-1). Rechazos, cancelaciones y ajustes generan asientos de reverso (S-4). El supervisor u owner los revisa dentro del Corte Z y puede cancelarlos o ajustarlos hasta la aprobación final.
- **Bloqueo de apertura**: no se abre turno mientras el Corte Z anterior no tenga aprobado su N1.
- **Corte Z offline**, con recálculo en el servidor.
- **Adeudo del cajero** por faltante aprobado.
- **Notificaciones persistentes consultables por REST**, con una sección en el Admin web (sin push), y bitácora append-only.
- **Desbloqueo de emergencia de la apertura** por el owner.
- El supervisor ve caja y ventas de sus sucursales; aprueba solo caja.
- El adeudo solo se registra y audita.

## Technical Context

- **Backend**: NestJS + Drizzle + PostgreSQL (`apps/sync_api`). Sin dependencias nuevas.
- **Admin web**: React + Vite + Tailwind (`apps/business_control_tauri`), Firebase Hosting.
- **POS**: Flutter, `AppState` en `lib/ui/common/app_state.dart`.
- **Constraints**: autorización en el servidor (BR-ROLE-004); idempotencia de todo lo que se encola offline; orden de sincronización ventas → movimientos → Corte Z; migraciones idempotentes coordinadas.

## Constitution Check

- **Offline continuity**: movimientos y Corte Z funcionan offline. Abrir turno ya requiere conexión hoy, y con D-4 además requiere que el OIS haya aprobado el corte anterior (riesgo R-8; mitigado con el desbloqueo de emergencia del owner).
- **Local authority**: el esperado oficial y todas las aprobaciones son del servidor. El ticket offline es provisional.
- **Sync contract**: nuevos jobs de cola (movimiento, Corte Z), eventos WS `approval_requested` / `approval_resolved` (solo para refrescar) y notificaciones por REST.
- **Cloud role**: 4 tablas nuevas y columnas en 2 existentes. Migración propuesta, no ejecutada.
- **Verification**: tests de autorización por nivel, tests de la máquina de estados, test de idempotencia/orden de sincronización, widget tests y `make check-all`.

---

## 0. Pre-requisito independiente (antes de Fase 1)

Proteger los endpoints de `ReportsController` que no tienen guard (`cash-shifts`, `sales/payment-methods`, `sales/products`, `inventory/existence`, `inventory/kardex`) con `JwtAuthGuard + RolesGuard + assertScope` (R-1). Al agregar el supervisor, los endpoints de ventas (`sales-dashboard`, `sales/*`) lo aceptan **limitado a sus sucursales asignadas** (D-9/P-3). PR separado.

## 1. Backend (`apps/sync_api`)

### 1.1 Roles y alcance
- `roles.ts`: `SUPERVISION_ROLES = ['branch_supervisor']`, `BRANCH_SUPERVISOR_ROLE`; `CASH_APPROVAL_ADMIN_ROLES = [OWNER_ROLE]` (S-2). No tocar `ADMIN_ROLES`.
- `approval-scope.service.ts`:
  - `canActN1(user, branchId)`: solo `branch_operator` con `user.branchId === branchId`. **No** owner ni supervisor (S-6). Hay que evitar el bypass de owner que tiene `RolesGuard`.
  - `canActN2(user, branchId)`: supervisor con asignación activa, u owner con acceso al negocio.
  - `canCancelOrAdjust(user, branchId)` = `canActN2`.
- `users.service.ts` / `admin-users.controller.ts`: alta y edición de `branch_supervisor`.

### 1.2 Módulo `modules/supervision`
```
supervision/
├── approvals.controller.ts       # bandejas N1/N2 y acciones
├── assignments.controller.ts     # owner
├── audit-log.controller.ts
├── debts.controller.ts           # adeudos (consulta; D-8, P-1)
├── notifications.controller.ts   # GET /notifications, unread-count, read
├── approvals.service.ts          # máquina de estados (tabla de transiciones)
├── debts.service.ts
├── notifications.service.ts      # fan-out a la tabla notifications + aviso WS opcional
├── audit-log.service.ts
├── approval-scope.service.ts
└── *.spec.ts
```

Tabla de transiciones en `approvals.service.ts` (fuente única):

| Entidad | Estado | Actor | Acción | Nuevo estado |
|---|---|---|---|---|
| Corte | (cierre) cualquier autor | — | cerrar | `pendiente_n1` (N1 = OIS si el autor es cajero; supervisor si el autor es el OIS, S-3) |
| Corte | `pendiente_n1` | N1 | aprobar / rechazar | `pendiente_n2` / `rechazado_n1` |
| Corte | `rechazado_n1` | autor del corte | reconteo | `pendiente_n1` |
| Corte | `pendiente_n2` | N2 (supervisor asignado u owner; puede ser quien hizo N1, C-1) | aprobar / ajustar / rechazar | `aprobado` / `aprobado_con_ajuste` / `rechazado_n2` (guarda `approval_snapshot` al aprobar) |
| Corte | `rechazado_n2` | cajero u OIS | reconteo | `pendiente_n2` (directo a N2, S-5) |
| Corte | `rechazado_n2` | N2 | ajustar | `aprobado_con_ajuste` |
| Corte | `aprobado*` | owner | reabrir | `pendiente_n2` (anula el adeudo) |
| Movimiento | (alta) cualquier autor | — | registrar asiento | `pendiente_n1` (N1 = OIS o supervisor según el autor, S-3) |
| Movimiento | `pendiente_n1` | N1 | aprobar / rechazar | `aprobado` (final, S-1) / `rechazado` + **asiento de reverso** |
| Movimiento | cualquiera salvo `rechazado`/`cancelado`/`ajustado`, con el corte sin aprobación final | supervisor/owner | cancelar / ajustar | `cancelado` + reverso / `ajustado` + reverso + asiento `ajuste` |

Los movimientos tienen un solo nivel (S-1). El supervisor actúa sobre ellos dentro del detalle del Corte Z (cancelar/ajustar), y el corte no puede aprobarse en N2 mientras haya movimientos en `pendiente_n1` (CZ-06).

Al pasar a `aprobado*` con diferencia final < 0, `debts.service` crea el adeudo en la misma transacción.

### 1.3 Cambios en `modules/shifts`
- **`openShift`**: antes de crear el turno, buscar el último corte de la sucursal. Si su `review_status` es `pendiente_n1` o `rechazado_n1`, responder **409** con el mensaje "El Corte Z anterior debe ser aprobado (nivel 1)"; si el autor fue el OIS, N1 es el supervisor (C-2). Excepción: si el owner desbloqueó (`open_block_overridden_at`), se permite abrir (P-2). Además, evento `apertura_bloqueada` en la bitácora y notificación al OIS y al supervisor (D-4). El auto-cierre >24 h no cambia (D-11) y queda `no_aplica`.
- **`closeShift`**: aceptar `clientUuid`, `closedOffline`, `localExpectedCash` y `closedAt` del cliente. Idempotente por `client_uuid`. Recalcular el esperado en el servidor; `closed_by` = actor; estado inicial según el autor; bitácora; notificación.
- **`createTransaction`**: `created_by`, `category`, `client_uuid` (`ON CONFLICT` devuelve el existente), estado según el autor, validación de esperado no negativo, bitácora, notificación. Debe aceptar movimientos offline que llegan **después** del cierre de su turno, si fueron creados antes del `closedAt` (orden de sincronización, OF-03).
- **`createTransaction` / reversos (S-4)**: el ledger solo inserta. `rejectMovement`, `cancelMovement` y `adjustMovement` insertan el reverso (y el asiento `ajuste`) en la misma transacción que el cambio de estado y la bitácora. El reverso usa `created_at = now()` y `shift_id` del original (spec §4.4.2). No se valida el esperado negativo en los reversos (MV-05).
- **`buildShiftReport`**: esperado = fondo + ventas en efectivo + `SUM(cash_effect)`. Devuelve los grupos aprobados / pendientes / revertidos / ajustados, el neto y el monto pendiente (spec §4.4.4).
- **Corte cerrado**: `getCorteReport('z')` y `ReportsService.getCashShiftAuditReport` devuelven `closeSnapshot` intacto + `postCloseEntries` (asientos con `created_at > closed_at`) + `adjustedExpected` / `adjustedDifference`; si está aprobado, `approvalSnapshot` como cifra oficial.
- **`reconciliationStatus`** (`BALANCED` / `SURPLUS` / `SHORTAGE` / `REQUIRES_RECONCILIATION`) se calcula en el backend sobre el esperado ajustado o aprobado y se devuelve en el reporte y en `getCashShiftsList`.
- `cash_drawer_amount` deja de usarse como esperado (R-15).
- Nuevos: `POST /cash-shifts/:id/recount` (cajero u OIS según el estado).

### 1.4 Endpoints

| Método y ruta | Quién | Descripción |
|---|---|---|
| `GET /supervision/approvals?level=n1\|n2&type=&status=&branchId=&from=&to=` | N1: OIS · N2: supervisor/owner | Bandejas. |
| `GET /supervision/approvals/count?level=` | ídem | Contador. |
| `GET /supervision/cash-shifts/:id` | OIS (su sucursal), supervisor, owner | Reporte + movimientos + bitácora + esperado local vs servidor. |
| `POST /supervision/cash-shifts/:id/approve` `{version, reason?}` | N1 o N2 según el estado | 403 si el nivel no corresponde o es propio; 409 si cambió la versión; 422 si hay movimientos pendientes. |
| `POST /supervision/cash-shifts/:id/reject` `{version, reason}` | N1 o N2 | |
| `POST /supervision/cash-shifts/:id/adjust` `{version, approvedAmount, denominationCounts?, reason}` | N2 | |
| `POST /supervision/cash-shifts/:id/reopen` `{reason}` | owner | |
| `POST /supervision/cash-shifts/:id/override-open-block` `{reason}` | owner | Desbloqueo de emergencia (P-2). No cambia el `review_status`; se permite una vez por corte. |
| `POST /cash-shifts/:id/recount` `{actualAmount, denominationCounts?, notes}` | cajero (`rechazado_n1`); cajero u OIS (`rechazado_n2`) | |
| `POST /supervision/cash-movements/:id/approve` · `/reject` | N1 (autor cajero) / N2 (autor OIS) | |
| `POST /supervision/cash-movements/:id/cancel` `{version, reason}` | supervisor/owner | Inserta un reverso. Solo si el corte del turno no tiene aprobación final. |
| `POST /supervision/cash-movements/:id/adjust` `{version, amount, reason}` | supervisor/owner | Inserta un reverso + un asiento `ajuste`. Misma restricción. |
| `GET /supervision/activity?branchId=&userId=&from=&to=` | supervisor/owner | Actividad de **caja** de cajeros y OIS: turnos, movimientos, acciones de N1. |
| `GET /supervision/audit-log?…` | supervisor/owner | |
| `GET /supervision/debts?branchId=&cashierId=&status=` | supervisor (asignadas), owner; cajero `?mine=true` | |
| `GET/PUT /supervision/assignments…` | owner | |
| `GET /notifications?unread=&branchId=&type=&from=&to=&page=` | cualquier usuario autenticado (solo las suyas) | Notificaciones persistentes (D-6). |
| `GET /notifications/unread-count` | ídem | Para la campana y el contador. |
| `POST /notifications/:id/read` · `POST /notifications/read-all` | ídem | |
| `GET /reports/sales-dashboard`, `/reports/sales/*` (con alcance) | supervisor (asignadas), owner | Ventas del supervisor (D-9/P-3). |
| `GET /reports/cash-shifts` (extendido) | con guard | `reviewStatus`, `approvedDifference`, filtro por estado. |

### 1.5 Notificaciones
- `notifications.service.ts`: un solo punto que, en la misma transacción del evento, inserta una fila en `notifications` por destinatario (spec §8: OIS de la sucursal, supervisores asignados, owner, cajero autor). Opcionalmente emite el evento WS al cuarto de la sucursal para refrescar más rápido.
- Al resolverse una entidad, se marcan leídas las notificaciones `requires_action` asociadas.
- Sin push ni dependencias nuevas (FCM queda como mejora futura).

### 1.6 Migraciones propuestas (NO ejecutar)

Archivo: `apps/sync_api/migrations/0022_supervisor_cash_approvals.sql`, más un bloque `IF NOT EXISTS` en `scripts/idempotent-deploy-migrations.ts`.

```sql
-- Tablas nuevas (detalle en data-model §3)
CREATE TABLE IF NOT EXISTS supervisor_branch_assignments (...);
CREATE TABLE IF NOT EXISTS cashier_debts (...);
CREATE TABLE IF NOT EXISTS notifications (...);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications (recipient_user_id, read_at, created_at DESC);
CREATE TABLE IF NOT EXISTS audit_log (...);
CREATE UNIQUE INDEX IF NOT EXISTS unq_sba_user_branch_active
  ON supervisor_branch_assignments (user_id, branch_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS unq_cashier_debt_shift_active
  ON cashier_debts (shift_id) WHERE status <> 'anulado';

-- cash_shifts
ALTER TABLE cash_shifts
  ADD COLUMN IF NOT EXISTS review_status varchar(30) NOT NULL DEFAULT 'no_aplica',
  ADD COLUMN IF NOT EXISTS client_uuid varchar(120),
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS closed_offline boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS local_expected_cash numeric(10,2),
  ADD COLUMN IF NOT EXISTS operator_reviewed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS operator_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS operator_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS approved_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS approved_difference numeric(10,2),
  ADD COLUMN IF NOT EXISTS recount_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS open_block_overridden_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS open_block_overridden_at timestamptz,
  ADD COLUMN IF NOT EXISTS open_block_override_reason text;
CREATE UNIQUE INDEX IF NOT EXISTS unq_cash_shift_client_uuid
  ON cash_shifts (client_uuid) WHERE client_uuid IS NOT NULL;

-- cash_shifts (ledger/aprobación)
ALTER TABLE cash_shifts
  ADD COLUMN IF NOT EXISTS n1_resolver_role varchar(30),
  ADD COLUMN IF NOT EXISTS approval_snapshot jsonb;

-- cash_transactions → ledger append-only (S-4)
ALTER TABLE cash_transactions
  ADD COLUMN IF NOT EXISTS client_uuid varchar(120),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS category varchar(40),
  ADD COLUMN IF NOT EXISTS entry_kind varchar(20) NOT NULL DEFAULT 'movimiento',
  ADD COLUMN IF NOT EXISTS reverses_transaction_id uuid REFERENCES cash_transactions(id),
  ADD COLUMN IF NOT EXISTS replaces_transaction_id uuid REFERENCES cash_transactions(id),
  ADD COLUMN IF NOT EXISTS cash_effect numeric(10,2) GENERATED ALWAYS AS (
    (CASE WHEN type = 'cash-in' THEN amount ELSE -amount END)
    * (CASE WHEN entry_kind = 'reverso' THEN -1 ELSE 1 END)) STORED,
  ADD COLUMN IF NOT EXISTS approval_status varchar(30) NOT NULL DEFAULT 'aprobado_historico',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS review_level varchar(10),
  ADD COLUMN IF NOT EXISTS device_id varchar(255),
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS unq_cash_tx_client_uuid
  ON cash_transactions (client_uuid) WHERE client_uuid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS unq_cash_tx_reverses
  ON cash_transactions (reverses_transaction_id) WHERE reverses_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_tx_shift_created ON cash_transactions (shift_id, created_at);
-- Trigger: impedir UPDATE de columnas financieras y todo DELETE en cash_transactions
-- (CREATE OR REPLACE FUNCTION cash_tx_immutable() ... ; CREATE TRIGGER ... BEFORE UPDATE OR DELETE)

REVOKE UPDATE, DELETE ON audit_log FROM pos_user;  -- o trigger equivalente
```

La migración es aditiva y compatible hacia atrás. **Ojo con D-4**: en cuanto el backend nuevo esté en producción, los cortes nuevos quedarán `pendiente_n1` y bloquearán la apertura del siguiente turno. Por eso el POS con la bandeja N1 tiene que publicarse **junto** con el backend; si no, ninguna sucursal podrá abrir caja. Para mitigarlo se propone una bandera de entorno `CASH_APPROVALS_ENFORCE_OPEN_BLOCK` (apagada hasta que el POS nuevo esté en todas las terminales). Orden de despliegue: migración → backend (bloqueo apagado) → Admin → POS → encender el bloqueo. Registrar todo en `docs/pre-deployment-checklist.md`.

## 2. Admin web (`apps/business_control_tauri`)

- `App.tsx` `roleTabs`:
  - `branch_supervisor: ['notifications', 'approvals', 'cash-activity', 'reports', 'debts', 'audit-log', 'help']`. `reports` muestra ventas y cortes solo de sus sucursales asignadas (D-9/P-3).
  - owner suma `notifications`, `approvals`, `cash-activity`, `debts`, `audit-log`, `supervision-assignments`.
  - Calcular pestañas con la unión de `user.roles` (R-4).
- `pages/ApprovalsPage.tsx` (patrón `RequisitionsApprovalPage.tsx`):
  - Pestañas "Cortes Z" y "Movimientos del OIS".
  - Por defecto, N2 pendiente. También deja ver lo que está en N1 (solo lectura).
  - Detalle: reporte (reusa el modal de auditoría de `ReportsPage.tsx`), esperado local vs servidor en cortes offline, **"Esperado al cierre" + "Ajustes posteriores al cierre" = "Esperado ajustado"**, movimientos agrupados (aprobados / pendientes / revertidos / ajustados) con botones **Cancelar / Ajustar**, e historial. Antes de confirmar un rechazo o cancelación, mostrar su impacto en la diferencia (R-16).
- `ReportsPage.tsx`: `reconcileCash` (línea 285) deja de calcular en el cliente y usa el `reconciliationStatus` del backend (sobre el esperado ajustado o aprobado). El CSV de cortes y la columna de diferencia usan `approvedDifference` (oficial) o la diferencia provisional marcada como tal.
  - Acciones: Aprobar / Rechazar / Aprobar con ajuste. Diseño móvil primero.
- Detalle de corte (owner): botón **"Desbloquear apertura"** con motivo obligatorio cuando la sucursal está bloqueada (P-2).
- `pages/CashActivityPage.tsx`: actividad de caja por sucursal y por usuario (cajero/OIS): turnos, movimientos y decisiones del OIS.
- `pages/DebtsPage.tsx`: consulta de adeudos con filtros y su historial en la bitácora (solo lectura, P-1).
- **`pages/NotificationsPage.tsx`** (nueva sección "Notificaciones", D-6): lista con filtros (no leídas, sucursal, tipo, fecha), resaltado de las que requieren acción, enlace al detalle y "marcar como leída" / "marcar todas". Campana con contador en `AdminLayout.tsx` (polling cada 60 s a `/notifications/unread-count`).
- `pages/AuditLogPage.tsx`; asignaciones de supervisores (owner).
- `services/api.ts`: tipos y métodos de §1.4.
- Tests: render por rol (el supervisor no ve ventas), aprobar con 409, cancelar/ajustar.

## 3. POS Flutter (`apps/pos_flutter`)

- **`app_state.dart`**:
  - `recordCashMovement({type, category, amount, note})` con `clientUuid`, encolado offline en `_pendingCashMovementJobs`.
  - `closeShift(...)`:
    - Con conexión, como hoy, más `clientUuid`.
    - **Sin conexión**: calcular el esperado local, encolar en `_pendingShiftCloseJobs`, marcar el turno cerrado localmente con `pendiente_sync` e imprimir un ticket "PROVISIONAL".
  - Sincronización ordenada por turno: ventas → movimientos → Corte Z (OF-03).
  - `openShift`: si el servidor responde 409 por D-4, mostrar el motivo y, si el usuario es OIS, un acceso directo a la bandeja "Por aprobar".
  - OIS: `fetchPendingApprovals()`, `approveItem`, `rejectItem` (solo en línea), `recountShift`.
  - Cajero: `fetchMyDebts()`.
  - Eventos WS `approval_requested` / `approval_resolved`.
  - **Notificaciones**: `fetchNotifications()` / `unreadCount` por REST (polling cuando hay conexión) y contador en la pestaña Caja; al tocar una, abrir la bandeja o el detalle.
  - `_parseRole`: `branch_supervisor` → `UserRole.none` (el supervisor no tiene dashboard POS).
- **`ui/encargado/encargado_caja_tab.dart` (OIS)**:
  - Sección **"Por aprobar"** con contador: cortes y movimientos de cajeros de su sucursal (lo suyo no aparece porque va al supervisor).
  - Sección **"Cortes por recontar"** cuando el supervisor rechazó.
- **Diálogos de ingreso/retiro y Corte Z** (`encargado_caja_tab.dart`, `cashier/shift_control_panel.dart`):
  - Categoría estructurada.
  - Chips de estado (Pendiente OIS, Pendiente supervisor, Aprobado, Rechazado, Cancelado, Ajustado).
  - Aviso de corte rechazado con botón "Recontar".
  - Ticket provisional offline.
- **Cajero**: aviso de adeudo y lista "Mis adeudos".
- Tests: bandeja N1, bloqueo de apertura, cola offline con idempotencia y orden, ticket provisional.

## 4. Documentación al implementar

- `knowledge/business-rules/roles-permissions-rules.md`: `branch_supervisor`, BR-ROLE-005 (cadena de caja), BR-ROLE-006 (alcance por asignación, también en ventas), BR-ROLE-007 (desbloqueo de emergencia del owner).
- `docs/pre-deployment-checklist.md`: migración 0022 y orden de despliegue con la bandera.
- `HANDOFF.md`, `.claude/workspaces.md`.

## 5. Secuencia sugerida

1. **Backend**: paso 0 → migración (local/staging) → alcance → bitácora → máquina de estados → shifts (bloqueo detrás de la bandera) → adeudos → notificaciones REST → desbloqueo de emergencia → tests.
2. **POS (`codex`)**: movimiento estructurado + idempotencia → bandeja N1 → manejo del 409 de apertura → Corte Z offline + orden de sync → notificaciones → adeudos.
3. **Admin (`opencode`)**: NotificationsPage + campana → ApprovalsPage → cancelar/ajustar → desbloqueo → CashActivity → reportes con alcance → Debts → AuditLog.
4. **Staging E2E**:
   - Retiro del cajero → OIS aprueba.
   - Retiro del OIS → supervisor aprueba.
   - Supervisor ajusta un movimiento → cambia la diferencia del corte.
   - Corte Z con faltante: OIS aprueba → supervisor rechaza → nuevo conteo → supervisor aprueba → adeudo generado.
   - Apertura bloqueada con el corte en N1.
   - Corte Z offline → sincroniza en orden y sin duplicar.
   - Notificaciones visibles en `GET /notifications` y en la sección del Admin web; desbloqueo de emergencia del owner.

## 6. Estimación gruesa

| Bloque | Tamaño |
|---|---|
| Paso 0 | S |
| Backend | L |
| Notificaciones REST + sección Admin | S–M |
| Admin | L |
| POS (incluye Corte Z offline) | L |
| QA staging + docs | M |

## Fuera de Fase 1

Umbrales y PIN en sitio (§5 de la spec), auto-cierre >24 h (R-7), push al celular (D-6), gestión de cobro de adeudos (P-1).

## Project Structure (documentation)

```text
specs/019-supervisor-sucursal/
├── brief.md
├── spec.md
├── plan.md
└── data-model.md
```

`research.md`, `contracts/`, `quickstart.md` y `tasks.md` se generan al aprobar la propuesta.
