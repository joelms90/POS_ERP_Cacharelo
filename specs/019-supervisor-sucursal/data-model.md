# Data Model: Supervisor de Sucursal — Fase 1

**Estado**: Propuesta. Ninguna migración se ha ejecutado. Ver [plan.md](plan.md) §Migraciones.

Convenciones del repo respetadas: `uuid` PK con `defaultRandom()`, `timestamp with time zone`, `version` para concurrencia optimista, estados como `varchar` (no `pgEnum`, igual que `branch_requisitions.status`), montos `decimal(10,2)`.

---

## 1. Rol nuevo

| Valor | Etiqueta UI | Grupo |
|---|---|---|
| `branch_supervisor` | Supervisor de sucursal | `SUPERVISION_ROLES` (nuevo; **no** se agrega a `ADMIN_ROLES` — ver spec R-2) |

Cabe en `users.role varchar(50)` y en `admin_business_access.role varchar(20)` (17 caracteres). Se guarda en `users.roles` (multi-rol, spec 013).

## 2. Tablas nuevas

### 2.1 `supervisor_branch_assignments`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid PK | |
| `business_id` | uuid FK `businesses` NOT NULL | |
| `user_id` | uuid FK `users` NOT NULL | El usuario debe tener `branch_supervisor` en `roles`. |
| `branch_id` | uuid FK `branches` NOT NULL | Misma `business_id` que el usuario. |
| `assigned_by` | uuid FK `users` NOT NULL | Owner que asignó. |
| `created_at` | timestamptz NOT NULL default now() | |
| `revoked_at` | timestamptz NULL | Desasignar = poner fecha (no se borra; histórico). |

Índices: `UNIQUE (user_id, branch_id) WHERE revoked_at IS NULL`; `(branch_id) WHERE revoked_at IS NULL`.
Cubre D-1 en ambos sentidos: varias sucursales por supervisor y, si se quisiera, uno por sucursal.

### 2.2 `cash_approval_policies`

| Columna | Tipo | Default |
|---|---|---|
| `id` | uuid PK | |
| `business_id` | uuid FK NOT NULL | |
| `branch_id` | uuid FK NULL | NULL = política del negocio; con valor = override de sucursal |
| `corte_z_auto_approve_max_diff` | decimal(10,2) NOT NULL | `0.00` |
| `corte_z_max_recounts` | integer NOT NULL | `2` |
| `cash_in_review_min` | decimal(10,2) NOT NULL | `0.00` |
| `cash_in_authorization_min` | decimal(10,2) NULL | NULL = nunca |
| `cash_out_review_min` | decimal(10,2) NOT NULL | `0.00` |
| `cash_out_authorization_min` | decimal(10,2) NULL | NULL = nunca |
| `categories_always_authorize` | jsonb `string[]` NOT NULL | `["correccion"]` |
| `categories_require_note` | jsonb `string[]` NOT NULL | `["gasto_operativo","otro_egreso","otro_ingreso","correccion"]` |
| `allow_pin_in_situ` | boolean NOT NULL | `true` |
| `pending_sla_hours` | integer NOT NULL | `24` |
| `updated_by` | uuid FK `users` | |
| `updated_at` | timestamptz NOT NULL | |
| `version` | integer NOT NULL | `1` |

Índices: `UNIQUE (business_id) WHERE branch_id IS NULL`; `UNIQUE (business_id, branch_id) WHERE branch_id IS NOT NULL`.
Resolución: override de sucursal campo por campo → política del negocio → defaults del código.

### 2.3 `audit_log` (append-only)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigserial PK | Orden total, como `change_log`. |
| `business_id` | uuid FK NOT NULL | |
| `branch_id` | uuid FK NULL | NULL para eventos de negocio (p. ej. política global). |
| `entity_type` | varchar(40) NOT NULL | `cash_shift`, `cash_transaction`, `cash_approval_policy`, `supervisor_assignment` |
| `entity_id` | uuid NOT NULL | |
| `action` | varchar(40) NOT NULL | Ver spec §6. |
| `actor_id` | uuid FK `users` NULL | NULL solo para `source = system`. |
| `actor_role` | varchar(50) NULL | Rol activo con el que actuó. |
| `reason` | text NULL | Obligatorio por regla AU-03 (validado en servicio). |
| `before` | jsonb NULL | Estado relevante antes. |
| `after` | jsonb NULL | Estado relevante después. |
| `source` | varchar(20) NOT NULL | `admin_web`, `pos`, `system` |
| `device_id` | varchar(255) NULL | Terminal (POS) cuando aplica. |
| `authorization_method` | varchar(20) NULL | `remoto`, `pin_en_sitio`, `pin_offline`, `owner_override` |
| `created_at` | timestamptz NOT NULL default now() | Hora del servidor. |

