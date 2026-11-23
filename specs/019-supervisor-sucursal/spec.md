# Feature Specification: Supervisor de Sucursal — Fase 1: Aprobación de Cortes Z e Ingresos/Egresos de caja

**Feature Branch**: `019-supervisor-sucursal`
**Created**: 2026-11-22
**Status**: Propuesta (pendiente de decisión del dueño — NO implementado)
**Input**: [brief.md](brief.md) — pedido del dueño: rol "supervisor de sucursal"; lo primero que debe tener es (1) **aprobar cortes Z** y (2) **aprobar ingresos y egresos de caja**.

---

## 1. Problema

Hoy el sistema **registra** el dinero de caja pero nadie lo **valida**:

| Situación actual (verificada en código) | Consecuencia |
|---|---|
| El Corte Z (`POST /cash-shifts/:id/close`) cierra el turno en un solo paso: guarda conteo, denominaciones, notas y `close_snapshot`. `cash_shifts.status` solo tiene `open`/`closed`. | Un faltante de $850 queda "cerrado" igual que un corte perfecto. No hay revisión, ni aceptación, ni responsable de aceptarlo. |
| Los ingresos/egresos (`POST /cash-shifts/:id/transactions`) se aplican de inmediato al `cash_drawer_amount`. | Un retiro de $5,000 "Gasto operativo" entra sin autorización de nadie. |
| `cash_transactions` **no guarda quién** registró el movimiento (no hay `created_by`), solo `type`, `amount`, `reason`, `created_at`. | Imposible auditar quién sacó el dinero si hubo cambio de operador en la terminal. |
| La categoría del movimiento ("Gasto operativo", "Entrega a encargado / Retiro parcial", …) se concatena al texto libre de `reason` en Flutter. | No se puede filtrar ni poner reglas por tipo de movimiento. |
| El turno abierto >24 h se **cierra automáticamente** al abrir uno nuevo (`ShiftsService.openShift`), sin conteo. | Cortes sin arqueo pasan desapercibidos. |
| Los roles existentes son `owner` (todo) y `branch_operator` (opera **una** sucursal). No hay nivel intermedio. | El dueño es el único que podría revisar, y no hay pantalla para hacerlo. |

El dueño necesita que una persona de confianza **verifique, controle, autorice y corrija desviaciones** de caja sin ser el cajero que las genera y sin tener los permisos totales de `owner`.

## 2. Alcance

### Fase 1 (esta propuesta)
1. Nuevo rol **`branch_supervisor`** ("Supervisor de sucursal") con asignación explícita a una o más sucursales.
2. **Aprobación de Cortes Z**: todo Corte Z queda en revisión; el supervisor lo aprueba, lo rechaza (pide reconteo) o lo aprueba con ajuste.
3. **Aprobación de ingresos y egresos de caja** con umbrales configurables: autorización previa (montos altos) y revisión posterior (resto).
4. **Política de umbrales** configurable por negocio con override por sucursal (solo `owner` la edita).
5. **Bitácora de auditoría** inmutable: usuario, rol, fecha, motivo, valores antes/después, origen.
6. **Bandeja de aprobaciones** en Admin web + avisos en POS Flutter.
7. Matriz de permisos cajero / encargado / supervisor / owner para lo anterior.

### Fuera de alcance de Fase 1 (ver §11)
Dashboard multi-sucursal con KPIs, autorización de descuentos/cancelaciones/devoluciones, ajustes de inventario, requisiciones, arqueos sorpresa, personal/asistencia, metas de venta.

## 3. Glosario

- **Corte X**: reporte informativo de turno abierto (no cierra). Sin cambios.
- **Corte Z**: cierre definitivo de turno con conteo físico (`actualAmount`, `denominationCounts`).
- **Diferencia**: `contado − esperado`, donde `esperado = fondo inicial + ventas efectivo + ingresos − egresos` (`ShiftsService.buildShiftReport`). Negativa = faltante, positiva = sobrante.
- **Movimiento de caja**: ingreso (`cash-in`) o egreso (`cash-out`) manual.
- **Autorización previa**: el movimiento no afecta la caja hasta que un supervisor lo autoriza.
- **Revisión posterior**: el movimiento afecta la caja de inmediato y el supervisor lo valida después.

