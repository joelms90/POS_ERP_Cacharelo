# Feature Specification: Supervisor de Sucursal — Fase 1: Aprobación de Cortes Z e Ingresos/Egresos de caja

**Feature Branch**: `019-supervisor-sucursal`
**Created**: 2026-11-22 · **Updated**: 2026-11-22 (segunda ronda de decisiones del dueño)
**Status**: Propuesta (NO implementado). Todas las decisiones (D-1 a D-11) y supuestos (S-1 a S-6) están resueltos. Quedan 3 detalles menores por confirmar (§15.3).
**Input**: [brief.md](brief.md) — pedido del dueño: rol "supervisor de sucursal"; lo primero que debe tener es (1) **aprobar cortes Z** y (2) **aprobar ingresos y egresos de caja**.

---

## 1. Problema

Hoy el sistema **registra** el dinero de caja pero nadie lo **valida**:

| Situación actual (verificada en código) | Consecuencia |
|---|---|
| El Corte Z (`POST /cash-shifts/:id/close`) cierra el turno en un solo paso: guarda conteo, denominaciones, notas y `close_snapshot`. `cash_shifts.status` solo tiene `open`/`closed`. | Un faltante de $850 queda "cerrado" igual que un corte perfecto. No hay revisión ni responsable. |
| Los ingresos/egresos (`POST /cash-shifts/:id/transactions`) se aplican de inmediato al `cash_drawer_amount`. | Un retiro de $5,000 "Gasto operativo" entra sin que nadie lo revise. |
| `cash_transactions` **no guarda quién** registró el movimiento (no tiene `created_by`). | Imposible auditar quién sacó el dinero. |
| La categoría del movimiento se concatena al texto libre de `reason` en Flutter. | No se puede filtrar por tipo de movimiento. |
| Los faltantes no generan ningún registro hacia el cajero. | No hay seguimiento del dinero faltante. |
| Los roles existentes son `owner` (todo) y `branch_operator` (opera **una** sucursal). | No hay nivel intermedio que supervise varias sucursales. |

## 2. Alcance

### Fase 1 (esta propuesta)
1. Nuevo rol **`branch_supervisor`** ("Supervisor de sucursal") que cubre **varias sucursales asignadas** (D-1).
2. **Cadena de aprobación de caja** (D-3, S-1):
   - **Corte Z**: dos niveles obligatorios. Primero el Operador Integral de Sucursal (OIS, `branch_operator`) y después el supervisor asignado u owner.
   - **Ingresos/egresos**: un nivel, el OIS. Además, el supervisor puede **cancelar o ajustar** cualquier movimiento (S-4).
   - Lo que hace el propio OIS pasa **directo al supervisor** (S-3).
3. **Bloqueo de apertura**: no se abre el siguiente turno de la sucursal mientras el OIS no haya aprobado el Corte Z anterior (D-4).
4. **Corte Z sin conexión** en el POS Flutter (D-5).
5. **Adeudo formal del cajero** por faltante aprobado (D-8).
6. **Bandejas de aprobación**: Admin web (supervisor y owner, D-10) y POS (OIS), más **notificaciones push en celular** (D-6).
7. **Vista del supervisor limitada a caja**: ve lo que hicieron el cajero y el OIS en caja (cortes, movimientos, bitácora) de sus sucursales. **No** ve ventas en vivo (D-9).
8. **Bitácora de auditoría** inmutable: usuario, rol, fecha, motivo, valores antes/después.

### Fuera de alcance de Fase 1 (ver §11)
Umbrales configurables, tratamiento de turnos auto-cerrados >24 h (D-11), ventas en vivo para el supervisor (D-9), autorización de descuentos/cancelaciones/devoluciones, inventario, requisiciones, arqueos sorpresa, personal.

## 3. Glosario

- **OIS**: Operador Integral de Sucursal = rol `branch_operator` (spec 013).
- **Corte Z**: cierre definitivo de turno con conteo físico. **Corte X**: reporte de turno abierto (sin cambios).
- **Diferencia**: `contado − esperado`, con `esperado = fondo inicial + ventas efectivo + ingresos − egresos` (`ShiftsService.buildShiftReport`). Negativa = faltante.
- **N1**: aprobación del OIS de la sucursal. **N2**: aprobación del supervisor asignado o del owner.
- **Administrador** (para aprobar): solo `owner` (S-2).

