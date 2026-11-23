# Implementation Plan: Supervisor de Sucursal — Fase 1

**Branch**: `019-supervisor-sucursal` | **Date**: 2026-11-22 | **Spec**: [spec.md](spec.md) | **Data model**: [data-model.md](data-model.md)

> Propuesta. No se ha implementado ni migrado nada. Requiere que el dueño resuelva las decisiones abiertas de [spec.md §15](spec.md#15-decisiones-abiertas-para-el-dueño) (al menos D-1, D-2 y D-3) antes de empezar.

## Summary

Agregar el rol `branch_supervisor` con sucursales asignadas, un ciclo de revisión (`review_status`) para Cortes Z separado del ciclo operativo del turno, aprobación de ingresos/egresos con dos umbrales (revisión posterior y autorización previa), una política configurable por negocio/sucursal y una bitácora append-only. La operación de caja en el POS sigue igual y no se bloquea; lo nuevo es la capa de control.

## Technical Context

**Backend**: NestJS + Drizzle + PostgreSQL (`apps/sync_api`).
**Admin web**: React + Vite + Tailwind (`apps/business_control_tauri`).
**POS**: Flutter, `AppState` (ChangeNotifier) en `lib/ui/common/app_state.dart`.
**Constraints**: autorización en servidor (BR-ROLE-004); no bloquear ventas; idempotencia en reintentos del POS; migraciones idempotentes coordinadas en `.claude/workspaces.md`.

## Constitution Check

- **Offline continuity**: PASS con condiciones — movimientos bajo umbral se encolan offline; Corte Z sigue en línea (como hoy).
- **Local authority**: Las decisiones de aprobación son del servidor; el POS no aprueba localmente (salvo PIN en sitio, re-validado al sincronizar).
- **Sync contract**: Nuevo evento WS `approval_resolved` en el cuarto de sucursal existente; nuevo job de cola para movimientos.
- **Cloud role**: Nuevos endpoints y 3 tablas + columnas; migración propuesta, no ejecutada.
- **Verification**: tests de autorización (como `shifts.authorization.spec.ts`, `reports.authorization.spec.ts`), tests de servicio para transiciones, widget tests Flutter, `make check-all`.

---

## 0. Pre-requisito independiente (recomendado antes de Fase 1)

Proteger los endpoints de `ReportsController` que hoy no tienen guard (`cash-shifts`, `sales/payment-methods`, `sales/products`, `inventory/existence`, `inventory/kardex`) con `JwtAuthGuard + RolesGuard + assertScope`. Ver spec R-1. Verificar antes que el Admin web y el POS envían `Authorization` en esas llamadas. PR separado y pequeño.

## 1. Backend (`apps/sync_api`)

### 1.1 Roles y alcance
- `modules/auth/roles.ts`: `SUPERVISION_ROLES = ['branch_supervisor']`, `BRANCH_SUPERVISOR_ROLE`. **No** tocar `ADMIN_ROLES` (spec R-2).
- Nuevo `modules/supervision/supervisor-scope.service.ts`: `getAssignedBranchIds(userId)`, `assertBranchAssigned(user, branchId)`. Owner → todas las sucursales de los negocios en `businessAccess`.
- `users.service.ts` / `admin-users.controller.ts`: permitir crear/editar usuarios con `branch_supervisor` (login email+password para Admin web, PIN para autorizar en terminal).
- `auth.service.tabletLogin`: Fase 1 no permite al supervisor iniciar sesión de operación en tablet; solo se valida su PIN en el flujo de autorización.

### 1.2 Módulo nuevo `modules/supervision`
```
supervision/
├── supervision.module.ts
├── supervision.controller.ts         # bandeja, aprobar/rechazar, bitácora
├── policies.controller.ts            # GET (supervisor/owner), PUT (owner)
├── assignments.controller.ts         # owner
├── approvals.service.ts              # transiciones + reglas CZ/MV
├── policies.service.ts               # resolución negocio → sucursal → default
├── audit-log.service.ts              # insert dentro de la tx del llamador
├── supervisor-scope.service.ts
├── dto/…
└── *.spec.ts                         # incl. supervision.authorization.spec.ts
```

### 1.3 Cambios en `modules/shifts`
- `closeShift`: recibir actor (`closed_by`), resolver política, calcular `review_status` (CZ-01, CZ-04, CZ-05), guardar `policy_snapshot`, escribir `audit_log` (`corte_z_cerrado`), cancelar movimientos `pendiente_autorizacion` (MV-05). Todo en una transacción.
- `openShift` (auto-cierre >24 h): `auto_closed = true`, `review_status = pendiente_aprobacion`, evento de bitácora con `source = system`.
- `createTransaction`: `created_by`, `category`, `client_uuid` (`ON CONFLICT DO NOTHING` + devolver el existente), evaluar política → `approval_status`/`affects_drawer`, validar no-negativo (MV-04), autorización en sitio opcional (`authorization.supervisorPin` → validar contra supervisores asignados a la sucursal, rate-limit).
- `buildShiftReport`: sumar solo `affects_drawer = true`; incluir `approvalStatus` por movimiento y `reviewStatus` del turno.
- `CreateTransactionDto`: `category` (enum), `clientUuid?`, `authorization?: { supervisorPin: string }`.
- Nuevo `POST /cash-shifts/:id/recount` (cajero dueño del turno o `branch_operator` de la sucursal) — CZ-02.
- Nuevo `POST /cash-shifts/:id/transactions/:txId/cancel` (solo `pendiente_autorizacion`, solo su creador).
- `ShiftsController.ownedShift` sigue exigiendo "mi caja"; el recount de encargado necesita un chequeo por sucursal, no por cajero.

### 1.4 Endpoints

| Método y ruta | Roles | Descripción |
|---|---|---|
| `GET /supervision/approvals?type=corte_z\|cash_movement&status=&branchId=&from=&to=` | supervisor, owner | Bandeja; filtra por sucursales asignadas. |
| `GET /supervision/approvals/count` | supervisor, owner | Contador para badge (polling). |
| `GET /supervision/cash-shifts/:id` | supervisor, owner | Reporte Corte (reusa `getCorteReport`) + movimientos con estado + historial de bitácora. |
| `POST /supervision/cash-shifts/:id/approve` `{version, reason?}` | supervisor, owner | → `aprobado`. 409 si `version` cambió; 422 si hay movimientos pendientes; 403 si `closed_by == actor`. |
| `POST /supervision/cash-shifts/:id/reject` `{version, reason}` | supervisor, owner | → `rechazado`; avisa a la sucursal. |
| `POST /supervision/cash-shifts/:id/adjust` `{version, approvedAmount, denominationCounts?, reason}` | supervisor, owner | → `aprobado_con_ajuste`. |
| `POST /supervision/cash-shifts/:id/reopen-review` `{reason}` | owner | → `reabierto` → `pendiente_aprobacion`. |
| `POST /supervision/cash-movements/:id/authorize` `{version, reason?}` | supervisor, owner | `pendiente_autorizacion` → `autorizado` (`affects_drawer = true`). |
| `POST /supervision/cash-movements/:id/reject` `{version, reason}` | supervisor, owner | → `rechazado`. |
| `POST /supervision/cash-movements/:id/validate` `{version}` | supervisor, owner | `pendiente_revision` → `aprobado`. |
| `POST /supervision/cash-movements/:id/object` `{version, reason}` | supervisor, owner | → `objetado`. |
| `GET /supervision/audit-log?branchId=&entityType=&entityId=&actorId=&action=&from=&to=` | supervisor (asignadas), owner | Consulta paginada; CSV en cliente. |
| `GET /supervision/policies?branchId=` | supervisor (lectura), owner | Política efectiva. |
| `PUT /supervision/policies` `{branchId?, …campos, version}` | owner | Crea/actualiza; bitácora con antes/después. |
| `GET /supervision/assignments?userId=\|branchId=` | owner | |
| `PUT /supervision/assignments/:userId` `{branchIds[]}` | owner | Diff → altas/revocaciones + bitácora. |
| `POST /cash-shifts/:id/recount` `{actualAmount, denominationCounts?, notes}` | cajero (su turno), branch_operator (su sucursal) | CZ-02; respeta `corte_z_max_recounts`. |
| `POST /cash-shifts/:id/transactions/:txId/cancel` | creador | |
| `GET /reports/cash-shifts` (extendido) | con guard (paso 0) | Agrega `reviewStatus`, `approvedDifference`, filtro `reviewStatus`. |

### 1.5 Notificaciones
- `sync.gateway.ts`: método `notifyBranch(branchId, {tipo: 'approval_resolved', entityType, entityId, status})` usando `activeClients` por sucursal.
- Fase 1 sin tiempo real hacia el supervisor (polling del contador). Fase 2: cuarto `user:{id}`.
- Job ligero (cron en el mismo servicio o al consultar la bandeja) que marca pendientes vencidos por `pending_sla_hours`.

### 1.6 Migraciones propuestas (NO ejecutar)

Archivo propuesto: `apps/sync_api/migrations/0022_supervisor_cash_approvals.sql` + bloque equivalente con `IF NOT EXISTS` en `scripts/idempotent-deploy-migrations.ts` (el journal de Drizzle no es confiable en prod, ver `AGENTS.md`).

```sql
-- 1) Tablas nuevas
CREATE TABLE IF NOT EXISTS supervisor_branch_assignments (... ver data-model §2.1);
CREATE UNIQUE INDEX IF NOT EXISTS unq_sba_user_branch_active
  ON supervisor_branch_assignments (user_id, branch_id) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS cash_approval_policies (... §2.2);
CREATE TABLE IF NOT EXISTS audit_log (... §2.3);

-- 2) cash_shifts
ALTER TABLE cash_shifts
  ADD COLUMN IF NOT EXISTS review_status varchar(30) NOT NULL DEFAULT 'no_aplica',
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS auto_closed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS approved_difference numeric(10,2),
  ADD COLUMN IF NOT EXISTS recount_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS policy_snapshot jsonb;

-- 3) cash_transactions
ALTER TABLE cash_transactions
  ADD COLUMN IF NOT EXISTS client_uuid varchar(120),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS category varchar(40),
  ADD COLUMN IF NOT EXISTS approval_status varchar(30) NOT NULL DEFAULT 'aprobado_auto',
  ADD COLUMN IF NOT EXISTS affects_drawer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS authorized_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS authorization_method varchar(20),
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

Todo aditivo con defaults ⇒ compatible hacia atrás: un POS viejo sigue funcionando (sus movimientos quedan `aprobado_auto` sin actor hasta actualizar la app). **Orden de despliegue**: migración → backend → Admin → POS. Registrar en `docs/pre-deployment-checklist.md` cuando se implemente.

## 2. Admin web (`apps/business_control_tauri`)

- `App.tsx` `roleTabs`: `branch_supervisor: ['approvals', 'reports', 'audit-log', 'help']` (en `reports` solo la pestaña "Cortes de Caja"); owner suma `approvals`, `audit-log`, `supervision-settings`. Calcular pestañas con la unión de `user.roles` (spec R-4) y añadir `branch_supervisor` a `allowedBusinessIds`.
- Nueva `pages/ApprovalsPage.tsx` (patrón `RequisitionsApprovalPage.tsx`): pestañas "Cortes Z" y "Movimientos de caja"; filtros sucursal/estado/fecha; badge de diferencia (reusar el de ReportsPage); detalle con el reporte de corte (reusar modal de auditoría de `ReportsPage.tsx`), movimientos y su estado, historial de bitácora; acciones Aprobar / Rechazar (motivo) / Aprobar con ajuste (monto + motivo) / Autorizar / Validar / Objetar. Diseño móvil primero (el supervisor está en campo; seguir las guías de responsividad de `AGENTS.md`).
- Badge con contador de pendientes en `AdminLayout.tsx` (polling 60 s a `/supervision/approvals/count`).
- `ReportsPage.tsx` pestaña "Cortes de Caja": columna "Revisión", filtro por `reviewStatus`, export CSV con la columna.
- Nueva `pages/AuditLogPage.tsx`: tabla filtrable, antes/después en diff legible, export CSV.
- Nueva `pages/SupervisionSettingsPage.tsx` (owner): política del negocio + overrides por sucursal; asignación de sucursales a supervisores (o sección en la página de Personal/Administradores).
- `services/api.ts`: tipos `ReviewStatus`, `CashMovementApprovalStatus`, `ApprovalItem`, `AuditLogEntry`, `CashApprovalPolicy` y métodos para cada endpoint de §1.4.
- Tests: Vitest/Playwright para la bandeja (render por rol, acción de aprobar con 409 → recarga).

## 3. POS Flutter (`apps/pos_flutter`)

- `app_state.dart`:
  - `addCashDrop` / `removeCashDrop` → `recordCashMovement({type, category, amount, note, supervisorPin?})` con `clientUuid` (uuid v4), encolado offline si aplica (OF-01), leer `approvalStatus`/`affectsDrawer` de la respuesta y actualizar `cashDrawerAmount` solo si `affectsDrawer`.
  - Nuevo estado `pendingCashMovements` y manejo del evento WS `approval_resolved` (refrescar turno/movimiento y mostrar aviso).
  - `closeShift`: leer `reviewStatus` de la respuesta y mostrarlo en el resumen del Corte Z.
  - Nuevo `recountShift(shiftId, …)` y `fetchShiftsNeedingRecount()` para el encargado.
  - `_parseRole`: reconocer `branch_supervisor` como `UserRole.none` para operar (no tiene dashboard POS en Fase 1) pero permitir su PIN en el diálogo de autorización.
- `ui/encargado/encargado_caja_tab.dart` y `ui/cashier/shift_control_panel.dart` (diálogos ya existentes de ingreso/retiro):
  - Categoría como valor estructurado (mismas etiquetas que hoy) + nota obligatoria según política.
  - Si el monto supera `authorization_min`: mostrar "Requiere autorización" con dos opciones — "PIN de supervisor aquí" o "Enviar a supervisor (remoto)".
  - Lista de movimientos del turno con chip de estado (Autorizado, Pendiente, Rechazado, Objetado).
  - Resumen de Corte Z: chip "En revisión / Aprobado / Rechazado — recontar".
- Encargado: sección "Cortes por recontar" en la pestaña Caja con el formulario de denominaciones existente reutilizado.
- Ticket térmico de Corte Z: añadir línea "Estado de revisión" (opcional).
- Política efectiva cacheada al abrir turno (`GET /supervision/policies?branchId=` con token de operador → endpoint de solo lectura de umbrales, sin datos sensibles) para decidir offline.
- Tests: widget tests de los diálogos (umbral, nota obligatoria, PIN) y test de la cola offline con `clientUuid`.

## 4. Documentación a actualizar al implementar

- `knowledge/business-rules/roles-permissions-rules.md`: rol `branch_supervisor`, BR-ROLE-005 (no auto-aprobación de caja), BR-ROLE-006 (alcance por asignación).
- `docs/pre-deployment-checklist.md`: migración 0022 y orden de despliegue.
- `HANDOFF.md`, `.claude/workspaces.md`.

## 5. Secuencia sugerida y reparto (agentes)

1. **Backend (`agy`/claude)**: paso 0 → migración (en local/staging) → roles/scope → `audit_log` + políticas → cambios en shifts → endpoints de supervisión → tests de autorización.
2. **Admin (`opencode`)**: tipos y API → ApprovalsPage → columna en ReportsPage → AuditLog → Settings.
3. **POS (`codex`)**: movimiento estructurado + idempotencia → estados en UI → autorización PIN/remota → recount → cola offline.
4. Staging E2E: cajero hace retiro grande → supervisor autoriza en Admin → POS refleja; Corte Z con faltante → rechazo → reconteo → aprobación; verificar bitácora.

## 6. Estimación gruesa

| Bloque | Tamaño |
|---|---|
| Paso 0 (guards reportes) | S |
| Backend Fase 1 | L |
| Admin Fase 1 | M–L |
| POS Fase 1 (incl. offline) | M–L |
| QA staging + docs | M |

## Project Structure (documentation)

```text
specs/019-supervisor-sucursal/
├── brief.md        # pedido del dueño (input)
├── spec.md         # problema, flujos, reglas, permisos, decisiones abiertas
├── plan.md         # este archivo
└── data-model.md   # tablas/columnas propuestas
```

`research.md`, `contracts/`, `quickstart.md` y `tasks.md` se generan cuando el dueño cierre las decisiones abiertas.