## 4. Flujos actuales vs propuestos

### 4.1 Corte Z

**Actual**
```
open ──(Corte Z del cajero)──▶ closed          (fin; nadie revisa)
open ──(otro turno abre, >24h)──▶ closed       (auto-cierre sin conteo)
```

**Propuesto** — se separa el ciclo operativo (`status`, sin cambios) del ciclo de revisión (`review_status`, nuevo):

```
status:         open ───────────── Corte Z ─────────────▶ closed
review_status:  no_aplica                                  │
                                                           ▼
                         ┌──── |diferencia| ≤ umbral_auto y sin movimientos pendientes
                         │          ──▶ aprobado_auto
                         └──── en otro caso ──▶ pendiente_aprobacion
                                                    │
         ┌──────────────────────┬───────────────────┼─────────────────────────┐
         ▼                      ▼                   ▼                         ▼
     aprobado          aprobado_con_ajuste     rechazado ──(reconteo cajero/   (owner) reabierto
   (supervisor)        (supervisor corrige      │        encargado)──▶ pendiente_aprobacion
                        conteo, motivo oblig.)  └─ reconteos acotados (máx. configurable)
```

Reglas:
- **CZ-01** El Corte Z se sigue haciendo exactamente igual en la terminal (no se bloquea la operación). Al cerrar, el servidor calcula `review_status` según la política vigente y la guarda junto con el `policy_snapshot` usado.
- **CZ-02** `rechazado` **no reabre el turno** (el efectivo ya salió del cajón y puede haber otro turno abierto). Rechazar = "el conteo no se acepta, recuenta". El cajero o encargado de esa sucursal registra un **reconteo** (`actualAmount`, denominaciones, nota) → vuelve a `pendiente_aprobacion`. El `close_snapshot` original **nunca se sobrescribe**; cada reconteo queda como versión en la bitácora.
- **CZ-03** `aprobado_con_ajuste`: el supervisor registra el monto final aceptado y un motivo obligatorio (p. ej. "billete de $500 hallado en sobre de propinas"). La diferencia oficial pasa a ser la del ajuste; la original queda en bitácora (antes/después).
- **CZ-04** Un Corte Z no puede aprobarse mientras tenga movimientos de caja en `pendiente_aprobacion` (se resuelven primero; la UI los muestra en el mismo detalle).
- **CZ-05** Los turnos **auto-cerrados** (>24 h) siempre entran como `pendiente_aprobacion` con bandera `auto_closed=true`, sin importar el umbral, porque no tienen conteo.
- **CZ-06** Nadie aprueba su propio corte (`closed_by == actor` → 403), aunque tenga el rol de supervisor. Extiende la regla existente BR-ROLE-003 (no auto-aprobación de requisiciones). `owner` puede hacer *override* con motivo obligatorio.
- **CZ-07** Aprobado/rechazado requiere la versión vigente del turno (`version`); si otro supervisor actuó antes, responde 409 y la UI recarga.
- **CZ-08** Abrir el siguiente turno **no** depende de que el corte anterior esté aprobado (continuidad operativa). Ver decisión abierta D-4.
- **CZ-09** Turnos cerrados antes del despliegue quedan con `review_status = no_aplica` (históricos; no inundan la bandeja).

### 4.2 Ingresos y egresos de caja

**Actual**
```
cajero ──POST transactions──▶ se aplica al cajón (sin actor, sin aprobación)
```

**Propuesto** — dos umbrales por tipo (ingreso / egreso) y categoría:

| Monto (por movimiento) | Estado inicial | Afecta el efectivo esperado | Qué hace el supervisor |
|---|---|---|---|
| `< umbral_revision` | `aprobado_auto` | Sí, de inmediato | Nada (visible en bitácora/reportes) |
| `≥ umbral_revision` y `< umbral_autorizacion` | `pendiente_revision` | Sí, de inmediato (el dinero ya se movió) | Valida o **objeta** después |
| `≥ umbral_autorizacion` | `pendiente_autorizacion` | **No**, hasta autorizar | Autoriza o rechaza **antes** de que se mueva el dinero |

