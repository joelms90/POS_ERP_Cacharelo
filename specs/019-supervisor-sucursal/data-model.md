# Data Model: Supervisor de Sucursal — Fase 1

**Estado**: Propuesta. Ninguna migración se ha ejecutado. Ver [plan.md](plan.md) §1.6.
**Actualizado**: 2026-11-22. Decisiones del dueño aplicadas: cadena de aprobación de dos niveles (operador de sucursal → supervisor/administrador), sin umbrales ni tratamiento de auto-cierre en Fase 1.

Convenciones del repo respetadas: PK `uuid` con `defaultRandom()`, `timestamp with time zone`, `version` para concurrencia optimista, estados como `varchar` (no `pgEnum`, igual que `branch_requisitions.status`), montos `decimal(10,2)`.

---

## 1. Rol nuevo

| Valor | Etiqueta UI | Grupo |
|---|---|---|
| `branch_supervisor` | Supervisor de sucursal | `SUPERVISION_ROLES` (nuevo; **no** se agrega a `ADMIN_ROLES`, ver spec R-2) |

Cabe en `users.role varchar(50)` y en `admin_business_access.role varchar(20)` (17 caracteres). Se guarda en `users.roles` (multi-rol, spec 013).

## 2. Estados

### 2.1 `cash_shifts.review_status`

| Estado | Significado | Quién lo produce |
|---|---|---|
| `no_aplica` | Histórico (antes del despliegue) o auto-cerrado >24 h (fuera de Fase 1, D-11) | default |
| `pendiente_operador` | Esperando N1 | Corte Z o reconteo |
| `pendiente_supervisor` | N1 aprobó; esperando N2 | operador de sucursal |
| `aprobado` | N2 aprobó (final) | supervisor / administrador |
| `aprobado_con_ajuste` | N2 aprobó con monto corregido (final) | supervisor / administrador |
| `rechazado` | N1 o N2 rechazó; requiere reconteo | operador / supervisor / administrador |
| `reabierto` | Owner reabre un aprobado → vuelve a `pendiente_supervisor` | owner |

### 2.2 `cash_transactions.approval_status`

| Estado | Significado |
|---|---|
| `aprobado_historico` | Movimiento previo al despliegue (default de migración) |
| `pendiente_operador` | Esperando N1 |
| `pendiente_supervisor` | N1 aprobó; esperando N2 |
| `aprobado` | N2 aprobó (final) |
| `rechazado` | N1 o N2 rechazó; sigue contando en caja como incidencia (supuesto S-4) |
| `cancelado` | El creador lo canceló mientras estaba `pendiente_operador`; deja de contar en caja |

Si el dueño decide que N2 no es obligatorio para todo (S-1), `pendiente_supervisor` se omite en esos casos y N1 produce `aprobado`. No se necesita cambio de esquema.

## 3. Tablas nuevas

### 3.1 `supervisor_branch_assignments` (D-1: varias sucursales por supervisor)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid PK | |
| `business_id` | uuid FK `businesses` NOT NULL | |
| `user_id` | uuid FK `users` NOT NULL | El usuario debe tener `branch_supervisor` en `roles`. |
| `branch_id` | uuid FK `branches` NOT NULL | Mismo `business_id` que el usuario. |
| `assigned_by` | uuid FK `users` NOT NULL | Owner que asignó. |
| `created_at` | timestamptz NOT NULL default now() | |
| `revoked_at` | timestamptz NULL | Desasignar = poner fecha (no se borra; queda histórico). |

Índices: `UNIQUE (user_id, branch_id) WHERE revoked_at IS NULL`; `(branch_id) WHERE revoked_at IS NULL`.

### 3.2 `audit_log` (append-only)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigserial PK | Orden total, como `change_log`. |
| `business_id` | uuid FK NOT NULL | |
| `branch_id` | uuid FK NULL | |
| `entity_type` | varchar(40) NOT NULL | `cash_shift`, `cash_transaction`, `supervisor_assignment` |
| `entity_id` | uuid NOT NULL | |
| `action` | varchar(40) NOT NULL | Ver spec §6. |
| `approval_level` | varchar(10) NULL | `n1`, `n2`, `owner` |
| `actor_id` | uuid FK `users` NULL | NULL solo para `source = system`. |
| `actor_role` | varchar(50) NULL | Rol activo con el que actuó. |
| `reason` | text NULL | Obligatorio según AU-03 (validado en el servicio). |
| `before` | jsonb NULL | |
| `after` | jsonb NULL | |
| `source` | varchar(20) NOT NULL | `admin_web`, `pos`, `system` |
| `device_id` | varchar(255) NULL | |
| `created_at` | timestamptz NOT NULL default now() | Hora del servidor. |

