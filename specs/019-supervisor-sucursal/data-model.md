# Data Model: Supervisor de Sucursal — Fase 1

**Estado**: Propuesta. Ninguna migración se ha ejecutado. Ver [plan.md](plan.md) §1.6.
**Actualizado**: 2026-11-22. Decisiones del dueño aplicadas (D-1 a D-11, S-1 a S-6): Corte Z en dos niveles (OIS → supervisor/owner), movimientos en un nivel (OIS) con cancelación y ajuste del supervisor, bloqueo de apertura, Corte Z offline, adeudos y push.

Convenciones del repo: PK `uuid` con `defaultRandom()`, `timestamptz`, `version` para concurrencia optimista, estados en `varchar` (como `branch_requisitions.status`) y montos `decimal(10,2)`.

---

## 1. Rol nuevo

| Valor | Etiqueta | Grupo |
|---|---|---|
| `branch_supervisor` | Supervisor de sucursal | `SUPERVISION_ROLES` (nuevo; **no** `ADMIN_ROLES`, ver spec R-2) |

Administrador aprobador = `owner` únicamente (S-2).

## 2. Estados

### 2.1 `cash_shifts.review_status`

| Estado | Significado | Bloquea apertura (D-4) |
|---|---|---|
| `no_aplica` | Histórico o auto-cerrado >24 h (D-11) | No |
| `pendiente_sync` | Corte Z hecho offline, aún sin llegar al servidor (solo existe localmente en el POS) | Sí (en el POS) |
| `pendiente_operador` | Esperando N1 (OIS) | **Sí** |
| `rechazado_operador` | N1 rechazó; espera el reconteo del cajero | **Sí** |
| `pendiente_supervisor` | Esperando N2 (N1 aprobó, o lo cerró el OIS) | No |
| `rechazado_supervisor` | N2 rechazó; espera un nuevo conteo (va directo a N2) o un ajuste del supervisor | No |
| `aprobado` | Final | No |
| `aprobado_con_ajuste` | Final, con monto corregido por N2 | No |

Reabrir (owner): `aprobado*` → `pendiente_supervisor`, con evento `corte_z_reabierto` en la bitácora.

### 2.2 `cash_transactions.approval_status`

| Estado | Cuenta en caja | Significado |
|---|---|---|
| `aprobado_historico` | Sí | Previo al despliegue (default de la migración) |
| `pendiente_operador` | Sí | Autor = cajero; esperando al OIS |
| `pendiente_supervisor` | Sí | Autor = OIS; esperando al supervisor/owner (S-3) |
| `aprobado` | Sí | Final |
| `rechazado` | Sí | Incidencia; el dinero sí se movió (S-4) |
| `cancelado` | **No** | Cancelado por el supervisor/owner con motivo |

El ajuste no es un estado: cambia `amount` y deja `original_amount`, `adjusted_by`, `adjusted_at` y `adjust_reason`, más un evento en la bitácora.

## 3. Tablas nuevas

### 3.1 `supervisor_branch_assignments` (D-1)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid PK | |
| `business_id` | uuid FK NOT NULL | |
| `user_id` | uuid FK `users` NOT NULL | Debe tener `branch_supervisor` en `roles`. |
| `branch_id` | uuid FK `branches` NOT NULL | Mismo negocio. |
| `assigned_by` | uuid FK `users` NOT NULL | Owner. |
| `created_at` | timestamptz NOT NULL | |
| `revoked_at` | timestamptz NULL | Desasignar = poner fecha. |

Índices: `UNIQUE (user_id, branch_id) WHERE revoked_at IS NULL`; `(branch_id) WHERE revoked_at IS NULL`.

### 3.2 `cashier_debts` (D-8)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid PK | |
| `business_id` | uuid FK NOT NULL | |
| `branch_id` | uuid FK NOT NULL | |
| `shift_id` | uuid FK `cash_shifts` NOT NULL | |
| `cashier_id` | uuid FK `users` NOT NULL | `cash_shifts.cashier_id`. |
| `amount` | decimal(10,2) NOT NULL | \|diferencia final\| > 0. |
| `status` | varchar(20) NOT NULL default `'pendiente'` | `pendiente`, `liquidado`, `condonado`, `anulado` (P-1). |
| `generated_by` | uuid FK `users` NOT NULL | Aprobador de N2. |
| `generated_at` | timestamptz NOT NULL | |
| `resolved_by` | uuid FK `users` NULL | |
| `resolved_at` | timestamptz NULL | |
| `resolution_notes` | text NULL | |
| `version` | integer NOT NULL default 1 | |

Índices: `UNIQUE (shift_id) WHERE status <> 'anulado'` (un adeudo vigente por turno); `(cashier_id, status)`.

### 3.3 `push_subscriptions` (D-6)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK `users` NOT NULL | |
| `platform` | varchar(20) NOT NULL | `web`, `android` |
| `app` | varchar(20) NOT NULL | `admin_web`, `pos` |
| `fcm_token` | text NOT NULL UNIQUE | |
| `branch_id` | uuid FK NULL | Sucursal de la terminal (POS). |
| `created_at` | timestamptz NOT NULL | |
| `last_seen_at` | timestamptz NOT NULL | |
| `revoked_at` | timestamptz NULL | Al cerrar sesión o si FCM reporta un token inválido. |