Transiciones:
```
pendiente_autorizacion ──autorizar──▶ autorizado   (ahora sí afecta la caja)
                       ──rechazar───▶ rechazado    (nunca afectó la caja)
                       ──cajero cancela─▶ cancelado
pendiente_revision     ──validar────▶ aprobado
                       ──objetar────▶ objetado     (sigue en la caja; queda como incidencia
                                                    imputable al turno/cajero, motivo obligatorio)
```

Reglas:
- **MV-01** Todo movimiento guarda `created_by`, categoría estructurada, motivo libre y `client_uuid` (idempotencia: reintentos no duplican).
- **MV-02** Categorías iniciales = las que ya usa Flutter: Ingresos `aporte_cambio`, `reposicion_fondo`, `correccion`, `otro_ingreso`; Egresos `gasto_operativo`, `entrega_encargado`, `transferencia_caja`, `correccion`, `otro_egreso`. La política puede marcar categorías que **siempre** requieren autorización (p. ej. `correccion`) o que exigen nota.
- **MV-03** **Autorización en sitio**: si el supervisor está físicamente en la sucursal, captura su PIN en la terminal del cajero y el movimiento nace `autorizado` (método `pin_en_sitio`). Si no, queda `pendiente_autorizacion` y el supervisor autoriza desde Admin web (método `remoto`); el POS recibe el resultado.
- **MV-04** Un egreso que dejaría el efectivo esperado en negativo se rechaza en el servidor (hoy solo Flutter lo "clampa" a 0 en pantalla).
- **MV-05** `pendiente_autorizacion` expira al cerrar el turno (pasa a `cancelado` automáticamente) para no colgar un Corte Z.
- **MV-06** Nadie autoriza/valida su propio movimiento. `owner` puede con motivo.
- **MV-07** Un movimiento objetado aparece en el detalle del Corte Z y en el reporte del cajero; no altera montos (el dinero sí se movió) pero cuenta en el KPI "incidencias de caja".

## 5. Umbrales configurables

Política por negocio (`cash_approval_policies`), con override opcional por sucursal. Solo `owner` la modifica; cada cambio queda en bitácora con antes/después.

| Parámetro | Default propuesto | Significado |
|---|---|---|
| `corte_z_auto_approve_max_diff` | $0.00 (todo a revisión) | \|diferencia\| hasta la que el Corte Z se aprueba solo. Sugerencia de arranque: $20. |
| `corte_z_max_recounts` | 2 | Reconteos permitidos antes de que sólo `owner` pueda resolver. |
| `cash_in_review_min` / `cash_out_review_min` | $0.00 / $0.00 | Desde qué monto un movimiento va a revisión posterior. |
| `cash_in_authorization_min` / `cash_out_authorization_min` | sin límite / $2,000 | Desde qué monto requiere autorización previa. |
| `categories_always_authorize` | `[correccion]` | Categorías que siempre requieren autorización previa. |
| `categories_require_note` | `[gasto_operativo, otro_egreso, otro_ingreso, correccion]` | Nota libre obligatoria. |
| `allow_pin_in_situ` | `true` | Permite autorización con PIN del supervisor en la terminal. |
| `pending_sla_hours` | 24 | Horas tras las cuales un pendiente se marca "vencido" y se escala al owner. |

Los montos son ejemplos; el dueño debe fijarlos (D-3). El servidor guarda en cada corte/movimiento el `policy_snapshot` aplicado, para que un cambio de política no reinterprete el pasado.

## 6. Bitácora de auditoría

Tabla append-only `audit_log` (genérica, reutilizable por fases posteriores: descuentos, cancelaciones, inventario).

Cada evento registra: `business_id`, `branch_id`, `entity_type` (`cash_shift`, `cash_transaction`, `cash_approval_policy`, `supervisor_assignment`), `entity_id`, `action` (`corte_z_cerrado`, `corte_z_aprobado`, `corte_z_rechazado`, `corte_z_reconteo`, `corte_z_ajustado`, `movimiento_creado`, `movimiento_autorizado`, `movimiento_rechazado`, `movimiento_validado`, `movimiento_objetado`, `politica_actualizada`, `asignacion_actualizada`, `override_owner`), `actor_id`, `actor_role` (rol activo con el que actuó), `reason`, `before` (jsonb), `after` (jsonb), `source` (`admin_web`, `pos`, `system`), `device_id`, `authorization_method`, `created_at` (servidor).