## 4. Flujos actuales vs propuestos

### 4.1 Corte Z

**Actual**: `open ──Corte Z──▶ closed` (nadie revisa).

**Propuesto**: el ciclo operativo (`status`, sin cambios) se separa del de revisión (`review_status`, nuevo):

```
                        Corte Z (en línea u offline → al sincronizar)
                                        │
          cerró el cajero ──────────────┴────────────── cerró el OIS (S-3)
                 ▼                                              │
        pendiente_operador (N1: OIS)                            │
        aprueba │          │ rechaza                            │
                │          ▼                                    │
                │   rechazado_operador                          │
                │     └─ reconteo del cajero ─▶ pendiente_operador
                ▼                                               ▼
        pendiente_supervisor (N2: supervisor asignado u owner) ◀┘
        aprueba │      ajusta │        │ rechaza
                ▼             ▼        ▼
            aprobado   aprobado_con_   rechazado_supervisor
                       ajuste            ├─ reconteo de cajero/OIS ─▶ pendiente_supervisor (S-5)
                                         └─ supervisor ajusta ───────▶ aprobado_con_ajuste
     (owner) aprobado* ─reabrir─▶ pendiente_supervisor
```

Reglas:
- **CZ-01** El Corte Z se hace igual que hoy en la terminal, **también sin conexión** (D-5, ver §9). Al llegar al servidor queda en `pendiente_operador`, o en `pendiente_supervisor` si lo cerró un OIS (S-3).
- **CZ-02** **N1 (OIS de esa sucursal)**: aprueba (→ `pendiente_supervisor`) o rechaza (→ `rechazado_operador`, motivo obligatorio). Tras el rechazo, el cajero registra un **reconteo** y el corte vuelve a `pendiente_operador`.
- **CZ-03** **N2 es obligatorio para todo Corte Z** (S-1). Lo hace un supervisor asignado a la sucursal o el owner (S-2): aprueba (→ `aprobado`), aprueba con ajuste (monto final + motivo → `aprobado_con_ajuste`) o rechaza (→ `rechazado_supervisor`, motivo obligatorio).
- **CZ-04** Tras un rechazo de N2 (S-5), el cajero u OIS registra un nuevo conteo que regresa **directo al supervisor** (`pendiente_supervisor`, sin pasar otra vez por N1), **o** el supervisor resuelve con un ajuste.
- **CZ-05** Ningún rechazo reabre el turno (el efectivo ya salió y puede haber otro turno abierto). El `close_snapshot` original **nunca se sobrescribe**; los reconteos y ajustes quedan como versiones en la bitácora.
- **CZ-06** Un nivel no puede aprobar un corte mientras haya movimientos del mismo turno pendientes de N1 o N2.
- **CZ-07** Nadie aprueba su propio corte (`closed_by == actor` → 403). Esto extiende BR-ROLE-003.
- **CZ-08** El supervisor y el owner **no sustituyen al OIS** en N1 (S-6). La única forma de saltar N1 es que el autor sea el OIS (S-3).
- **CZ-09** Concurrencia: cada acción exige la `version` vigente; si otra persona actuó antes, el servidor responde 409.
- **CZ-10** **Bloqueo de apertura (D-4)**: no se puede abrir un turno nuevo en la sucursal mientras su último Corte Z esté en `pendiente_operador` o `rechazado_operador`. Cuando el OIS lo aprueba, la sucursal puede abrir aunque el supervisor no haya resuelto N2. Un corte cerrado por el OIS (que no pasa por N1) no bloquea.
- **CZ-11** Al quedar **aprobado** o **aprobado con ajuste** con diferencia final negativa, se genera un **adeudo** a nombre del cajero del turno (§4.3).
- **CZ-12** Los turnos históricos y los auto-cerrados por el sistema (>24 h) quedan `no_aplica` y no entran al flujo ni bloquean (D-11; ver R-7).

### 4.2 Ingresos y egresos de caja

**Actual**: `POST transactions` se aplica al cajón, sin actor ni aprobación.