### 3.4 `audit_log` (append-only)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigserial PK | |
| `business_id` | uuid FK NOT NULL | |
| `branch_id` | uuid FK NULL | |
| `entity_type` | varchar(40) NOT NULL | `cash_shift`, `cash_transaction`, `cashier_debt`, `supervisor_assignment` |
| `entity_id` | uuid NOT NULL | |
| `action` | varchar(40) NOT NULL | Ver spec §6. |
| `approval_level` | varchar(10) NULL | `n1`, `n2`, `owner` |
| `actor_id` | uuid FK NULL | NULL solo si `source = system`. |
| `actor_role` | varchar(50) NULL | |
| `reason` | text NULL | |
| `before` / `after` | jsonb NULL | |
| `source` | varchar(20) NOT NULL | `admin_web`, `pos`, `system` |
| `device_id` | varchar(255) NULL | |
| `created_at` | timestamptz NOT NULL default now() | |

Índices: `(entity_type, entity_id, created_at)`, `(branch_id, created_at)`, `(actor_id, created_at)`. Inmutabilidad: `REVOKE UPDATE, DELETE` o un trigger.

## 4. Tablas existentes modificadas

### 4.1 `cash_shifts`

| Columna | Tipo | Notas |
|---|---|---|
| `review_status` | varchar(30) NOT NULL default `'no_aplica'` | §2.1 |
| `client_uuid` | varchar(120) NULL UNIQUE | Idempotencia del Corte Z offline (D-5). |
| `closed_by` | uuid FK NULL | Determina si salta N1 (S-3). |
| `closed_offline` | boolean NOT NULL default false | |
| `local_expected_cash` | decimal(10,2) NULL | Esperado que calculó el POS offline, para comparar con el del servidor. |
| `operator_reviewed_by` / `operator_reviewed_at` / `operator_notes` | uuid / timestamptz / text | N1 |
| `reviewed_by` / `reviewed_at` / `review_notes` | uuid / timestamptz / text | N2 |
| `approved_amount` | decimal(10,2) NULL | Monto final aceptado. |
| `approved_difference` | decimal(10,2) NULL | Base del adeudo. |
| `recount_count` | integer NOT NULL default 0 | |

Índice: `(branch_id, review_status) WHERE review_status IN ('pendiente_operador','rechazado_operador','pendiente_supervisor','rechazado_supervisor')`.
`close_snapshot` es inmutable; los reconteos y ajustes viven en `audit_log`. Backfill: ninguno (`no_aplica`).

### 4.2 `cash_transactions`

| Columna | Tipo | Notas |
|---|---|---|
| `client_uuid` | varchar(120) NULL UNIQUE | |
| `created_by` | uuid FK NULL | |
| `category` | varchar(40) NULL | |
| `approval_status` | varchar(30) NOT NULL default `'aprobado_historico'` | §2.2 |
| `reviewed_by` / `reviewed_at` / `review_reason` | uuid / timestamptz / text | Quien aprobó o rechazó (OIS, o supervisor/owner si el autor era OIS). |
| `review_level` | varchar(10) NULL | `n1` o `n2`. |
| `original_amount` | decimal(10,2) NULL | Se llena con el primer ajuste. |
| `adjusted_by` / `adjusted_at` / `adjust_reason` | uuid / timestamptz / text | |
| `cancelled_by` / `cancelled_at` / `cancel_reason` | uuid / timestamptz / text | |
| `device_id` | varchar(255) NULL | |
| `version` | integer NOT NULL default 1 | |

Índice: `(shift_id, approval_status)`.
Esperado (`buildShiftReport`): suma todo excepto `cancelado`, con el `amount` vigente (ajustado). Para los históricos el resultado no cambia.

## 5. JWT

Sin cambios de estructura. Las sucursales del supervisor se leen de `supervisor_branch_assignments` en cada petición. El OIS trae `branchId` en su token de tablet (BR-ROLE-002), que delimita su N1.

## 6. Flutter (local)

| Dato | Dónde | Notas |
|---|---|---|
| Cola de movimientos offline | `_pendingCashMovementJobs` (análoga a `_pendingSaleSyncJobs`) | `{clientUuid, shiftId, type, category, amount, reason}` |
| Corte Z offline | `_pendingShiftCloseJobs` | `{clientUuid, shiftId, actualAmount, denominationCounts, closeNotes, localExpectedCash, closedAt}`; se envía después de las ventas y los movimientos del turno (OF-03). |
| Estado del último corte de la sucursal | Cache en `SecureStorageService` | Para aplicar el bloqueo de apertura (D-4) en la UI. |
| Bandeja N1 del OIS | Memoria + último snapshot | Acciones deshabilitadas offline. |
| Token FCM | `SecureStorageService` | Se registra al iniciar sesión y se revoca al cerrarla. |

## 7. Fase futura

- `cash_approval_policies` (umbrales, SLA, límite de reconteos) y `policy_snapshot`.
- `cash_shifts.auto_closed` y diferencia "sin conteo" (R-7).
- Campos de autorización con PIN en sitio.