Reglas:
- **AU-01** Sin `UPDATE`/`DELETE`: la app solo inserta; la migración propone revocar esos privilegios al usuario de la app sobre la tabla (o trigger que lo impida).
- **AU-02** Se escribe **en la misma transacción** que el cambio de estado (si falla la bitácora, falla la aprobación).
- **AU-03** Motivo obligatorio en: rechazar, ajustar, objetar, override de owner, cambio de política. Opcional en aprobar.
- **AU-04** Consultable por supervisor (sus sucursales) y owner (todo); filtros por sucursal, entidad, actor, acción y rango de fechas. Exportable a CSV (patrón existente en ReportsPage).
- **AU-05** "Eliminar registros financieros" **no existe** para ningún rol (ver matriz).

## 7. Matriz de permisos (Fase 1)

✅ permitido · 🔸 solo su sucursal/su caja · 🔹 solo sucursales asignadas · ❌ no

| Acción | Cajero | Encargado (`branch_operator`) | Supervisor (`branch_supervisor`) | Owner |
|---|---|---|---|---|
| Abrir turno / Corte X / Corte Z de su caja | 🔸 | 🔸 | ❌ (no opera caja) ¹ | ✅ |
| Registrar ingreso/egreso en su turno | 🔸 | 🔸 | ❌ | ✅ |
| Cancelar su movimiento `pendiente_autorizacion` | 🔸 | 🔸 | — | ✅ |
| Registrar reconteo de Corte Z rechazado | 🔸 (su turno) | 🔸 (turnos de su sucursal) | ❌ | ✅ |
| Ver cortes y movimientos de la sucursal | 🔸 (los suyos) | 🔸 | 🔹 | ✅ |
| Aprobar / rechazar / ajustar Corte Z | ❌ | ❌ ² | 🔹 (no propios) | ✅ (override con motivo) |
| Autorizar / rechazar movimiento (previo) | ❌ | ❌ ² | 🔹 remoto o PIN en sitio | ✅ |
| Validar / objetar movimiento (posterior) | ❌ | ❌ | 🔹 | ✅ |
| Reabrir un Corte Z aprobado | ❌ | ❌ | ❌ | ✅ con motivo |
| Ver bitácora de auditoría | ❌ | ❌ | 🔹 | ✅ |
| Editar umbrales / política | ❌ | ❌ | ❌ (solo lectura) | ✅ |
| Asignar supervisores a sucursales | ❌ | ❌ | ❌ | ✅ |
| Crear sucursales / modificar permisos de administradores | ❌ | ❌ | ❌ | ✅ |
| Eliminar registros financieros | ❌ | ❌ | ❌ | ❌ |

¹ Si una persona es supervisor y también cajero, usa roles distintos (multi-rol existente, `users.roles`) y CZ-06/MV-06 le impiden aprobar lo que hizo con el rol de cajero.
² Ver D-2: opción de que el encargado haga una **primera revisión** (sin aprobación final) en sucursales sin supervisor.

Propuesta para fases siguientes (tabla del brief): ver ventas de sus sucursales ✅🔹 · consultar cortes y arqueos ✅🔹 (Fase 1) · autorizar descuentos excepcionales y cancelaciones/devoluciones ✅🔹 con umbral (Fase 3) · revisar/aprobar requisiciones ✅🔹 solo **primer visto bueno**, la aprobación de almacén sigue en `warehouse_purchasing_operator` (Fase 3) · autorizar ajustes de inventario ✅🔹 con umbral (Fase 3) · consultar movimientos y auditorías ✅🔹 (Fase 1) · crear sucursales ❌ · modificar permisos de administradores ❌ · eliminar registros financieros ❌.

## 8. Notificaciones

| Evento | Quién se entera | Canal Fase 1 |
|---|---|---|
| Corte Z en `pendiente_aprobacion` | Supervisores asignados a la sucursal | Bandeja Admin web con contador (polling 60 s) |
| Movimiento `pendiente_autorizacion` | Supervisores asignados | Bandeja + contador; en el POS el cajero ve "Esperando autorización" |
| Autorizado / rechazado / corte rechazado | Terminal(es) de la sucursal | Evento WebSocket `approval_resolved` al cuarto de la sucursal (gateway existente) + refresco al reconectar |
| Pendiente vence SLA | Owner | Bandeja owner (marcado "vencido") |
| Diferencia > umbral alto (p. ej. $500) | Supervisor + owner | Bandeja, resaltado rojo |

