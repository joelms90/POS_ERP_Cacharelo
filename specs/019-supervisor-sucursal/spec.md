# Feature Specification: Supervisor de Sucursal — Fase 1: Aprobación de Cortes Z e Ingresos/Egresos de caja

**Feature Branch**: `019-supervisor-sucursal`
**Created**: 2026-11-22 · **Updated**: 2026-11-22 (decisiones del dueño aplicadas)
**Status**: Propuesta (NO implementado). Decisiones D-1, D-3, D-10 y D-11 resueltas; quedan supuestos por confirmar (§15).
**Input**: [brief.md](brief.md) — pedido del dueño: rol "supervisor de sucursal"; lo primero que debe tener es (1) **aprobar cortes Z** y (2) **aprobar ingresos y egresos de caja**.

---

## 1. Problema

Hoy el sistema **registra** el dinero de caja pero nadie lo **valida**:

| Situación actual (verificada en código) | Consecuencia |
|---|---|
| El Corte Z (`POST /cash-shifts/:id/close`) cierra el turno en un solo paso: guarda conteo, denominaciones, notas y `close_snapshot`. `cash_shifts.status` solo tiene `open`/`closed`. | Un faltante de $850 queda "cerrado" igual que un corte perfecto. No hay revisión ni responsable de aceptarlo. |
| Los ingresos/egresos (`POST /cash-shifts/:id/transactions`) se aplican de inmediato al `cash_drawer_amount`. | Un retiro de $5,000 "Gasto operativo" entra sin que nadie lo revise. |
| `cash_transactions` **no guarda quién** registró el movimiento (no hay `created_by`), solo `type`, `amount`, `reason`, `created_at`. | Imposible auditar quién sacó el dinero si hubo cambio de operador en la terminal. |
| La categoría del movimiento ("Gasto operativo", "Entrega a encargado / Retiro parcial", …) se concatena al texto libre de `reason` en Flutter. | No se puede filtrar ni revisar por tipo de movimiento. |
| Los roles existentes son `owner` (todo) y `branch_operator` (opera **una** sucursal). No hay nivel intermedio. | Solo el dueño podría revisar, y no hay pantalla para hacerlo. |

El dueño necesita que **todo** corte Z e ingreso/egreso pase por una cadena de aprobación: primero el operador de la sucursal y después un supervisor de sus sucursales asignadas o un administrador.

## 2. Alcance

### Fase 1 (esta propuesta)
1. Nuevo rol **`branch_supervisor`** ("Supervisor de sucursal") que cubre **varias sucursales asignadas** (D-1 resuelta).
2. **Cadena de aprobación de dos niveles** para **cada** Corte Z y **cada** ingreso/egreso, sin umbrales de monto (D-3 resuelta):
   - **Nivel 1:** operador de sucursal (`branch_operator`) de esa sucursal.
   - **Nivel 2:** supervisor asignado a la sucursal **o** administrador del Admin web.