**Propuesto**: **todo se registra y cuenta en caja desde el momento del registro** (S-4). La aprobación de movimientos es de un solo nivel, el OIS (S-1):

```
registrado (cuenta en caja)
   ├─ autor = cajero ─▶ pendiente_operador ─(OIS aprueba)─▶ aprobado
   │                                      └(OIS rechaza)─▶ rechazado  (sigue contando; incidencia)
   └─ autor = OIS ────▶ pendiente_supervisor ─(supervisor/owner aprueba)─▶ aprobado      (S-3)
                                             └(rechaza)─▶ rechazado

En cualquier estado, mientras el Corte Z del turno no esté aprobado:
   supervisor/owner ─cancelar─▶ cancelado  (deja de contar en caja)
   supervisor/owner ─ajustar──▶ monto corregido (conserva el monto original)
```

Reglas:
- **MV-01** Todo movimiento guarda `created_by`, categoría estructurada, motivo y `client_uuid` (idempotencia).
- **MV-02** Categorías iniciales = las de Flutter. Ingresos: `aporte_cambio`, `reposicion_fondo`, `correccion`, `otro_ingreso`. Egresos: `gasto_operativo`, `entrega_encargado`, `transferencia_caja`, `correccion`, `otro_egreso`.
- **MV-03** El movimiento **cuenta en el efectivo esperado desde que se registra**. Un `rechazado` sigue contando (el dinero sí se movió) y queda como incidencia del turno. Solo un **cancelado** deja de contar.
- **MV-04** **Cancelar y ajustar** son acciones exclusivas del supervisor (sus sucursales) y del owner. Requieren motivo y se permiten hasta que el Corte Z del turno quede aprobado. Un ajuste recalcula el esperado y la diferencia del corte; la bitácora conserva antes y después. Cajero y OIS no cancelan ni editan; para corregir registran un movimiento de categoría `correccion`.
- **MV-05** Un egreso que deje el esperado en negativo se rechaza en el servidor (hoy solo Flutter lo recorta a 0).
- **MV-06** Nadie aprueba su propio movimiento (por eso los del OIS van al supervisor).
- **MV-07** Los movimientos se ven con su estado en el detalle del Corte Z (CZ-06).

### 4.3 Adeudo del cajero (D-8)

- **AD-01** Al aprobarse en N2 un Corte Z con diferencia final negativa, el sistema crea un adeudo con: cajero del turno, sucursal, turno, monto = |diferencia final|, fecha y aprobador.
- **AD-02** Si después el owner reabre el corte, el adeudo se anula y se vuelve a generar con la nueva aprobación. Todo queda en la bitácora.
- **AD-03** El adeudo se ve en el Admin web (supervisor: sus sucursales; owner: todo) y el cajero ve los suyos en el POS.
- **AD-04** Los sobrantes no generan adeudo; quedan registrados en el corte.
- Cómo se liquida (descuento de nómina, pago en caja, condonación) está por confirmar (§15.3, P-1).

## 5. Umbrales configurables — fase futura

Sin umbrales en Fase 1 (D-3). Para el futuro, sin montos definidos: auto-aprobación de cortes con diferencia pequeña, autorización previa de movimientos por monto o categoría, PIN del supervisor en la terminal, límite de reconteos, SLA de pendientes, y política por negocio con override por sucursal.

## 6. Bitácora de auditoría

Tabla append-only `audit_log` con `business_id`, `branch_id`, `entity_type` (`cash_shift`, `cash_transaction`, `cashier_debt`, `supervisor_assignment`), `entity_id`, `action`, `approval_level` (`n1`, `n2`, `owner`), `actor_id`, `actor_role`, `reason`, `before`, `after`, `source` (`admin_web`, `pos`, `system`), `device_id` y `created_at` (servidor).

Acciones: `corte_z_cerrado`, `corte_z_aprobado`, `corte_z_rechazado`, `corte_z_reconteo`, `corte_z_ajustado`, `corte_z_reabierto`, `movimiento_creado`, `movimiento_aprobado`, `movimiento_rechazado`, `movimiento_cancelado`, `movimiento_ajustado`, `adeudo_generado`, `adeudo_anulado`, `apertura_bloqueada`, `asignacion_actualizada`.