Fase 2+: push en móvil / correo / WhatsApp (decisión D-6). El gateway hoy registra clientes **por sucursal** (`sync.gateway.ts`); para notificar al supervisor en tiempo real se propone un cuarto `user:{id}` en Fase 2; en Fase 1 basta polling.

## 9. Offline en POS Flutter

Estado actual verificado: abrir turno, ingresos/egresos y Corte Z son **solo en línea** (`app_state.dart`: `http.post` con timeout; sin cola). Solo el turno activo se cachea en `SecureStorageService`.

Propuesta Fase 1:
- **OF-01** Los movimientos bajo `umbral_autorizacion` se pueden registrar offline: se encolan con `client_uuid` (mismo patrón que `_pendingSaleSyncJobs`), se muestran como "pendiente de sincronizar" y el servidor asigna el estado de aprobación al sincronizar. El `client_uuid` evita duplicados.
- **OF-02** Movimientos que requieren autorización previa **offline**: solo con PIN del supervisor en sitio validado contra credenciales cacheadas (patrón `verifyOfflineCredentials`). Se marca `authorization_method = pin_offline`; al sincronizar, el servidor re-valida que el supervisor esté asignado a la sucursal y activo. Si no pasa, el movimiento queda `pendiente_revision` con alerta. Si `allow_pin_in_situ = false` o no hay supervisor, el movimiento no se puede hacer offline.
- **OF-03** El Corte Z sigue siendo en línea en Fase 1 (decisión conservadora: el cálculo del esperado depende de pagos en servidor). Ver D-5.
- **OF-04** **Aprobar/rechazar nunca es offline**: lo decide el servidor.
- **OF-05** Requiere que el PIN de supervisores asignados se cachee (hash) en las terminales de sus sucursales. Riesgo aceptado y documentado; el PIN del supervisor debe ser distinto y rotable.

## 10. Requisitos funcionales

- **FR-001** El sistema MUST incorporar el rol `branch_supervisor` al catálogo canónico de roles, con alcance por sucursales asignadas.
- **FR-002** El sistema MUST permitir al owner asignar/desasignar sucursales a un supervisor y auditar esas asignaciones.
- **FR-003** Todo Corte Z cerrado después del despliegue MUST obtener un `review_status` calculado en servidor según la política vigente.
- **FR-004** El supervisor MUST poder aprobar, rechazar (pidiendo reconteo) o aprobar con ajuste un Corte Z de sus sucursales, con motivo obligatorio en rechazo/ajuste.
- **FR-005** El sistema MUST conservar intacto el `close_snapshot` original y registrar cada reconteo/ajuste como versión en la bitácora.
- **FR-006** Todo movimiento de caja MUST registrar actor, categoría, motivo, `client_uuid` y estado de aprobación.
- **FR-007** Movimientos sobre umbral de autorización MUST no afectar el efectivo esperado hasta ser autorizados.
- **FR-008** El sistema MUST impedir la auto-aprobación de cortes y movimientos, también vía peticiones directas.
- **FR-009** Toda transición de aprobación MUST escribir un evento en `audit_log` en la misma transacción, con antes/después.
- **FR-010** Las autorizaciones MUST validarse en servidor (BR-ROLE-004); Admin y POS solo ocultan acciones.
- **FR-011** El POS MUST mostrar al cajero el estado de sus movimientos y del Corte Z (pendiente/aprobado/rechazado) y permitir el reconteo cuando se rechace.
- **FR-012** El owner MUST poder configurar los umbrales por negocio y por sucursal.

## 11. Fases posteriores