Índices: `(entity_type, entity_id, created_at)`, `(branch_id, created_at)`, `(actor_id, created_at)`.
Inmutabilidad: `REVOKE UPDATE, DELETE ON audit_log FROM pos_user` o trigger `BEFORE UPDATE OR DELETE … RAISE EXCEPTION`.

## 3. Tablas existentes modificadas

### 3.1 `cash_shifts` (columnas nuevas; `status` open/closed no cambia)

| Columna | Tipo | Notas |
|---|---|---|
| `review_status` | varchar(30) NOT NULL default `'no_aplica'` | `no_aplica`, `pendiente_aprobacion`, `aprobado_auto`, `aprobado`, `aprobado_con_ajuste`, `rechazado`, `reabierto` |
| `closed_by` | uuid FK `users` NULL | Quién ejecutó el Corte Z (hoy se asume `cashier_id`; puede ser el encargado). |
| `auto_closed` | boolean NOT NULL default false | Auto-cierre >24 h. |
| `approved_amount` | decimal(10,2) NULL | Monto final aceptado (= contado, reconteo o ajuste). |
| `approved_difference` | decimal(10,2) NULL | Diferencia oficial tras aprobar. |
| `recount_count` | integer NOT NULL default 0 | |
| `reviewed_by` | uuid FK `users` NULL | |
| `reviewed_at` | timestamptz NULL | |
| `review_notes` | text NULL | Último motivo; el histórico vive en `audit_log`. |
| `policy_snapshot` | jsonb NULL | Política aplicada al cerrar. |

Índice: `(branch_id, review_status) WHERE review_status IN ('pendiente_aprobacion','rechazado')`.
`close_snapshot` se mantiene inmutable una vez escrito.
Backfill: ninguno; los cerrados previos quedan `no_aplica` (CZ-09).

### 3.2 `cash_transactions` (columnas nuevas)

| Columna | Tipo | Notas |
|---|---|---|
| `client_uuid` | varchar(120) NULL UNIQUE | Idempotencia (mismo tamaño que `orders.client_uuid`). |
| `created_by` | uuid FK `users` NULL | NULL solo en históricos. |
| `category` | varchar(40) NULL | Ver spec MV-02; históricos NULL (opcional: backfill por prefijo de `reason`). |
| `approval_status` | varchar(30) NOT NULL default `'aprobado_auto'` | `aprobado_auto`, `pendiente_revision`, `aprobado`, `objetado`, `pendiente_autorizacion`, `autorizado`, `rechazado`, `cancelado` |
| `affects_drawer` | boolean NOT NULL default true | `false` mientras `pendiente_autorizacion`, `rechazado`, `cancelado`. |
| `authorized_by` | uuid FK `users` NULL | |
| `authorization_method` | varchar(20) NULL | |
| `reviewed_by` | uuid FK `users` NULL | |
| `reviewed_at` | timestamptz NULL | |
| `review_reason` | text NULL | |
| `device_id` | varchar(255) NULL | |
| `version` | integer NOT NULL default 1 | Concurrencia optimista. |

Índice: `(shift_id, approval_status)`.
Cálculo del esperado (`buildShiftReport`): sumar solo movimientos con `affects_drawer = true`.
Históricos: default `aprobado_auto` + `affects_drawer = true` ⇒ cero cambio en reportes pasados.

## 4. Payload JWT

Sin cambios de estructura: `roles` incluye `branch_supervisor`; `branchId` queda NULL para el supervisor en Admin web. Las sucursales permitidas se leen de `supervisor_branch_assignments` en cada petición (no se meten en el token, para que una desasignación sea inmediata).

## 5. Flutter (local)

| Dato | Dónde | Notas |
|---|---|---|
| Cola de movimientos offline | Nuevo job type en la cola existente (`_pendingSaleSyncJobs` o una análoga `_pendingCashMovementJobs`) | `{clientUuid, shiftId, type, category, amount, reason, authorization?}` |
| Estado de movimientos del turno | Cache en `SecureStorageService` junto al turno activo | Para mostrar "pendiente/autorizado/rechazado" sin red. |
| Credenciales de supervisores asignados | Cache de credenciales offline existente | Solo hash de PIN, solo supervisores asignados a la sucursal de la terminal. |