- **AU-01** Solo inserción: sin `UPDATE`/`DELETE` (revocar privilegios o usar un trigger).
- **AU-02** Se escribe en la misma transacción que el cambio de estado.
- **AU-03** El motivo es obligatorio en: rechazar, ajustar, cancelar y reabrir.
- **AU-04** Consultable por el supervisor (sus sucursales) y el owner. Filtros: sucursal, entidad, actor (cajero/OIS), acción y fechas. Exportable a CSV.
- **AU-05** "Eliminar registros financieros" no existe para ningún rol.

## 7. Matriz de permisos (Fase 1)

✅ permitido · 🔸 solo su sucursal/su caja · 🔹 solo sucursales asignadas · ❌ no

| Acción | Cajero | OIS (`branch_operator`) | Supervisor (`branch_supervisor`) | Owner |
|---|---|---|---|---|
| Abrir turno / Corte X / Corte Z de su caja (también offline) | 🔸 | 🔸 | ❌ | ✅ |
| Registrar ingreso/egreso en su turno | 🔸 | 🔸 | ❌ | ✅ |
| Registrar reconteo tras rechazo del OIS | 🔸 (su turno) | ❌ | ❌ | ❌ |
| Registrar reconteo tras rechazo del supervisor | 🔸 (su turno) | 🔸 (su sucursal) | ❌ | ❌ |
| N1: aprobar/rechazar Corte Z del cajero | ❌ | 🔸 | ❌ (S-6) | ❌ (S-6) |
| N1: aprobar/rechazar movimiento del cajero | ❌ | 🔸 | ❌ (S-6) | ❌ (S-6) |
| N2: aprobar/rechazar/ajustar Corte Z | ❌ | ❌ | 🔹 (no propios) | ✅ |
| Aprobar/rechazar movimiento hecho por el OIS | ❌ | ❌ | 🔹 | ✅ |
| Cancelar o ajustar un movimiento (antes de aprobar el corte) | ❌ | ❌ | 🔹 | ✅ |
| Reabrir un Corte Z aprobado | ❌ | ❌ | ❌ | ✅ con motivo |
| Ver cortes, movimientos y bitácora de caja de cajeros y OIS | 🔸 (los suyos) | 🔸 | 🔹 | ✅ |
| Ver ventas en vivo | — | (como hoy) | ❌ (D-9) | ✅ |
| Ver adeudos | 🔸 (los suyos) | ❌ | 🔹 | ✅ |
| Asignar supervisores a sucursales | ❌ | ❌ | ❌ | ✅ |
| Crear sucursales / modificar permisos de administradores | ❌ | ❌ | ❌ | ✅ |
| Eliminar registros financieros | ❌ | ❌ | ❌ | ❌ |

El alcance de revisión del supervisor en Fase 1 es **solo caja** (D-9).

Para fases siguientes (tabla del brief):
- Autorizar descuentos, cancelaciones/devoluciones y ajustes de inventario: ✅🔹 (Fase 3).
- Primer visto bueno de requisiciones: ✅🔹 (Fase 3).
- Ventas de sus sucursales: por confirmar en la Fase 2 (hoy D-9 = no en vivo).
- Crear sucursales, modificar permisos de administradores y eliminar registros financieros: ❌.

## 8. Notificaciones (D-6: push en celular)

| Evento | A quién | Canal |
|---|---|---|
| Corte Z o movimiento en `pendiente_operador` | OIS de la sucursal | **Push** + evento WebSocket `approval_requested` + contador en la pestaña Caja del POS |
| Corte Z o movimiento en `pendiente_supervisor` | Supervisores asignados y owner | **Push** + contador en la bandeja del Admin web |
| Aprobado / rechazado / cancelado / ajustado | Cajero autor y terminal de la sucursal | **Push** al cajero + WebSocket `approval_resolved` |
| Apertura de turno bloqueada | OIS de la sucursal | **Push** ("Aprueba el Corte Z anterior para abrir caja") |
| Adeudo generado | Cajero | **Push** + aviso en el POS |

Push = Firebase Cloud Messaging: Web Push en el Admin web (PWA en Firebase Hosting) y FCM en el POS Flutter (Android y web). Hoy no existe ninguna integración de push en las apps (R-12). La bandeja con contador sigue siendo la fuente de verdad; el push solo avisa.