| Fase | Contenido | Reutiliza |
|---|---|---|
| **2 — Dashboard de supervisión** | Vista "todas mis sucursales, hoy": ventas totales, sucursales abiertas X/Y (turno abierto), diferencias de caja acumuladas, alertas pendientes (cortes + movimientos + inventario), ventas por sucursal, "N sucursales requieren revisión". Notificaciones push/tiempo real. | `GET /reports/sales-dashboard`, `inventory_alerts`, `cash_shifts`, bandeja de Fase 1 |
| **3 — Autorizaciones operativas** | Descuentos excepcionales, cancelaciones/devoluciones (hoy `orders.cancelled_by/cancellation_reason` sin aprobación), ajustes de inventario, primer visto bueno de requisiciones. Todo sobre el mismo motor de políticas + `audit_log`. | Motor de umbrales y bitácora de Fase 1 |
| **4 — KPIs del supervisor** | Ventas vs meta (requiere tabla de metas), diferencias de caja (faltantes/sobrantes), merma (`inventory_movements` tipo merma), cancelaciones/devoluciones (frecuencia, monto, motivo), disponibilidad de productos esenciales (`branch_stock_thresholds`), productividad (ventas por empleado/turno), cumplimiento operativo (requiere checklists de inspección). | `reports.service`, `stock_ledger`, `audit_log` |
| **5 — Operación de campo** | Arqueo sorpresa (Corte X firmado por supervisor), checklists de visita/inspección, asistencia del personal. | Corte X existente |

## 12. Criterios de éxito

- **SC-001** 100 % de los Cortes Z posteriores al despliegue tienen `review_status` distinto de `no_aplica`.
- **SC-002** 0 movimientos de caja sin `created_by` después del despliegue.
- **SC-003** Un intento de auto-aprobación vía HTTP directo devuelve 403 (test de autorización).
- **SC-004** Cada aprobación/rechazo/ajuste tiene exactamente un evento en `audit_log` con antes/después.
- **SC-005** El supervisor ve en la bandeja solo sucursales asignadas (test con dos supervisores).
- **SC-006** Un cajero sin conexión puede seguir registrando movimientos bajo umbral y cerrar operaciones de venta sin bloqueo.

## 13. Riesgos detectados en el código actual

| # | Riesgo | Evidencia | Mitigación propuesta |
|---|---|---|---|
| R-1 | **Endpoints de reportes de caja sin guard** | En `reports.controller.ts`, `GET /reports/cash-shifts`, `/reports/sales/payment-methods`, `/reports/sales/products`, `/reports/inventory/existence` y `/reports/inventory/kardex` no tienen `@UseGuards` (no hay guard a nivel de clase ni `APP_GUARD` global). Cualquiera con un `businessId` puede listar cortes, ventas e inventario. | Corregir **antes** de Fase 1 (cambio pequeño, independiente): `JwtAuthGuard + RolesGuard + assertScope`. |
| R-2 | Añadir el supervisor a `ADMIN_ROLES` le daría acceso a **todas** las sucursales | `reports.service.ts:613` trata cualquier rol de `ADMIN_ROLES` como sin restricción de sucursal en el reporte de auditoría; `users.service.ts` usa `ADMIN_ROLES` para el alta de administradores. | Nuevo grupo `SUPERVISION_ROLES`; el alcance se resuelve siempre con `supervisor_branch_assignments`, nunca por pertenecer a un grupo. |
| R-3 | `RolesGuard` deja pasar a `owner` siempre | `roles.guard.ts` | Correcto para owner, pero las reglas de "no auto-aprobación" deben vivir en el servicio, no en el guard. |
| R-4 | Admin web decide pestañas por `user.role` (primer rol) | `App.tsx` `roleTabs[user?.role]` | Calcular pestañas con la unión de `user.roles` o con rol activo elegido. |
| R-5 | Movimientos sin idempotencia ni actor | `cash_transactions` sin `created_by`/`client_uuid`; Flutter reintenta por timeout | Columnas nuevas (data-model) y `ON CONFLICT (client_uuid)`. |
| R-6 | Egresos pueden dejar el cajón negativo en servidor | `ShiftsService.createTransaction` resta sin validar; Flutter solo hace `max(0, …)` | MV-04. |
| R-7 | Auto-cierre >24 h sin conteo | `ShiftsService.openShift` | CZ-05. |
| R-8 | PIN del supervisor cacheado en terminales (offline) | OF-05 | PIN propio, rotación, revalidación al sincronizar, opción de desactivar. |
| R-9 | Migraciones fuera del journal de Drizzle | `AGENTS.md` (caveat `admin_business_access`) | Script idempotente (`IF NOT EXISTS`) como en `idempotent-deploy-migrations.ts`, coordinado en `workspaces.md`. |
| R-10 | Dos supervisores actúan a la vez | — | Concurrencia optimista con `version` (CZ-07). |