3. **Bandeja de aprobaciones en el Admin web** (https://cacharelo-central.web.app/) para que supervisores y administradores aprueben/rechacen desde la interfaz (D-10 resuelta).
4. **Bandeja "Por aprobar" en el POS Flutter** para el operador de sucursal (nivel 1).
5. **Bitácora de auditoría** inmutable: usuario, rol, fecha, motivo, valores antes/después, origen.
6. Matriz de permisos cajero / operador / supervisor / administrador.

### Fuera de alcance de Fase 1 (ver §11)
Umbrales configurables (auto-aprobación, autorización previa, PIN en sitio), tratamiento de turnos auto-cerrados >24 h (D-11), dashboard multi-sucursal con KPIs, autorización de descuentos/cancelaciones/devoluciones, ajustes de inventario, requisiciones, arqueos sorpresa, personal/asistencia, metas de venta.

## 3. Glosario

- **Corte X**: reporte informativo de turno abierto (no cierra). Sin cambios.
- **Corte Z**: cierre definitivo de turno con conteo físico (`actualAmount`, `denominationCounts`).
- **Diferencia**: `contado − esperado`, donde `esperado = fondo inicial + ventas efectivo + ingresos − egresos` (`ShiftsService.buildShiftReport`). Negativa = faltante, positiva = sobrante.
- **Movimiento de caja**: ingreso (`cash-in`) o egreso (`cash-out`) manual.
- **Nivel 1 (N1)**: aprobación del operador de sucursal.
- **Nivel 2 (N2)**: aprobación del supervisor asignado o de un administrador.
- **Administrador**: usuario del Admin web con rol `owner`; qué otros roles de administrador entran es el supuesto S-2.

## 4. Flujos actuales vs propuestos

### 4.1 Corte Z

**Actual**
```
open ──(Corte Z del cajero)──▶ closed          (fin; nadie revisa)
```

**Propuesto**: el ciclo operativo (`status`, sin cambios) se separa del ciclo de revisión (`review_status`, nuevo):

```
status:        open ────────── Corte Z ──────────▶ closed
review_status: no_aplica                             │
                                                     ▼
                                           pendiente_operador   (N1)
                                    aprueba │            │ rechaza
                                            ▼            ▼
                                 pendiente_supervisor   rechazado ──reconteo──▶ pendiente_operador
                                   (N2: supervisor         ▲
                                    o administrador)       │
                         aprueba │   ajusta │   rechaza ───┘
                                 ▼          ▼
                             aprobado   aprobado_con_ajuste
                                 │
                       (owner) reabierto ──▶ pendiente_supervisor
```

Reglas:
- **CZ-01** El Corte Z se sigue haciendo igual en la terminal y no bloquea la operación. Al cerrar, el servidor deja el turno en `review_status = pendiente_operador` y lo registra en la bitácora.
- **CZ-02** **Nivel 1**: un operador de sucursal (`branch_operator`) de **esa** sucursal aprueba (→ `pendiente_supervisor`) o rechaza (→ `rechazado`, motivo obligatorio).
- **CZ-03** **Nivel 2**: un supervisor asignado a la sucursal o un administrador aprueba (→ `aprobado`), aprueba con ajuste (→ `aprobado_con_ajuste`: monto final aceptado + motivo obligatorio) o rechaza (→ `rechazado`, motivo obligatorio). Que el nivel 2 sea obligatorio para todos los cortes es el supuesto **S-1**.
- **CZ-04** `rechazado` **no reabre el turno**, porque el efectivo ya salió del cajón y puede haber otro turno abierto. El cajero o el operador de la sucursal registra un **reconteo** (`actualAmount`, denominaciones, nota) y el corte vuelve a `pendiente_operador`. Que un rechazo de N2 reinicie la cadena desde N1 es el supuesto **S-5**.
- **CZ-05** El `close_snapshot` original **nunca se sobrescribe**; cada reconteo o ajuste queda como versión en la bitácora (antes/después).
- **CZ-06** Un nivel no puede aprobar un Corte Z mientras haya movimientos del mismo turno pendientes **en ese nivel**. La UI los muestra en el mismo detalle para resolverlos primero.
- **CZ-07** Nadie aprueba su propio corte (`closed_by == actor` → 403). Extiende la regla existente BR-ROLE-003 (no auto-aprobación de requisiciones). El caso en que quien cerró es el propio operador de sucursal es el supuesto **S-3**.
- **CZ-08** Aprobar o rechazar requiere la versión vigente del turno (`version`). Si otra persona actuó antes, el servidor responde 409 y la UI recarga.
- **CZ-09** Abrir el siguiente turno **no** depende de que el corte anterior esté aprobado (continuidad operativa; ver D-4).
- **CZ-10** Los turnos cerrados antes del despliegue quedan `no_aplica` (históricos; no llenan la bandeja).
- **CZ-11** Los turnos **auto-cerrados** por el sistema (>24 h) **no entran a este flujo en Fase 1** (D-11). Quedan `no_aplica`; ver R-7.

### 4.2 Ingresos y egresos de caja

**Actual**
```
cajero ──POST transactions──▶ se aplica al cajón (sin actor, sin aprobación)
```

**Propuesto**: **cada** movimiento, sin importar el monto, pasa por la misma cadena:

```
registrado ──▶ pendiente_operador (N1) ──aprueba──▶ pendiente_supervisor (N2) ──aprueba──▶ aprobado
                    │       │                               │
                    │       └──rechaza──▶ rechazado ◀──rechaza┘
                    └──creador cancela──▶ cancelado
```

Reglas:
- **MV-01** Todo movimiento guarda `created_by`, categoría estructurada, motivo libre y `client_uuid` (idempotencia: un reintento no lo duplica).
- **MV-02** Categorías iniciales = las que ya usa Flutter. Ingresos: `aporte_cambio`, `reposicion_fondo`, `correccion`, `otro_ingreso`. Egresos: `gasto_operativo`, `entrega_encargado`, `transferencia_caja`, `correccion`, `otro_egreso`.
- **MV-03** Efecto en caja: el movimiento **cuenta en el efectivo esperado desde que se registra**, porque refleja el dinero que físicamente entró o salió. La aprobación valida; un `rechazado` sigue contando, pero queda como **incidencia** del turno y del cajero con motivo obligatorio. Un `cancelado` (solo mientras está `pendiente_operador`, solo por su creador) deja de contar. Este comportamiento es el supuesto **S-4**.
- **MV-04** **Nivel 1** por un operador de la sucursal; **Nivel 2** por un supervisor asignado o un administrador (obligatoriedad = supuesto **S-1**).
- **MV-05** Un egreso que dejaría el efectivo esperado en negativo se rechaza en el servidor. Hoy solo Flutter lo recorta a 0 en pantalla.
- **MV-06** Nadie aprueba su propio movimiento (ver **S-3** cuando el autor es el operador).
- **MV-07** Los movimientos pendientes se muestran en el detalle del Corte Z del turno (CZ-06).

## 5. Umbrales configurables — fase futura

Por decisión del dueño (D-3) **no hay umbrales de monto en Fase 1**: todo pasa por N1 y N2. Se conserva como diseño futuro, sin montos definidos:
- auto-aprobación de cortes con diferencia pequeña;
- revisión posterior vs autorización previa de movimientos según monto o categoría;
- autorización con PIN del supervisor en la terminal;
- límite de reconteos y SLA de pendientes;
- política por negocio con override por sucursal, editable solo por owner y auditada.

## 6. Bitácora de auditoría

Tabla append-only `audit_log` (genérica, reutilizable por fases posteriores: descuentos, cancelaciones, inventario).

Cada evento registra: `business_id`, `branch_id`, `entity_type` (`cash_shift`, `cash_transaction`, `supervisor_assignment`), `entity_id`, `action`, `approval_level` (`n1`, `n2`, `owner`), `actor_id`, `actor_role` (rol activo con el que actuó), `reason`, `before` (jsonb), `after` (jsonb), `source` (`admin_web`, `pos`, `system`), `device_id` y `created_at` (servidor).

Valores de `action`: `corte_z_cerrado`, `corte_z_aprobado`, `corte_z_rechazado`, `corte_z_reconteo`, `corte_z_ajustado`, `corte_z_reabierto`, `movimiento_creado`, `movimiento_aprobado`, `movimiento_rechazado`, `movimiento_cancelado`, `asignacion_actualizada`.

Reglas:
- **AU-01** Sin `UPDATE`/`DELETE`: la app solo inserta. La migración propone revocar esos privilegios al usuario de la app sobre la tabla (o un trigger que lo impida).
- **AU-02** Se escribe **en la misma transacción** que el cambio de estado: si falla la bitácora, falla la aprobación.
- **AU-03** Motivo obligatorio en: rechazar, ajustar, reabrir. Opcional en aprobar.
- **AU-04** Consultable por el supervisor (sus sucursales) y por administradores; filtros por sucursal, entidad, actor, acción y rango de fechas. Exportable a CSV (patrón existente en ReportsPage).
- **AU-05** "Eliminar registros financieros" **no existe** para ningún rol.

## 7. Matriz de permisos (Fase 1)

✅ permitido · 🔸 solo su sucursal/su caja · 🔹 solo sucursales asignadas · ❌ no · ❓ supuesto a confirmar

| Acción | Cajero | Operador de sucursal (`branch_operator`) | Supervisor (`branch_supervisor`) | Administrador (owner; otros = S-2) |
|---|---|---|---|---|
| Abrir turno / Corte X / Corte Z de su caja | 🔸 | 🔸 | ❌ ¹ | ✅ |
| Registrar ingreso/egreso en su turno | 🔸 | 🔸 | ❌ | ✅ |
| Cancelar su movimiento `pendiente_operador` | 🔸 | 🔸 | — | — |
| Registrar reconteo de Corte Z rechazado | 🔸 (su turno) | 🔸 (turnos de su sucursal) | ❌ | ❌ |
| Ver cortes y movimientos de la sucursal | 🔸 (los suyos) | 🔸 | 🔹 | ✅ |
| **Nivel 1**: aprobar / rechazar Corte Z | ❌ | 🔸 (no propios, S-3) | ❌ | ❓ S-6 |
| **Nivel 1**: aprobar / rechazar movimiento | ❌ | 🔸 (no propios, S-3) | ❌ | ❓ S-6 |
| **Nivel 2**: aprobar / rechazar / ajustar Corte Z | ❌ | ❌ | 🔹 (no propios) | ✅ desde Admin web |
| **Nivel 2**: aprobar / rechazar movimiento | ❌ | ❌ | 🔹 (no propios) | ✅ desde Admin web |
| Reabrir un Corte Z aprobado | ❌ | ❌ | ❌ | owner, con motivo |
| Ver bitácora de auditoría | ❌ | ❌ | 🔹 | ✅ |
| Asignar supervisores a sucursales | ❌ | ❌ | ❌ | owner |
| Crear sucursales / modificar permisos de administradores | ❌ | ❌ | ❌ | owner |
| Eliminar registros financieros | ❌ | ❌ | ❌ | ❌ |

¹ Si una persona tiene el rol de supervisor y también el de cajero (multi-rol existente, `users.roles`), CZ-07/MV-06 le impiden aprobar lo que hizo con el rol de cajero.

Propuesta para fases siguientes (tabla del brief):
- Ver ventas de sus sucursales: ✅🔹.
- Consultar cortes y arqueos: ✅🔹 (Fase 1).
- Autorizar descuentos excepcionales y cancelaciones/devoluciones: ✅🔹 (Fase 3).
- Revisar/aprobar requisiciones: ✅🔹 solo **primer visto bueno**; la aprobación de almacén sigue en `warehouse_purchasing_operator` (Fase 3).
- Autorizar ajustes de inventario: ✅🔹 (Fase 3).
- Consultar movimientos y auditorías: ✅🔹 (Fase 1).
- Crear sucursales: ❌. Modificar permisos de administradores: ❌. Eliminar registros financieros: ❌.

## 8. Notificaciones

| Evento | Quién se entera | Canal Fase 1 |
|---|---|---|
| Corte Z o movimiento en `pendiente_operador` | Operadores de la sucursal | Evento WebSocket `approval_requested` al cuarto de la sucursal (gateway existente) + contador en la pestaña Caja del POS |
| Pendiente en `pendiente_supervisor` | Supervisores asignados y administradores | Bandeja del Admin web con contador (polling 60 s) |
| Aprobado / rechazado (N1 o N2) | Terminal(es) de la sucursal | Evento WebSocket `approval_resolved` + refresco al reconectar |

Fase 2+: push en móvil / correo / WhatsApp (D-6). El gateway hoy registra clientes **por sucursal** (`sync.gateway.ts`), lo que sirve para N1. Para N2 en tiempo real se propone un cuarto `user:{id}` en Fase 2; en Fase 1 basta el polling.

## 9. Offline en POS Flutter

Estado actual verificado: abrir turno, ingresos/egresos y Corte Z son **solo en línea** (`app_state.dart`: `http.post` con timeout; sin cola). Solo el turno activo se cachea en `SecureStorageService`.

Propuesta Fase 1:
- **OF-01** Los movimientos se pueden registrar offline: se encolan con `client_uuid` (mismo patrón que `_pendingSaleSyncJobs`), se muestran como "pendiente de sincronizar" y nacen `pendiente_operador` al llegar al servidor. El `client_uuid` evita duplicados.
- **OF-02** El Corte Z sigue siendo en línea en Fase 1 (el cálculo del esperado depende de pagos en el servidor). Ver D-5.
- **OF-03** **Aprobar o rechazar nunca es offline** (ni N1 ni N2): lo decide el servidor. La bandeja del operador muestra el último estado cacheado y deshabilita las acciones sin conexión.

## 10. Requisitos funcionales

- **FR-001** El sistema MUST incorporar el rol `branch_supervisor` al catálogo canónico de roles, con alcance por sucursales asignadas (varias por supervisor).
- **FR-002** El sistema MUST permitir al owner asignar y desasignar sucursales a un supervisor, y auditar esas asignaciones.
- **FR-003** Todo Corte Z cerrado manualmente después del despliegue MUST quedar en `pendiente_operador`.
- **FR-004** Todo ingreso/egreso registrado después del despliegue MUST quedar en `pendiente_operador`, sin importar el monto.
- **FR-005** Un operador de sucursal MUST poder aprobar o rechazar (N1), desde el POS, cortes y movimientos de su sucursal que no sean suyos.
- **FR-006** Un supervisor (sucursales asignadas) o un administrador MUST poder aprobar, rechazar o ajustar (N2) desde la bandeja del Admin web.
- **FR-007** El sistema MUST conservar intacto el `close_snapshot` original y registrar cada reconteo o ajuste como versión en la bitácora.
- **FR-008** El sistema MUST impedir la auto-aprobación de cortes y movimientos, también vía peticiones directas.
- **FR-009** Toda transición de aprobación MUST escribir un evento en `audit_log` en la misma transacción, con nivel, antes y después.
- **FR-010** Las autorizaciones MUST validarse en el servidor (BR-ROLE-004); Admin y POS solo ocultan acciones.
- **FR-011** El POS MUST mostrar al cajero el estado de sus movimientos y de su Corte Z, y permitir el reconteo cuando se rechace.

## 11. Fases posteriores

| Fase | Contenido | Reutiliza |
|---|---|---|
| **2 — Dashboard de supervisión** | Vista "todas mis sucursales, hoy": ventas totales, sucursales abiertas X/Y (turno abierto), diferencias de caja acumuladas, alertas pendientes (cortes + movimientos + inventario), ventas por sucursal, "N sucursales requieren revisión". Notificaciones push/tiempo real. | `GET /reports/sales-dashboard`, `inventory_alerts`, `cash_shifts`, bandeja de Fase 1 |
| **2b — Umbrales y auto-cierre** | Umbrales configurables (§5); tratamiento de turnos auto-cerrados >24 h (R-7). | Cadena de aprobación de Fase 1 |
| **3 — Autorizaciones operativas** | Descuentos excepcionales, cancelaciones/devoluciones (hoy `orders.cancelled_by/cancellation_reason` sin aprobación), ajustes de inventario, primer visto bueno de requisiciones. Todo sobre la misma cadena + `audit_log`. | Cadena y bitácora de Fase 1 |
| **4 — KPIs del supervisor** | Ventas vs meta (requiere tabla de metas), diferencias de caja (faltantes/sobrantes), merma (`inventory_movements` tipo merma), cancelaciones/devoluciones (frecuencia, monto, motivo), disponibilidad de productos esenciales (`branch_stock_thresholds`), productividad (ventas por empleado/turno), cumplimiento operativo (requiere checklists de inspección), movimientos rechazados por cajero. | `reports.service`, `stock_ledger`, `audit_log` |
| **5 — Operación de campo** | Arqueo sorpresa (Corte X firmado por supervisor), checklists de visita/inspección, asistencia del personal. | Corte X existente |

## 12. Criterios de éxito

- **SC-001** 100 % de los Cortes Z cerrados manualmente después del despliegue tienen `review_status` distinto de `no_aplica`.
- **SC-002** 0 movimientos de caja sin `created_by` después del despliegue.
- **SC-003** Un intento de auto-aprobación, o de aprobar N2 antes de N1, vía HTTP directo devuelve 403/409 (test de autorización).
- **SC-004** Cada aprobación, rechazo o ajuste tiene exactamente un evento en `audit_log` con nivel, antes y después.
- **SC-005** El supervisor ve en la bandeja solo sus sucursales asignadas (test con dos supervisores); el administrador ve todas las de su negocio.
- **SC-006** Un cajero sin conexión puede seguir registrando movimientos y vendiendo sin bloqueo.

## 13. Riesgos detectados en el código actual

| # | Riesgo | Evidencia | Mitigación propuesta |
|---|---|---|---|
| R-1 | **Endpoints de reportes sin guard** | En `reports.controller.ts`, `GET /reports/cash-shifts`, `/reports/sales/payment-methods`, `/reports/sales/products`, `/reports/inventory/existence` y `/reports/inventory/kardex` no tienen `@UseGuards` (no hay guard a nivel de clase ni `APP_GUARD` global). Cualquiera con un `businessId` puede listar cortes, ventas e inventario. | Corregir **antes** de Fase 1 (cambio pequeño e independiente): `JwtAuthGuard + RolesGuard + assertScope`. |
| R-2 | Añadir el supervisor a `ADMIN_ROLES` le daría acceso a **todas** las sucursales | `reports.service.ts:613` trata cualquier rol de `ADMIN_ROLES` como sin restricción de sucursal en el reporte de auditoría; `users.service.ts` usa `ADMIN_ROLES` para el alta de administradores. | Nuevo grupo `SUPERVISION_ROLES`; el alcance se resuelve siempre con `supervisor_branch_assignments`, nunca por pertenecer a un grupo. |
| R-3 | `RolesGuard` deja pasar a `owner` siempre | `roles.guard.ts` | Correcto para owner, pero las reglas de nivel y de no auto-aprobación deben vivir en el servicio, no en el guard. |
| R-4 | Admin web decide pestañas por `user.role` (primer rol) | `App.tsx` `roleTabs[user?.role]` | Calcular pestañas con la unión de `user.roles` o con el rol activo elegido. |
| R-5 | Movimientos sin idempotencia ni actor | `cash_transactions` sin `created_by`/`client_uuid`; Flutter reintenta por timeout | Columnas nuevas (data-model) y `ON CONFLICT (client_uuid)`. |
| R-6 | Egresos pueden dejar el cajón negativo en el servidor | `ShiftsService.createTransaction` resta sin validar; Flutter solo hace `max(0, …)` | MV-05. |
| R-7 | **Auto-cierre >24 h sin conteo (fuera de Fase 1 por D-11)** | `ShiftsService.openShift` cierra el turno sin `close_snapshot` ni conteo; `cash_drawer_amount` no incluye ventas en efectivo, así que el Corte Z de esos turnos muestra un **faltante falso ≈ ventas en efectivo**. | Fase 2b: marcar `auto_closed`, enviarlos a revisión y mostrar la diferencia como "sin conteo". En Fase 1 quedan `no_aplica` y fuera de la bandeja; conviene advertirlo al dueño al leer reportes. |
| R-8 | Carga operativa: **todo** pasa por dos niveles sin umbral | D-3 | Medir volumen de pendientes las primeras semanas; los umbrales (§5) son la palanca para reducirlo. |
| R-9 | Sucursal sin operador disponible, o donde el operador es quien cierra | — | Supuestos S-3 y S-6. |
| R-10 | Migraciones fuera del journal de Drizzle | `AGENTS.md` (caveat `admin_business_access`) | Script idempotente (`IF NOT EXISTS`) como en `idempotent-deploy-migrations.ts`, coordinado en `workspaces.md`. |
| R-11 | Dos aprobadores actúan a la vez | — | Concurrencia optimista con `version` (CZ-08). |

## 14. Qué se reutiliza del código existente

- `ShiftsService.buildShiftReport` / `getCorteReport` y `cash_shifts.close_snapshot`: base del detalle que revisan N1 y N2 (esperado, contado, diferencia, movimientos, denominaciones).
- `GET /reports/cash-shifts` y `GET /reports/cash-shifts/:id/audit`: listado y detalle; se agregan `review_status` y filtros.
- Admin `ReportsPage.tsx`, pestaña "Cortes de Caja" (tabla, badge de discrepancia, modal de auditoría, export CSV): se extiende con columna de estado.
- `RequisitionsApprovalPage.tsx`: patrón de bandeja aprobar/rechazar y badges de estado para la nueva bandeja del Admin web.
- Regla BR-ROLE-003 (no auto-aprobación) y su patrón en `requisitions.service.ts`.
- Multi-rol (`users.roles`, spec 013), `admin_business_access`, `assertBusinessAccess`, `RolesGuard`, `roleTabs`.
- Flutter: diálogos de ingreso/retiro y Corte Z en `encargado_caja_tab.dart` y `cashier/shift_control_panel.dart`; cola offline (`_pendingSaleSyncJobs`).
- `sync.gateway.ts` (cuartos por sucursal) para avisar al operador (N1) y a las terminales.

## 15. Decisiones del dueño y supuestos

### 15.1 Decisiones

| # | Decisión | Estado | Resolución |
|---|---|---|---|
| **D-1** | ¿Supervisor de varias sucursales asignadas o uno por sucursal? | ✅ **RESUELTA** (2026-11-22) | **Varias sucursales asignadas.** Modelo N:N `supervisor_branch_assignments`. |
| **D-2** | En sucursales sin supervisor asignado, ¿quién aprueba el nivel 2? | ✅ **RESUELTA por D-10** | Los administradores del Admin web pueden aprobar N2 de cualquier sucursal de su negocio. |
| **D-3** | Umbrales de monto iniciales. | ✅ **RESUELTA** (2026-11-22) | **Sin umbrales en Fase 1.** Todo corte Z y todo ingreso/egreso lo aprueba primero el operador de sucursal y después un supervisor o administrador. Los umbrales quedan como fase futura (§5). |
| **D-4** | ¿Bloquear la apertura del siguiente turno si el Corte Z anterior está pendiente o rechazado? | Abierta | Recomendación: **no bloquear**. |
| **D-5** | ¿Permitir Corte Z offline? | Abierta | Recomendación: **no en Fase 1**. |
| **D-6** | Canal de notificación fuera de la app. | Abierta | Recomendación: bandeja en Fase 1; push o WhatsApp en Fase 2. |
| **D-7** | ¿Autorización con PIN del supervisor en la terminal? | Pospuesta | Sin umbrales/autorización previa ya no aplica a Fase 1; pasa a §5. |
| **D-8** | ¿Un faltante aprobado se registra como adeudo del cajero? | Abierta | Recomendación: solo registro en Fase 1. |
| **D-9** | ¿El supervisor ve ventas en vivo desde Fase 1? | Abierta | Recomendación: esperar al dashboard de Fase 2. |
| **D-10** | ¿Los administradores aprueban desde el Admin web? | ✅ **RESUELTA** (2026-11-22) | **Sí.** Los administradores de https://cacharelo-central.web.app/ aprueban y rechazan cortes Z e ingresos/egresos desde la interfaz. La bandeja de aprobaciones del Admin web entra en Fase 1. |
| **D-11** | ¿Tratar los turnos auto-cerrados (>24 h) en Fase 1? | ✅ **RESUELTA** (2026-11-22) | **No por ahora.** Queda en riesgos (R-7) y en la Fase 2b. |

### 15.2 Supuestos a confirmar con el dueño (no se inventan reglas)

| # | Supuesto adoptado en esta propuesta | Qué hay que confirmar |
|---|---|---|
| **S-1** | El nivel 2 es **obligatorio para todo**: un corte o movimiento solo queda `aprobado` tras N2. | ¿Hay casos donde la aprobación del operador basta? Si los hay, `pendiente_supervisor` se omitiría para ellos, y la regla de cuáles falta definirla. |
| **S-2** | "Administrador" = `owner`. | ¿También aprueban `inventory_admin` y/o `support_tech`? (`web_inquiries_viewer` se asume que no). |
| **S-3** | Si quien cerró el corte o registró el movimiento es el propio operador de sucursal, N1 lo hace **otro** operador de la misma sucursal. | ¿Y si no hay otro operador? Opciones: pasa directo a N2, o el operador puede aprobar lo suyo en N1. |
| **S-4** | El movimiento cuenta en el efectivo esperado desde que se registra; un rechazo lo deja como incidencia, no lo descuenta. | ¿O el dinero no debe moverse hasta que N1 apruebe (autorización previa)? |
| **S-5** | Un rechazo en N2 exige reconteo y reinicia la cadena desde N1. | ¿O el reconteo tras un rechazo de N2 vuelve directo a N2? |
| **S-6** | Los administradores actúan en N2; no sustituyen al operador en N1. | ¿El administrador (o el supervisor) puede aprobar N1 cuando el operador no está, o saltarse N1? |