## 9. Offline en POS Flutter

Estado actual verificado: abrir turno, ingresos/egresos y Corte Z son **solo en línea** (`app_state.dart`, sin cola). Solo el turno activo se cachea.

- **OF-01** Los movimientos se pueden registrar offline: se encolan con `client_uuid` y quedan "pendiente de sincronizar".
- **OF-02** **Corte Z offline (D-5)**:
  - El cajero captura el conteo y el POS imprime un ticket marcado **"PROVISIONAL — sin sincronizar"**, con el esperado calculado localmente.
  - Al recuperar conexión se envía con `client_uuid`. El servidor **recalcula el esperado** con los pagos sincronizados, guarda el `close_snapshot` oficial y lo pone en revisión.
  - Si el esperado del servidor difiere del local, el detalle muestra ambos para el OIS y el supervisor.
- **OF-03** **Orden de sincronización**: primero ventas/pagos, después movimientos y al final el Corte Z del mismo turno. Si no, el servidor calcularía el esperado sin todas las ventas.
- **OF-04** Aprobar, rechazar, cancelar y ajustar **requieren conexión**; el servidor decide.
- **OF-05** Abrir turno ya es solo en línea hoy. Con D-4, si el Corte Z anterior se hizo offline, no se podrá abrir turno hasta que sincronice y el OIS lo apruebe.

## 10. Requisitos funcionales

- **FR-001** El sistema MUST incorporar el rol `branch_supervisor` con alcance por varias sucursales asignadas.
- **FR-002** El owner MUST poder asignar y desasignar sucursales a supervisores, con auditoría.
- **FR-003** Todo Corte Z MUST pasar por N1 (OIS) y N2 (supervisor u owner), salvo que lo haya cerrado el OIS, en cuyo caso va directo a N2.
- **FR-004** Todo ingreso/egreso MUST contar en caja al registrarse y MUST ser aprobado por el OIS, o por el supervisor si su autor es el OIS.
- **FR-005** El supervisor y el owner MUST poder cancelar o ajustar movimientos, con motivo, hasta que se apruebe el corte.
- **FR-006** El sistema MUST impedir abrir un turno nuevo mientras el último Corte Z de la sucursal esté pendiente o rechazado en N1.
- **FR-007** El POS MUST permitir el Corte Z sin conexión y sincronizarlo después, con recálculo en el servidor.
- **FR-008** El sistema MUST generar un adeudo al cajero cuando N2 apruebe un corte con faltante.
- **FR-009** El sistema MUST enviar notificaciones push a quien deba aprobar y a quien sea afectado por la decisión.
- **FR-010** El supervisor MUST ver cortes, movimientos y bitácora de caja de cajeros y OIS de sus sucursales, y MUST NOT ver ventas en vivo.
- **FR-011** El sistema MUST impedir la auto-aprobación y que el supervisor u owner actúen en N1, también vía peticiones directas.
- **FR-012** Toda transición MUST escribir en `audit_log` en la misma transacción, con nivel, antes y después.
- **FR-013** Las autorizaciones MUST validarse en el servidor (BR-ROLE-004).

## 11. Fases posteriores

| Fase | Contenido |
|---|---|
| **2 — Dashboard de supervisión** | Sucursales abiertas X/Y, diferencias de caja acumuladas, pendientes por sucursal, "N sucursales requieren revisión". Las métricas de **ventas** del brief quedan por confirmar por D-9. |
| **2b — Umbrales y auto-cierre** | Umbrales (§5); turnos auto-cerrados >24 h (R-7). |
| **3 — Autorizaciones operativas** | Descuentos, cancelaciones/devoluciones, ajustes de inventario, primer visto bueno de requisiciones, sobre la misma cadena y la misma bitácora. |
| **4 — KPIs del supervisor** | Diferencias de caja, adeudos, movimientos rechazados/cancelados por cajero, merma, cancelaciones/devoluciones, disponibilidad de productos, productividad, cumplimiento operativo. |
| **5 — Operación de campo** | Arqueo sorpresa, checklists de visita, asistencia. |

## 12. Criterios de éxito