## 14. Qué se reutiliza del código existente

- `ShiftsService.buildShiftReport` / `getCorteReport` y `cash_shifts.close_snapshot`: base del detalle que revisa el supervisor (esperado, contado, diferencia, movimientos, denominaciones).
- `GET /reports/cash-shifts` y `GET /reports/cash-shifts/:id/audit`: listado y detalle; se agregan `review_status` y filtros.
- Admin `ReportsPage.tsx` → pestaña "Cortes de Caja" (tabla, badge de discrepancia, modal de auditoría, export CSV): se extiende con columna de estado y botones de acción.
- `RequisitionsApprovalPage.tsx`: patrón de bandeja aprobar/rechazar y badges de estado.
- Regla BR-ROLE-003 (no auto-aprobación) y su patrón en `requisitions.service.ts`.
- Multi-rol (`users.roles`, spec 013), `admin_business_access`, `assertBusinessAccess`, `RolesGuard`, `roleTabs`.
- Flutter: diálogos de ingreso/retiro y Corte Z en `encargado_caja_tab.dart` y `cashier/shift_control_panel.dart`; cola offline (`_pendingSaleSyncJobs`) y `verifyOfflineCredentials`.
- `sync.gateway.ts` (cuartos por sucursal) para avisar resultados a las terminales.

## 15. Decisiones abiertas para el dueño

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| **D-1** | ¿Supervisor de **varias sucursales asignadas** o **uno dentro de cada sucursal**? | (a) Varias sucursales por supervisor; (b) uno por sucursal. | **(a) Varias sucursales, modelado como asignaciones N:N** (`supervisor_branch_assignments`). Razones: coincide con la definición del brief ("supervisa varias sucursales"); el rol "dentro de la sucursal" ya existe y es el encargado (`branch_operator`); una persona que aprueba los cortes de la sucursal donde trabaja a diario pierde independencia (control débil); el modelo N:N cubre el caso "uno por sucursal" asignando una sola sucursal, sin rediseño. Además una sucursal puede tener 2 supervisores (titular y suplente) para vacaciones. |
| **D-2** | En sucursales sin supervisor asignado, ¿quién aprueba? | (a) Owner; (b) el encargado hace primera revisión y owner aprueba; (c) se aprueba automáticamente. | **(a) Owner**, con la bandeja de owner. (b) se puede añadir después. (c) anula el control. |
| **D-3** | Montos de umbrales iniciales (diferencia auto-aprobable, montos de revisión y autorización de egresos/ingresos). | Ver §5. | Arrancar con: Corte Z auto ≤ $20; egresos ≥ $500 revisión, ≥ $2,000 autorización previa; ingresos solo revisión ≥ $1,000; ajustar tras 2 semanas con datos reales. |
| **D-4** | ¿Bloquear la apertura del siguiente turno si el Corte Z anterior está rechazado/pendiente? | Sí / No / Solo si rechazado y vencido. | **No bloquear** en Fase 1 (no detener ventas); escalar al owner por SLA. |
| **D-5** | ¿Permitir Corte Z offline? | Sí (cola, el servidor recalcula) / No. | **No en Fase 1.** Revisar en Fase 2 si hay sucursales con conectividad mala. |
| **D-6** | Canal de notificación al supervisor fuera de la app. | Solo bandeja / push / correo / WhatsApp. | Bandeja en Fase 1; push o WhatsApp en Fase 2 según uso real. |
| **D-7** | ¿El supervisor puede autorizar con PIN en la terminal (en sitio) o solo desde su sesión? | PIN en sitio sí/no. | **Sí**, desactivable por política; cada uso queda en bitácora con dispositivo. |
| **D-8** | ¿Un faltante aprobado se registra como adeudo del cajero? | Solo registro / adeudo formal. | Solo registro en Fase 1 (KPI de diferencias); adeudo formal requiere política laboral del dueño. |
| **D-9** | ¿El supervisor también puede ver ventas en vivo de sus sucursales desde Fase 1? | Sí / esperar a Fase 2. | Solo lo necesario para revisar el corte en Fase 1; dashboard completo en Fase 2. |