Índices: `(entity_type, entity_id, created_at)`, `(branch_id, created_at)`, `(actor_id, created_at)`.
Inmutabilidad: `REVOKE UPDATE, DELETE ON audit_log FROM pos_user` o trigger `BEFORE UPDATE OR DELETE … RAISE EXCEPTION`.

## 4. Tablas existentes modificadas

### 4.1 `cash_shifts` (columnas nuevas; `status` open/closed no cambia)

| Columna | Tipo | Notas |
|---|---|---|
| `review_status` | varchar(30) NOT NULL default `'no_aplica'` | §2.1 |
| `closed_by` | uuid FK `users` NULL | Quién ejecutó el Corte Z (puede ser el cajero o el operador). |
| `operator_reviewed_by` | uuid FK `users` NULL | N1 |
| `operator_reviewed_at` | timestamptz NULL | |
| `operator_notes` | text NULL | |
| `reviewed_by` | uuid FK `users` NULL | N2 |
| `reviewed_at` | timestamptz NULL | |
| `review_notes` | text NULL | |
| `approved_amount` | decimal(10,2) NULL | Monto final aceptado (contado, reconteo o ajuste). |
| `approved_difference` | decimal(10,2) NULL | Diferencia oficial tras N2. |
| `recount_count` | integer NOT NULL default 0 | Sin límite en Fase 1. |

Índice: `(branch_id, review_status) WHERE review_status IN ('pendiente_operador','pendiente_supervisor','rechazado')`.
`close_snapshot` se mantiene inmutable una vez escrito; el historial de N1/N2 y reconteos vive en `audit_log`.
Backfill: ninguno; los turnos cerrados antes quedan `no_aplica`.

### 4.2 `cash_transactions` (columnas nuevas)

| Columna | Tipo | Notas |
|---|---|---|
| `client_uuid` | varchar(120) NULL UNIQUE | Idempotencia (mismo tamaño que `orders.client_uuid`). |
| `created_by` | uuid FK `users` NULL | NULL solo en históricos. |
| `category` | varchar(40) NULL | Spec MV-02; históricos NULL (opcional: backfill por prefijo de `reason`). |
| `approval_status` | varchar(30) NOT NULL default `'aprobado_historico'` | §2.2. El servicio inserta `pendiente_operador` en los nuevos. |
| `operator_reviewed_by` | uuid FK `users` NULL | N1 |
| `operator_reviewed_at` | timestamptz NULL | |
| `operator_reason` | text NULL | |
| `reviewed_by` | uuid FK `users` NULL | N2 |
| `reviewed_at` | timestamptz NULL | |
| `review_reason` | text NULL | |
| `device_id` | varchar(255) NULL | |
| `version` | integer NOT NULL default 1 | Concurrencia optimista. |

Índice: `(shift_id, approval_status)`.
Cálculo del esperado (`buildShiftReport`): suma todos los movimientos excepto `cancelado` (supuesto S-4). Para los históricos el resultado no cambia.

## 5. Payload JWT

Sin cambios de estructura: `roles` incluye `branch_supervisor`; `branchId` queda NULL para el supervisor en el Admin web. Las sucursales permitidas se leen de `supervisor_branch_assignments` en cada petición (no van en el token, para que una desasignación tenga efecto inmediato). El operador de sucursal ya trae `branchId` en su token de tablet (BR-ROLE-002), y eso delimita su N1.

## 6. Flutter (local)

| Dato | Dónde | Notas |
|---|---|---|
| Cola de movimientos offline | Nuevo job en la cola existente (`_pendingCashMovementJobs`, análoga a `_pendingSaleSyncJobs`) | `{clientUuid, shiftId, type, category, amount, reason}` |
| Estado de movimientos del turno | Cache en `SecureStorageService` junto al turno activo | Para mostrar estados sin red. |
| Bandeja N1 del operador | Memoria + último snapshot cacheado | Acciones deshabilitadas offline (OF-03). |

## 7. Fase futura (no en Fase 1)

- `cash_approval_policies` (umbrales, override por sucursal, SLA, límite de reconteos) y `policy_snapshot` en cortes/movimientos.
- `cash_shifts.auto_closed` y diferencia "sin conteo" para turnos auto-cerrados >24 h (R-7).
- Campos de autorización con PIN en sitio (`authorization_method`, `authorized_by`).