- **SC-001** 100 % de los Cortes Z posteriores al despliegue (no auto-cerrados) tienen `review_status` distinto de `no_aplica`.
- **SC-002** 0 movimientos sin `created_by`.
- **SC-003** Las peticiones HTTP directas para auto-aprobar, para que el supervisor actúe en N1 o para aprobar N2 antes de N1 devuelven 403/409.
- **SC-004** Abrir un turno con el último corte en `pendiente_operador` devuelve 409 con un mensaje claro.
- **SC-005** Un Corte Z hecho offline se sincroniza sin duplicarse y con el esperado recalculado.
- **SC-006** Cada transición tiene exactamente un evento en `audit_log`.
- **SC-007** Un corte aprobado con faltante genera exactamente un adeudo.
- **SC-008** El supervisor solo ve sus sucursales asignadas y no accede a endpoints de ventas en vivo.

## 13. Riesgos

| # | Riesgo | Evidencia | Mitigación |
|---|---|---|---|
| R-1 | **Endpoints de reportes sin guard** | `reports.controller.ts`: `cash-shifts`, `sales/payment-methods`, `sales/products`, `inventory/existence` e `inventory/kardex` no tienen `@UseGuards` (no hay guard global). | Corregir antes de Fase 1. Además cierra D-9: hoy un supervisor podría ver ventas por esos endpoints. |
| R-2 | Agregar el supervisor a `ADMIN_ROLES` le daría todas las sucursales | `reports.service.ts:613`, `users.service.ts` | Nuevo grupo `SUPERVISION_ROLES` + `supervisor_branch_assignments`. |
| R-3 | `RolesGuard` deja pasar siempre a `owner` | `roles.guard.ts` | Las reglas de nivel (S-6: owner no actúa en N1) van en el servicio, no en el guard. |
| R-4 | Admin web decide pestañas por `user.role` | `App.tsx` | Usar la unión de `user.roles`. |
| R-5 | Movimientos sin idempotencia ni actor | `cash_transactions` | `client_uuid`, `created_by`. |
| R-6 | Egresos dejan el cajón negativo en el servidor | `ShiftsService.createTransaction` | MV-05. |
| R-7 | **Auto-cierre >24 h sin conteo (fuera de Fase 1, D-11)** | `openShift` cierra sin conteo; `cash_drawer_amount` no incluye ventas en efectivo, así que el reporte muestra un faltante falso ≈ ventas en efectivo. | Fase 2b. En Fase 1 quedan `no_aplica`, no bloquean y **no generan adeudo** (evita cobrarle al cajero un faltante falso). |
| R-8 | **Sucursal bloqueada sin poder abrir caja (D-4)** | Si el OIS no está o no tiene conexión, nadie más puede hacer N1 (S-6). | Push al OIS (§8) y mensaje claro en el POS. Confirmar si el owner puede desbloquear en emergencias (§15.3, P-2). |
| R-9 | Corte Z offline con esperado distinto al del servidor | OF-02 | Recalcular en el servidor, mostrar ambos valores y respetar el orden de sincronización (OF-03). |
| R-10 | **Adeudo generado por error** (ventas no sincronizadas, auto-cierre, ajuste posterior) | AD-01 | Solo se genera tras N2; se anula si el owner reabre; los auto-cerrados se excluyen. |
| R-11 | Carga operativa: cada movimiento y cada corte requieren aprobación | D-3 | Medir el volumen; los umbrales son la palanca futura. |
| R-12 | **Push es una integración nueva** | Ni `pubspec.yaml` ni `package.json` tienen Firebase Messaging. | Configurar FCM (claves VAPID, service worker web, permisos Android) y tabla de tokens. |
| R-13 | Migraciones fuera del journal de Drizzle | `AGENTS.md` | Script idempotente coordinado. |
| R-14 | Dos aprobadores al mismo tiempo | — | `version` (CZ-09). |

## 14. Qué se reutiliza

