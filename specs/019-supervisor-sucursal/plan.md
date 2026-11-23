# Implementation Plan: Supervisor de Sucursal — Fase 1

**Branch**: `019-supervisor-sucursal` | **Date**: 2026-11-22 (decisiones del dueño aplicadas) | **Spec**: [spec.md](spec.md) | **Data model**: [data-model.md](data-model.md)

> Propuesta. No se ha implementado ni migrado nada. D-1, D-3, D-10 y D-11 están resueltas. Antes de empezar conviene confirmar los supuestos S-1 a S-6 de [spec.md §15.2](spec.md#152-supuestos-a-confirmar-con-el-dueño-no-se-inventan-reglas), sobre todo S-1 (si N2 es obligatorio para todo) y S-3 (quién hace N1 cuando el autor es el operador).

## Summary

Agregar el rol `branch_supervisor` con varias sucursales asignadas y una **cadena de aprobación de dos niveles**, sin umbrales, para **cada** Corte Z y **cada** ingreso/egreso:

1. **N1, operador de sucursal** (`branch_operator`): aprueba o rechaza desde el POS.
2. **N2, supervisor asignado o administrador**: aprueba, rechaza o ajusta desde la bandeja del Admin web.

Todo queda en una bitácora append-only. La operación de caja en el POS no se bloquea; lo nuevo es la capa de control.

## Technical Context

- **Backend**: NestJS + Drizzle + PostgreSQL (`apps/sync_api`).
- **Admin web**: React + Vite + Tailwind (`apps/business_control_tauri`), https://cacharelo-central.web.app/.
- **POS**: Flutter, `AppState` (ChangeNotifier) en `lib/ui/common/app_state.dart`.
- **Constraints**: autorización en el servidor (BR-ROLE-004); no bloquear ventas; idempotencia en reintentos del POS; migraciones idempotentes coordinadas en `.claude/workspaces.md`.

## Constitution Check

- **Offline continuity**: PASS — los movimientos se encolan offline; el Corte Z sigue en línea (como hoy); las aprobaciones requieren conexión.
- **Local authority**: Las decisiones N1/N2 son del servidor; el POS nunca aprueba localmente.
- **Sync contract**: Nuevos eventos WS `approval_requested` / `approval_resolved` en el cuarto de sucursal existente; nuevo job de cola para movimientos.
- **Cloud role**: Nuevos endpoints, 2 tablas nuevas y columnas en 2 existentes; migración propuesta, no ejecutada.
- **Verification**: tests de autorización (como `shifts.authorization.spec.ts`, `reports.authorization.spec.ts`), tests de servicio para cada transición, widget tests Flutter, `make check-all`.

---

## 0. Pre-requisito independiente (recomendado antes de Fase 1)

Proteger los endpoints de `ReportsController` que hoy no tienen guard (`cash-shifts`, `sales/payment-methods`, `sales/products`, `inventory/existence`, `inventory/kardex`) con `JwtAuthGuard + RolesGuard + assertScope` (spec R-1). Antes, verificar que el Admin web y el POS envían `Authorization` en esas llamadas. PR separado y pequeño.

## 1. Backend (`apps/sync_api`)

### 1.1 Roles y alcance
- `modules/auth/roles.ts`: `SUPERVISION_ROLES = ['branch_supervisor']`, `BRANCH_SUPERVISOR_ROLE`. **No** tocar `ADMIN_ROLES` (spec R-2).
- Constante `CASH_APPROVAL_ADMIN_ROLES = [OWNER_ROLE]`, ampliable según S-2 (`inventory_admin`, `support_tech`).
- Nuevo `modules/supervision/approval-scope.service.ts`:
  - `canActN1(user, branchId)`: `branch_operator` con `user.branchId === branchId` (+ S-6 si se habilita a otros).
  - `canActN2(user, branchId)`: supervisor con asignación activa, o administrador con acceso al negocio (`assertBusinessAccess`).
  - `getVisibleBranchIds(user)`.
- `users.service.ts` / `admin-users.controller.ts`: permitir crear y editar usuarios con `branch_supervisor` (login email+password para el Admin web).

### 1.2 Módulo nuevo `modules/supervision`
```
supervision/
├── supervision.module.ts
├── approvals.controller.ts      # bandeja N1 (POS) y N2 (Admin), acciones
├── assignments.controller.ts    # owner
├── audit-log.controller.ts
├── approvals.service.ts         # máquina de estados N1→N2 + reglas CZ/MV
├── audit-log.service.ts         # insert dentro de la transacción del llamador
├── approval-scope.service.ts
├── dto/…
└── *.spec.ts                    # incl. supervision.authorization.spec.ts
```

Máquina de estados centralizada en `approvals.service.ts`: una tabla de transiciones `(estado, nivel, acción) → estado`, que se usa tanto para cortes como para movimientos. Así, si cambia S-1 o S-5, se modifica una sola tabla.

### 1.3 Cambios en `modules/shifts`
- `closeShift`: recibir el actor (`closed_by`), `review_status = pendiente_operador`, `audit_log` (`corte_z_cerrado`), evento WS `approval_requested`. Todo en una transacción.
- `openShift` (auto-cierre >24 h): **sin cambios en Fase 1** (D-11). Los auto-cerrados quedan `no_aplica`.
- `createTransaction`: `created_by`, `category`, `client_uuid` (`ON CONFLICT DO NOTHING` y devolver el existente), `approval_status = pendiente_operador`, validar que el esperado no quede negativo (MV-05), bitácora y evento WS.
- `buildShiftReport`: excluir movimientos `cancelado` (S-4); incluir `approvalStatus` por movimiento y `reviewStatus` del turno.
- `CreateTransactionDto`: `category` (enum), `clientUuid?`.
- Nuevo `POST /cash-shifts/:id/recount` (cajero dueño del turno o `branch_operator` de la sucursal) → `pendiente_operador` (S-5).
- Nuevo `POST /cash-shifts/:id/transactions/:txId/cancel` (solo `pendiente_operador`, solo su creador).
- `ShiftsController.ownedShift` sigue exigiendo "mi caja"; el reconteo y la bandeja del operador necesitan un chequeo por sucursal, no por cajero.

### 1.4 Endpoints

| Método y ruta | Quién | Descripción |
|---|---|---|
| `GET /supervision/approvals?level=n1\|n2&type=corte_z\|cash_movement&status=&branchId=&from=&to=` | N1: operador (su sucursal) · N2: supervisor (asignadas), administrador | Bandeja. |
| `GET /supervision/approvals/count?level=` | ídem | Contador para badge. |
| `GET /supervision/cash-shifts/:id` | operador (su sucursal), supervisor, administrador | Reporte de corte (reusa `getCorteReport`) + movimientos con estado + historial de bitácora. |
| `POST /supervision/cash-shifts/:id/approve` `{version, reason?}` | N1 o N2 según estado | `pendiente_operador`→`pendiente_supervisor` (N1); `pendiente_supervisor`→`aprobado` (N2). 409 si cambió `version`; 422 si hay movimientos pendientes en ese nivel; 403 si `closed_by == actor` o el nivel no corresponde. |
| `POST /supervision/cash-shifts/:id/reject` `{version, reason}` | N1 o N2 | → `rechazado`; aviso a la sucursal. |
| `POST /supervision/cash-shifts/:id/adjust` `{version, approvedAmount, denominationCounts?, reason}` | N2 | → `aprobado_con_ajuste`. |
| `POST /supervision/cash-shifts/:id/reopen` `{reason}` | owner | `aprobado*` → `reabierto` → `pendiente_supervisor`. |
| `POST /supervision/cash-movements/:id/approve` `{version, reason?}` | N1 o N2 según estado | Igual que el corte. |
| `POST /supervision/cash-movements/:id/reject` `{version, reason}` | N1 o N2 | → `rechazado` (sigue contando como incidencia, S-4). |
| `GET /supervision/audit-log?branchId=&entityType=&entityId=&actorId=&action=&from=&to=` | supervisor (asignadas), administrador | Consulta paginada; CSV en el cliente. |
| `GET /supervision/assignments?userId=\|branchId=` | owner | |
| `PUT /supervision/assignments/:userId` `{branchIds[]}` | owner | Diff → altas/revocaciones + bitácora. |
| `POST /cash-shifts/:id/recount` `{actualAmount, denominationCounts?, notes}` | cajero (su turno), operador (su sucursal) | Solo si `rechazado`. |
| `POST /cash-shifts/:id/transactions/:txId/cancel` | creador | Solo si `pendiente_operador`. |
| `GET /reports/cash-shifts` (extendido) | con guard (paso 0) | Agrega `reviewStatus`, `approvedDifference` y filtro `reviewStatus`. |

Un solo endpoint `approve` decide el nivel según el estado actual y el rol del actor. Esto evita que alguien "salte" a N2 con una petición directa (SC-003).

### 1.5 Notificaciones
- `sync.gateway.ts`: `notifyBranch(branchId, payload)` con `tipo: 'approval_requested' | 'approval_resolved'`, usando `activeClients` por sucursal (llega a la terminal del operador para N1).
- N2: polling del contador en el Admin web (60 s). Fase 2: cuarto `user:{id}` o push.

### 1.6 Migraciones propuestas (NO ejecutar)

Archivo propuesto: `apps/sync_api/migrations/0022_supervisor_cash_approvals.sql`, más un bloque equivalente con `IF NOT EXISTS` en `scripts/idempotent-deploy-migrations.ts` (el journal de Drizzle no es confiable en prod; ver `AGENTS.md`).

```sql
-- 1) Tablas nuevas
CREATE TABLE IF NOT EXISTS supervisor_branch_assignments (... ver data-model §3.1);
CREATE UNIQUE INDEX IF NOT EXISTS unq_sba_user_branch_active
  ON supervisor_branch_assignments (user_id, branch_id) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS audit_log (... §3.2);

-- 2) cash_shifts
ALTER TABLE cash_shifts
  ADD COLUMN IF NOT EXISTS review_status varchar(30) NOT NULL DEFAULT 'no_aplica',
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS operator_reviewed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS operator_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS operator_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS approved_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS approved_difference numeric(10,2),
  ADD COLUMN IF NOT EXISTS recount_count integer NOT NULL DEFAULT 0;

-- 3) cash_transactions
ALTER TABLE cash_transactions
  ADD COLUMN IF NOT EXISTS client_uuid varchar(120),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS category varchar(40),
  ADD COLUMN IF NOT EXISTS approval_status varchar(30) NOT NULL DEFAULT 'aprobado_historico',
  ADD COLUMN IF NOT EXISTS operator_reviewed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS operator_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS operator_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS device_id varchar(255),
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS unq_cash_tx_client_uuid
  ON cash_transactions (client_uuid) WHERE client_uuid IS NOT NULL;

-- 4) Bitácora inmutable
REVOKE UPDATE, DELETE ON audit_log FROM pos_user;  -- o trigger equivalente
```

Todo es aditivo y con defaults, así que es compatible hacia atrás. Ojo: un POS viejo que no envíe `category`/`clientUuid` también generará movimientos `pendiente_operador` (lo decide el servidor) sin categoría. Por eso conviene publicar la versión del POS junto con el backend. **Orden de despliegue**: migración → backend → Admin → POS. Registrar en `docs/pre-deployment-checklist.md` cuando se implemente.

## 2. Admin web (`apps/business_control_tauri`), bandeja N2 en Fase 1 (D-10)

- `App.tsx` `roleTabs`:
  - `branch_supervisor: ['approvals', 'reports', 'audit-log', 'help']` (en `reports` solo la pestaña "Cortes de Caja").
  - owner (y los roles que confirme S-2) suma `approvals`, `audit-log`, `supervision-assignments`.
  - Calcular pestañas con la unión de `user.roles` (spec R-4) y añadir `branch_supervisor` a `allowedBusinessIds`.
- Nueva `pages/ApprovalsPage.tsx` (patrón `RequisitionsApprovalPage.tsx`):
  - Pestañas "Cortes Z" y "Movimientos de caja"; filtros por sucursal, estado y fecha.
  - Por defecto, `pendiente_supervisor`. También deja ver `pendiente_operador` (solo lectura) para saber qué está atorado en N1.
  - Detalle con el reporte de corte (reusar el modal de auditoría de `ReportsPage.tsx`), movimientos con su estado, quién aprobó N1 y el historial de bitácora.
  - Acciones: Aprobar / Rechazar (motivo) / Aprobar con ajuste (monto + motivo).
  - Diseño móvil primero (el supervisor está en campo; seguir las guías de responsividad de `AGENTS.md`).
- Badge con contador de pendientes N2 en `AdminLayout.tsx` (polling 60 s).
- `ReportsPage.tsx`, pestaña "Cortes de Caja": columna "Revisión", filtro por `reviewStatus`, CSV con la columna.
- Nueva `pages/AuditLogPage.tsx`: tabla filtrable, antes/después legible, export CSV.
- Asignación de sucursales a supervisores (owner): sección en la página de Personal/Administradores o página propia.
- `services/api.ts`: tipos `ReviewStatus`, `CashMovementApprovalStatus`, `ApprovalItem`, `AuditLogEntry`, `SupervisorAssignment` y métodos para cada endpoint de §1.4.
- Tests: Vitest/Playwright para la bandeja (render por rol; aprobar con 409 → recarga; supervisor no ve sucursales no asignadas).

## 3. POS Flutter (`apps/pos_flutter`), registro y bandeja N1

- `app_state.dart`:
  - `addCashDrop` / `removeCashDrop` → `recordCashMovement({type, category, amount, note})` con `clientUuid` (uuid v4), encolado offline (OF-01). El cajón se actualiza como hoy (S-4).
  - `closeShift`: leer `reviewStatus` de la respuesta y mostrarlo en el resumen.
  - Para el operador: `fetchPendingApprovals()`, `approveItem(...)`, `rejectItem(...)` (solo en línea, OF-03) y `recountShift(...)`.
  - Manejo de los eventos WS `approval_requested` (refresca la bandeja y el contador del operador) y `approval_resolved` (refresca el estado del cajero).
  - `_parseRole`: `branch_supervisor` → `UserRole.none` (sin dashboard POS en Fase 1).
- `ui/encargado/encargado_caja_tab.dart` (operador):
  - Nueva sección **"Por aprobar"** con contador: cortes Z y movimientos de su sucursal en `pendiente_operador`, detalle (reusa la vista de Corte X/Z existente) y botones Aprobar / Rechazar (motivo). Los suyos aparecen deshabilitados con la leyenda "requiere otro operador" (S-3).
  - Sección **"Cortes por recontar"** reutilizando el formulario de denominaciones existente.
- `ui/encargado/encargado_caja_tab.dart` y `ui/cashier/shift_control_panel.dart` (diálogos de ingreso/retiro ya existentes):
  - Categoría como valor estructurado (mismas etiquetas que hoy).
  - Lista de movimientos del turno con chip de estado (Pendiente operador, Pendiente supervisor, Aprobado, Rechazado).
  - Resumen de Corte Z con chip de estado y aviso "Rechazado — recontar".
- Ticket térmico de Corte Z: línea "Estado de revisión" (opcional).
- Tests: widget tests de la bandeja N1 (aprobar, rechazar con motivo, ítem propio deshabilitado) y test de la cola offline con `clientUuid`.

## 4. Documentación a actualizar al implementar

- `knowledge/business-rules/roles-permissions-rules.md`: rol `branch_supervisor`, BR-ROLE-005 (cadena N1→N2 para caja; no auto-aprobación), BR-ROLE-006 (alcance por asignación).
- `docs/pre-deployment-checklist.md`: migración 0022 y orden de despliegue.
- `HANDOFF.md`, `.claude/workspaces.md`.

## 5. Secuencia sugerida y reparto (agentes)

1. **Backend (`agy`/claude)**: paso 0 → migración (local/staging) → roles/alcance → `audit_log` → máquina de estados → cambios en shifts → endpoints → tests de autorización.
2. **POS (`codex`)**: movimiento estructurado + idempotencia → estados en UI → bandeja N1 del operador → reconteo → cola offline.
3. **Admin (`opencode`)**: tipos y API → ApprovalsPage (N2) → columna en ReportsPage → AuditLog → asignaciones.
4. **Staging E2E**:
   - Retiro del cajero → operador aprueba en POS → supervisor aprueba en Admin → POS refleja `aprobado`.
   - Corte Z con faltante → operador aprueba → administrador rechaza → reconteo → N1 → N2 aprueba.
   - Verificar la bitácora y los 403 por auto-aprobación y por sucursal no asignada.

## 6. Estimación gruesa

| Bloque | Tamaño |
|---|---|
| Paso 0 (guards de reportes) | S |
| Backend Fase 1 | L |
| Admin Fase 1 (bandeja N2, bitácora, asignaciones) | M–L |
| POS Fase 1 (bandeja N1, estados, offline) | M–L |
| QA staging + docs | M |

## Fuera de Fase 1 (por decisión del dueño)

- Umbrales configurables, autorización previa y PIN en sitio (spec §5, D-3/D-7).
- Turnos auto-cerrados >24 h: marcado `auto_closed`, revisión y diferencia "sin conteo" (spec R-7, D-11).

## Project Structure (documentation)

```text
specs/019-supervisor-sucursal/
├── brief.md        # pedido del dueño (input)
├── spec.md         # problema, flujos, reglas, permisos, decisiones y supuestos
├── plan.md         # este archivo
└── data-model.md   # tablas/columnas propuestas
```

`research.md`, `contracts/`, `quickstart.md` y `tasks.md` se generarán cuando el dueño confirme los supuestos S-1 a S-6.
