# Implementation Plan: Supervisor de Sucursal — Fase 1

**Branch**: `019-supervisor-sucursal` | **Date**: 2026-11-22 (segunda ronda de decisiones del dueño) | **Spec**: [spec.md](spec.md) | **Data model**: [data-model.md](data-model.md)

> Propuesta. No se ha implementado ni migrado nada. Las decisiones D-1 a D-11 y los supuestos S-1 a S-6 están resueltos. Quedan P-1 a P-3 ([spec.md §15.3](spec.md#153-detalles-menores-por-confirmar)), que no bloquean el inicio.

## Summary

- **Corte Z**: dos niveles obligatorios. N1 es el OIS de la sucursal, en el POS. N2 es el supervisor asignado o el owner, en el Admin web. Si el corte lo cerró el OIS, va directo a N2.
- **Ingresos/egresos**: cuentan al registrarse y los aprueba el OIS. Si el autor es el OIS, los aprueba el supervisor. El supervisor u owner puede cancelarlos o ajustarlos hasta que se apruebe el corte.
- **Bloqueo de apertura**: no se abre turno mientras el OIS no apruebe el Corte Z anterior.
- **Corte Z offline**, con recálculo en el servidor.
- **Adeudo del cajero** por faltante aprobado.
- **Push en celular** y bitácora append-only.
- El supervisor solo ve caja; no ve ventas en vivo.

## Technical Context

- **Backend**: NestJS + Drizzle + PostgreSQL (`apps/sync_api`). Envío de push con `firebase-admin` (nuevo).
- **Admin web**: React + Vite + Tailwind (`apps/business_control_tauri`), Firebase Hosting. Web Push con el SDK `firebase/messaging` (nuevo) y un service worker.
- **POS**: Flutter, `AppState` en `lib/ui/common/app_state.dart`. Push con `firebase_messaging` (nuevo; Android y web).
- **Constraints**: autorización en el servidor (BR-ROLE-004); idempotencia de todo lo que se encola offline; orden de sincronización ventas → movimientos → Corte Z; migraciones idempotentes coordinadas.

## Constitution Check

- **Offline continuity**: movimientos y Corte Z funcionan offline. Abrir turno ya requiere conexión hoy, y con D-4 además requiere que el OIS haya aprobado el corte anterior (riesgo R-8 aceptado por el dueño).
- **Local authority**: el esperado oficial y todas las aprobaciones son del servidor. El ticket offline es provisional.
- **Sync contract**: nuevos jobs de cola (movimiento, Corte Z), eventos WS `approval_requested` / `approval_resolved` y push.
- **Cloud role**: 4 tablas nuevas y columnas en 2 existentes. Migración propuesta, no ejecutada.
- **Verification**: tests de autorización por nivel, tests de la máquina de estados, test de idempotencia/orden de sincronización, widget tests y `make check-all`.

---

## 0. Pre-requisito independiente (antes de Fase 1)

Proteger los endpoints de `ReportsController` que no tienen guard (`cash-shifts`, `sales/payment-methods`, `sales/products`, `inventory/existence`, `inventory/kardex`) con `JwtAuthGuard + RolesGuard + assertScope` (R-1). Además, **excluir `branch_supervisor`** de los endpoints de ventas (`sales-dashboard`, `sales/*`, `tickets/today`) para cumplir D-9. PR separado.

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
├── debts.controller.ts           # adeudos (D-8)
├── push.controller.ts            # registrar/revocar token FCM
├── approvals.service.ts          # máquina de estados (tabla de transiciones)
├── debts.service.ts
├── notifications.service.ts      # WS + FCM (firebase-admin)
├── audit-log.service.ts
├── approval-scope.service.ts
└── *.spec.ts
```

Tabla de transiciones en `approvals.service.ts` (fuente única):

| Entidad | Estado | Actor | Acción | Nuevo estado |
|---|---|---|---|---|
| Corte | (cierre) autor cajero | — | cerrar | `pendiente_operador` |
| Corte | (cierre) autor OIS | — | cerrar | `pendiente_supervisor` |
| Corte | `pendiente_operador` | N1 | aprobar / rechazar | `pendiente_supervisor` / `rechazado_operador` |
| Corte | `rechazado_operador` | cajero | reconteo | `pendiente_operador` |
| Corte | `pendiente_supervisor` | N2 | aprobar / ajustar / rechazar | `aprobado` / `aprobado_con_ajuste` / `rechazado_supervisor` |
| Corte | `rechazado_supervisor` | cajero u OIS | reconteo | `pendiente_supervisor` |
| Corte | `rechazado_supervisor` | N2 | ajustar | `aprobado_con_ajuste` |
| Corte | `aprobado*` | owner | reabrir | `pendiente_supervisor` (anula el adeudo) |
| Movimiento | (alta) autor cajero / OIS | — | registrar | `pendiente_operador` / `pendiente_supervisor` |
| Movimiento | `pendiente_operador` | N1 | aprobar / rechazar | `aprobado` / `rechazado` |
| Movimiento | `pendiente_supervisor` | N2 | aprobar / rechazar | `aprobado` / `rechazado` |
| Movimiento | cualquiera salvo `cancelado`, con el corte sin aprobar | N2 | cancelar / ajustar | `cancelado` / (mismo estado, monto nuevo) |

Al pasar a `aprobado*` con diferencia final < 0, `debts.service` crea el adeudo en la misma transacción.

### 1.3 Cambios en `modules/shifts`
- **`openShift`**: antes de crear el turno, buscar el último corte de la sucursal. Si su `review_status` es `pendiente_operador` o `rechazado_operador`, responder **409** con el mensaje "El Corte Z anterior debe ser aprobado por el operador de sucursal". Además, evento `apertura_bloqueada` en la bitácora y push al OIS (D-4). El auto-cierre >24 h no cambia (D-11) y queda `no_aplica`.
- **`closeShift`**: aceptar `clientUuid`, `closedOffline`, `localExpectedCash` y `closedAt` del cliente. Idempotente por `client_uuid`. Recalcular el esperado en el servidor; `closed_by` = actor; estado inicial según el autor; bitácora; WS + push.
- **`createTransaction`**: `created_by`, `category`, `client_uuid` (`ON CONFLICT` devuelve el existente), estado según el autor, validación de esperado no negativo, bitácora, WS + push. Debe aceptar movimientos offline que llegan **después** del cierre de su turno, si fueron creados antes del `closedAt` (orden de sincronización, OF-03).
- **`buildShiftReport`**: excluir `cancelado`, usar el monto vigente e incluir estados.
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
| `POST /cash-shifts/:id/recount` `{actualAmount, denominationCounts?, notes}` | cajero (`rechazado_operador`); cajero u OIS (`rechazado_supervisor`) | |
| `POST /supervision/cash-movements/:id/approve` · `/reject` | N1 (autor cajero) / N2 (autor OIS) | |
| `POST /supervision/cash-movements/:id/cancel` `{version, reason}` | supervisor/owner | Solo si el corte del turno no está aprobado. |
| `POST /supervision/cash-movements/:id/adjust` `{version, amount, reason}` | supervisor/owner | ídem. |
| `GET /supervision/activity?branchId=&userId=&from=&to=` | supervisor/owner | Actividad de **caja** de cajeros y OIS (D-9): turnos, movimientos, acciones de N1. |
| `GET /supervision/audit-log?…` | supervisor/owner | |
| `GET /supervision/debts?branchId=&cashierId=&status=` | supervisor (asignadas), owner; cajero `?mine=true` | |
| `POST /supervision/debts/:id/resolve` `{status: liquidado\|condonado, notes}` | owner (P-1) | |
| `GET/PUT /supervision/assignments…` | owner | |
| `POST /push/subscriptions` `{fcmToken, platform, app, branchId?}` · `DELETE /push/subscriptions/:token` | cualquier usuario autenticado | |
| `GET /reports/cash-shifts` (extendido) | con guard | `reviewStatus`, `approvedDifference`, filtro por estado. |

### 1.5 Notificaciones
- `notifications.service.ts`: un solo punto que envía el evento WS al cuarto de la sucursal (`sync.gateway.ts`) y el push FCM a los destinatarios de la spec §8 (OIS de la sucursal, supervisores asignados, owner, cajero autor).
- Credenciales FCM en Secret Manager, igual que `pos-jwt-secret`.
- Tokens inválidos → `revoked_at`.

### 1.6 Migraciones propuestas (NO ejecutar)

Archivo: `apps/sync_api/migrations/0022_supervisor_cash_approvals.sql`, más un bloque `IF NOT EXISTS` en `scripts/idempotent-deploy-migrations.ts`.

```sql
-- Tablas nuevas (detalle en data-model §3)
CREATE TABLE IF NOT EXISTS supervisor_branch_assignments (...);
CREATE TABLE IF NOT EXISTS cashier_debts (...);
CREATE TABLE IF NOT EXISTS push_subscriptions (...);
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
  ADD COLUMN IF NOT EXISTS recount_count integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS unq_cash_shift_client_uuid
  ON cash_shifts (client_uuid) WHERE client_uuid IS NOT NULL;

-- cash_transactions
ALTER TABLE cash_transactions
  ADD COLUMN IF NOT EXISTS client_uuid varchar(120),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS category varchar(40),
  ADD COLUMN IF NOT EXISTS approval_status varchar(30) NOT NULL DEFAULT 'aprobado_historico',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS review_level varchar(10),
  ADD COLUMN IF NOT EXISTS original_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS adjusted_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS adjusted_at timestamptz,
  ADD COLUMN IF NOT EXISTS adjust_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS device_id varchar(255),
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS unq_cash_tx_client_uuid
  ON cash_transactions (client_uuid) WHERE client_uuid IS NOT NULL;

REVOKE UPDATE, DELETE ON audit_log FROM pos_user;  -- o trigger equivalente
```

La migración es aditiva y compatible hacia atrás. **Ojo con D-4**: en cuanto el backend nuevo esté en producción, los cortes nuevos quedarán `pendiente_operador` y bloquearán la apertura del siguiente turno. Por eso el POS con la bandeja N1 tiene que publicarse **junto** con el backend; si no, ninguna sucursal podrá abrir caja. Para mitigarlo se propone una bandera de entorno `CASH_APPROVALS_ENFORCE_OPEN_BLOCK` (apagada hasta que el POS nuevo esté en todas las terminales). Orden de despliegue: migración → backend (bloqueo apagado) → Admin → POS → encender el bloqueo. Registrar todo en `docs/pre-deployment-checklist.md`.

## 2. Admin web (`apps/business_control_tauri`)

- `App.tsx` `roleTabs`:
  - `branch_supervisor: ['approvals', 'cash-activity', 'debts', 'audit-log', 'help']`. **Sin** `reports` de ventas (D-9); los cortes se ven en `approvals` / `cash-activity`.
  - owner suma `approvals`, `cash-activity`, `debts`, `audit-log`, `supervision-assignments`.
  - Calcular pestañas con la unión de `user.roles` (R-4).
- `pages/ApprovalsPage.tsx` (patrón `RequisitionsApprovalPage.tsx`):
  - Pestañas "Cortes Z" y "Movimientos del OIS".
  - Por defecto, N2 pendiente. También deja ver lo que está en N1 (solo lectura).
  - Detalle: reporte (reusa el modal de auditoría de `ReportsPage.tsx`), esperado local vs servidor en cortes offline, movimientos con botones **Cancelar / Ajustar**, e historial.
  - Acciones: Aprobar / Rechazar / Aprobar con ajuste. Diseño móvil primero.
- `pages/CashActivityPage.tsx`: actividad de caja por sucursal y por usuario (cajero/OIS): turnos, movimientos y decisiones del OIS (D-9).
- `pages/DebtsPage.tsx`: adeudos con filtros; el owner marca `liquidado`/`condonado` (P-1).
- `pages/AuditLogPage.tsx`; asignaciones de supervisores (owner).
- **Push**: `firebase/messaging`, service worker `firebase-messaging-sw.js` en el build de Hosting, solicitud de permiso tras el login y `POST /push/subscriptions`.
- Badge de pendientes en `AdminLayout.tsx` (polling 60 s como respaldo del push).
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
  - **Push**: `firebase_messaging`; registrar el token al iniciar sesión y revocarlo al cerrarla; al tocar una notificación, abrir la bandeja o el detalle.
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

- `knowledge/business-rules/roles-permissions-rules.md`: `branch_supervisor`, BR-ROLE-005 (cadena de caja), BR-ROLE-006 (alcance por asignación), BR-ROLE-007 (supervisor sin ventas en vivo).
- `docs/pre-deployment-checklist.md`: migración 0022, secretos FCM y orden de despliegue con la bandera.
- `HANDOFF.md`, `.claude/workspaces.md`.

## 5. Secuencia sugerida

1. **Backend**: paso 0 → migración (local/staging) → alcance → bitácora → máquina de estados → shifts (bloqueo detrás de la bandera) → adeudos → notificaciones/FCM → tests.
2. **POS (`codex`)**: movimiento estructurado + idempotencia → bandeja N1 → manejo del 409 de apertura → Corte Z offline + orden de sync → push → adeudos.
3. **Admin (`opencode`)**: ApprovalsPage → cancelar/ajustar → CashActivity → Debts → AuditLog → push web.
4. **Staging E2E**:
   - Retiro del cajero → OIS aprueba.
   - Retiro del OIS → supervisor aprueba.
   - Supervisor ajusta un movimiento → cambia la diferencia del corte.
   - Corte Z con faltante: OIS aprueba → supervisor rechaza → nuevo conteo → supervisor aprueba → adeudo generado.
   - Apertura bloqueada con el corte en N1.
   - Corte Z offline → sincroniza en orden y sin duplicar.
   - Push recibido en Android y en web.

## 6. Estimación gruesa

| Bloque | Tamaño |
|---|---|
| Paso 0 | S |
| Backend | L |
| Push (FCM en las 3 apps) | M |
| Admin | L |
| POS (incluye Corte Z offline) | L |
| QA staging + docs | M |

## Fuera de Fase 1

Umbrales y PIN en sitio (§5 de la spec), auto-cierre >24 h (R-7), ventas en vivo para el supervisor (D-9).

## Project Structure (documentation)

```text
specs/019-supervisor-sucursal/
├── brief.md
├── spec.md
├── plan.md
└── data-model.md
```

`research.md`, `contracts/`, `quickstart.md` y `tasks.md` se generan al aprobar la propuesta.