- `ShiftsService.buildShiftReport` / `getCorteReport` y `close_snapshot`: el detalle que revisan el OIS y el supervisor.
- `GET /reports/cash-shifts` y `/reports/cash-shifts/:id/audit`, más la pestaña "Cortes de Caja" de `ReportsPage.tsx` (tabla, badge de diferencia, modal, CSV).
- `RequisitionsApprovalPage.tsx`: patrón de bandeja.
- Regla BR-ROLE-003, multi-rol (`users.roles`), `assertBusinessAccess`, `RolesGuard`, `roleTabs`.
- Flutter: diálogos de ingreso/retiro y Corte Z (`encargado_caja_tab.dart`, `cashier/shift_control_panel.dart`), cola offline (`_pendingSaleSyncJobs`), impresión de tickets.
- `sync.gateway.ts` (cuartos por sucursal).

## 15. Decisiones del dueño

### 15.1 Decisiones

| # | Decisión | Estado | Resolución |
|---|---|---|---|
| **D-1** | ¿Supervisor de varias sucursales o uno por sucursal? | ✅ RESUELTA | Varias sucursales asignadas. |
| **D-2** | ¿Quién aprueba N2 donde no hay supervisor? | ✅ RESUELTA | El owner (D-10, S-2). |
| **D-3** | ¿Umbrales de monto? | ✅ RESUELTA | Sin umbrales en Fase 1; todo pasa por la cadena de aprobación. |
| **D-4** | ¿Bloquear el siguiente turno? | ✅ RESUELTA | **Sí**, hasta que el OIS apruebe (N1) el Corte Z anterior (CZ-10). |
| **D-5** | ¿Corte Z sin conexión? | ✅ RESUELTA | **Sí** (OF-02, OF-03). |
| **D-6** | ¿Canal de aviso fuera de la bandeja? | ✅ RESUELTA | **Push en celular** (§8). |
| **D-7** | ¿PIN del supervisor en la terminal? | Pospuesta | Fase futura (§5). |
| **D-8** | ¿Faltante como adeudo del cajero? | ✅ RESUELTA | **Sí**, adeudo formal (§4.3). |
| **D-9** | ¿Supervisor ve ventas en vivo? | ✅ RESUELTA | **No.** Ve lo que hicieron el cajero y el OIS en **caja**; la revisión es solo de caja. |
| **D-10** | ¿Admins aprueban desde el Admin web? | ✅ RESUELTA | Sí; la bandeja del Admin web está en Fase 1 (admin = owner, S-2). |
| **D-11** | ¿Auto-cierre >24 h en Fase 1? | ✅ RESUELTA | No por ahora (R-7). |

### 15.2 Supuestos

| # | Pregunta | Estado | Resolución |
|---|---|---|---|
| **S-1** | ¿N2 obligatorio para todo? | ✅ RESUELTA | **Solo para el Corte Z.** En movimientos basta el OIS. |
| **S-2** | ¿Qué administradores aprueban? | ✅ RESUELTA | **Solo `owner`.** |
| **S-3** | ¿Quién hace N1 cuando el autor es el OIS? | ✅ RESUELTA | **Siempre directo al supervisor** (o al owner). |
| **S-4** | ¿El movimiento cuenta desde que se registra? | ✅ RESUELTA | **Sí, todo se registra y cuenta**; el supervisor puede cancelarlo o ajustarlo. |
| **S-5** | ¿Quién recuenta tras un rechazo de N2? | ✅ RESUELTA | El cajero/OIS registra un nuevo conteo que aprueba el supervisor, **o** el supervisor hace el ajuste. |
| **S-6** | ¿Supervisor/owner sustituyen al OIS en N1? | ✅ RESUELTA | **No.** |

### 15.3 Detalles menores por confirmar

| # | Pregunta | Propuesta mientras no se confirme |
|---|---|---|
| **P-1** | ¿Cómo se liquida un adeudo (descuento de nómina, pago en caja, condonación) y quién lo marca? | Fase 1 solo registra el adeudo como `pendiente`; el owner puede marcarlo `liquidado` o `condonado` con motivo. |
| **P-2** | Si el OIS no está, ¿puede el owner desbloquear la apertura de turno en una emergencia? (S-6 dice que no sustituye al OIS en N1, pero desbloquear no es aprobar.) | Sin desbloqueo en Fase 1; la sucursal espera al OIS. |
| **P-3** | ¿Las métricas de ventas del dashboard de la Fase 2 se muestran al supervisor? | Excluidas hasta confirmar (D-9). |
