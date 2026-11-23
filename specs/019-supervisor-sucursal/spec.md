# Feature Specification: Supervisor de Sucursal — Fase 1: Aprobación de Cortes Z e Ingresos/Egresos de caja

**Feature Branch**: `019-supervisor-sucursal`
**Created**: 2026-11-22 · **Updated**: 2026-11-22 (segunda ronda de decisiones del dueño)
**Status**: Propuesta (NO implementado). D-1 a D-11 y P-1 a P-3 resueltos. Supuestos S-1 a S-6 resueltos (decisión final 2026-11-22). Solo quedan C-1 y C-2, consecuencias de S-3, por confirmar (§15.2).
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
   - Si el autor del corte o movimiento es el propio OIS, **el nivel 1 lo hace el supervisor** de esa sucursal (S-3).
   - Los movimientos de caja funcionan como **ledger**: nada se borra; rechazos, cancelaciones y ajustes se corrigen con asientos de reverso (S-4, §4.4).
3. **Bloqueo de apertura**: no se abre el siguiente turno de la sucursal mientras el OIS no haya aprobado el Corte Z anterior (D-4).
4. **Corte Z sin conexión** en el POS Flutter (D-5).
5. **Adeudo formal del cajero** por faltante aprobado (D-8).
6. **Bandejas de aprobación**: Admin web (supervisor y owner, D-10) y POS (OIS), más **notificaciones guardadas y consultables por REST**, con una sección **"Notificaciones"** en el Admin web (https://cacharelo-central.web.app/) que ve el supervisor (D-6).
7. **Visibilidad del supervisor** en sus sucursales asignadas: ve lo que hicieron el cajero y el OIS en caja (cortes, movimientos, bitácora) y **también ve las ventas**, mediante los reportes existentes limitados a sus sucursales (D-9, P-3). Lo que **revisa y aprueba** en Fase 1 es solo caja.
8. **Desbloqueo de emergencia (owner)**: si el OIS no está, el owner puede permitir la apertura del siguiente turno, con motivo y registro en la bitácora (P-2).
9. **Bitácora de auditoría** inmutable: usuario, rol, fecha, motivo, valores antes/después.

### Fuera de alcance de Fase 1 (ver §11)
Umbrales configurables, tratamiento de turnos auto-cerrados >24 h (D-11), notificaciones push al celular (D-6), gestión de cobro de adeudos (P-1), autorización de descuentos/cancelaciones/devoluciones, inventario, requisiciones, arqueos sorpresa, personal.

## 3. Glosario

- **OIS**: Operador Integral de Sucursal = rol `branch_operator` (spec 013).
- **Corte Z**: cierre definitivo de turno con conteo físico. **Corte X**: reporte de turno abierto (sin cambios).
- **Diferencia**: `contado − esperado`, con `esperado = fondo inicial + ventas efectivo + ingresos − egresos` (`ShiftsService.buildShiftReport`). Negativa = faltante.
- **N1**: primer nivel. Lo resuelve el OIS de la sucursal, o el supervisor asignado si el autor es el OIS (S-3). **N2**: segundo nivel, el supervisor asignado o el owner.
- **Asiento / reverso**: cada fila de `cash_transactions` es un asiento inmutable del ledger de caja. Un reverso es un asiento nuevo que compensa a otro (S-4).
- **Administrador** (para aprobar): solo `owner` (S-2).

## 4. Flujos actuales vs propuestos

### 4.1 Corte Z

**Actual**: `open ──Corte Z──▶ closed` (nadie revisa).

**Propuesto**: el ciclo operativo (`status`, sin cambios) se separa del de revisión (`review_status`, nuevo):

```
                Corte Z (en línea u offline → al sincronizar)
                                 │
                                 ▼
        pendiente_n1   N1 = OIS de la sucursal
                       (si el corte lo cerró el OIS → N1 = supervisor asignado, S-3)
        aprueba │             │ rechaza
                │             ▼
                │        rechazado_n1 ── reconteo del cajero/OIS ──▶ pendiente_n1
                ▼
        pendiente_n2   N2 = supervisor asignado u owner (persona distinta de N1, C-1)
        aprueba │    ajusta │      │ rechaza
                ▼           ▼      ▼
            aprobado   aprobado_   rechazado_n2
                       con_ajuste    ├─ nuevo conteo del cajero/OIS ──▶ pendiente_n2   (S-5: directo a N2)
                                     └─ supervisor ajusta ──▶ aprobado_con_ajuste
   (owner) aprobado* ── reabrir ──▶ pendiente_n2
```

Reglas:
- **CZ-01** El Corte Z se hace igual que hoy en la terminal, **también sin conexión** (D-5, ver §9). Al llegar al servidor queda siempre en `pendiente_n1`. Si lo cerró un cajero, lo resuelve el OIS; si lo cerró el OIS, lo resuelve el supervisor asignado (S-3).
- **CZ-02** **N1**: aprueba (→ `pendiente_n2`) o rechaza (→ `rechazado_n1`, motivo obligatorio). Tras el rechazo, el autor del corte (cajero u OIS) registra un **reconteo** y el corte vuelve a `pendiente_n1`.
- **CZ-03** **N2 es obligatorio para todo Corte Z** (S-1). Lo hace un supervisor asignado a la sucursal o el owner (S-2): aprueba (→ `aprobado`), aprueba con ajuste (monto final + motivo → `aprobado_con_ajuste`) o rechaza (→ `rechazado_n2`, motivo obligatorio).
- **CZ-04** **(S-5)** Tras un rechazo de N2, el cajero u OIS registra un nuevo conteo que va **directo a N2** (`pendiente_n2`), **sin volver al OIS**. El supervisor también puede resolver con un ajuste (→ `aprobado_con_ajuste`).
- **CZ-05** Ningún rechazo reabre el turno (el efectivo ya salió y puede haber otro turno abierto). El `close_snapshot` original **nunca se sobrescribe**; los reconteos y ajustes quedan como versiones en la bitácora.
- **CZ-06** Un nivel no puede aprobar un corte mientras haya movimientos del mismo turno pendientes de N1 o N2.
- **CZ-07** Nadie aprueba su propio corte (`closed_by == actor` → 403). Esto extiende BR-ROLE-003. Propuesta C-1: **N1 y N2 deben ser personas distintas**. En un corte del OIS donde el supervisor hizo N1, el N2 lo hace el owner u otro supervisor asignado.
- **CZ-08** **Sin sustitución (S-6)**: ni el supervisor ni el owner aprueban N1 en lugar del OIS cuando el autor es un cajero; solo actúan después, en N2. **Única excepción (S-3)**: si el autor es el OIS, el N1 lo hace el supervisor asignado (el owner no). Desbloquear la apertura (CZ-10b) **no** es aprobar.
- **CZ-09** Concurrencia: cada acción exige la `version` vigente; si otra persona actuó antes, el servidor responde 409.
- **CZ-10** **Bloqueo de apertura (D-4)**: no se puede abrir un turno nuevo en la sucursal mientras su último Corte Z esté en `pendiente_n1` o `rechazado_n1`. Cuando N1 lo aprueba, la sucursal puede abrir aunque N2 no esté resuelto. Consecuencia de S-3 (C-2, por confirmar): un corte cerrado por el OIS bloquea hasta que **el supervisor** apruebe su N1; si el supervisor no está disponible, aplica el desbloqueo del owner (CZ-10b).
- **CZ-10b** **Desbloqueo de emergencia (P-2)**: si la sucursal está bloqueada y quien debe resolver N1 no está disponible, el **owner** puede desbloquear la apertura con un motivo obligatorio. El corte anterior **sigue** en `pendiente_n1` (N1 lo resolverá después); solo se permite abrir el turno nuevo. Queda en la bitácora (`apertura_desbloqueada`) y genera una notificación al supervisor de la sucursal.
- **CZ-11** Al quedar **aprobado** o **aprobado con ajuste** con diferencia final negativa, se genera un **adeudo** a nombre del cajero del turno (§4.3).
- **CZ-12** Los turnos históricos y los auto-cerrados por el sistema (>24 h) quedan `no_aplica` y no entran al flujo ni bloquean (D-11; ver R-7).

### 4.2 Ingresos y egresos de caja

**Actual**: `POST transactions` se aplica al cajón, sin actor ni aprobación.

**Propuesto**: cada movimiento es un **asiento** de un ledger de caja que solo admite inserciones. **Cuenta en caja desde que se registra**; nada se borra ni se edita, y toda corrección es un **asiento de reverso** (S-4). La aprobación es **solo de N1**, el OIS (S-1). El supervisor **no** aprueba movimientos uno por uno: los revisa dentro del Corte Z del turno (N2), donde puede cancelarlos o ajustarlos con asiento compensatorio:

```
registrado  → asiento original (cuenta en caja)
   ▼
pendiente_n1   N1 = OIS  (si el autor es el OIS → N1 = supervisor asignado, S-3)
   ├─ aprueba ─▶ aprobado   (final; sin N2, S-1)
   └─ rechaza ─▶ rechazado  + asiento de reverso (neto 0)

Mientras el Corte Z del turno no esté aprobado, el supervisor o el owner pueden:
   cancelar ─▶ cancelado  + asiento de reverso (neto 0)
   ajustar  ─▶ ajustado   + reverso del original + asiento nuevo con el monto correcto
```

Reglas:
- **MV-01** Todo movimiento guarda `created_by`, categoría estructurada, motivo y `client_uuid` (idempotencia).
- **MV-02** Categorías iniciales = las de Flutter. Ingresos: `aporte_cambio`, `reposicion_fondo`, `correccion`, `otro_ingreso`. Egresos: `gasto_operativo`, `entrega_encargado`, `transferencia_caja`, `correccion`, `otro_egreso`.
- **MV-03** **Ledger (S-4)**: el movimiento cuenta en el efectivo esperado desde que se registra. Rechazar o cancelar no borra nada: se inserta un **reverso** que lo compensa. Si el dinero sí salió del cajón, el reverso hace que aparezca como **faltante** en el corte, lo que puede terminar en adeudo (§4.4.3).
- **MV-04** **Cancelar y ajustar** son acciones exclusivas del supervisor (sus sucursales) y del owner. Requieren motivo y se permiten hasta que el Corte Z del turno quede aprobado. Cancelar = reverso. Ajustar = reverso del original + asiento nuevo con el monto correcto. Cajero y OIS no cancelan ni editan; para corregir registran un movimiento de categoría `correccion`.
- **MV-05** Un egreso **nuevo** que deje el esperado en negativo se rechaza en el servidor (hoy solo Flutter lo recorta a 0). Los **reversos** nunca se bloquean, aunque dejen el esperado en negativo (p. ej. reverso de un ingreso); ese caso se reporta como `REQUIRES_RECONCILIATION` (§4.4.5).
- **MV-06** Nadie aprueba su propio movimiento; por eso el N1 de los movimientos del OIS lo hace el supervisor (S-3).
- **MV-07** Los movimientos se ven con su estado en el detalle del Corte Z (CZ-06). Ahí el supervisor los revisa en N2 y, antes de aprobar el corte, puede cancelarlos o ajustarlos (MV-04).

### 4.3 Adeudo del cajero (D-8)

- **AD-01** Al aprobarse en N2 un Corte Z con diferencia final negativa (calculada del `approval_snapshot`, es decir, con los reversos incluidos, §4.4.3), el sistema crea un adeudo con: cajero del turno, sucursal, turno, monto = |diferencia final|, fecha y aprobador.
- **AD-02** Si después el owner reabre el corte, el adeudo se anula y se vuelve a generar con la nueva aprobación. Todo queda en la bitácora.
- **AD-03** El adeudo se puede consultar en el Admin web (supervisor: sus sucursales; owner: todo) y el cajero ve los suyos en el POS.
- **AD-04** Los sobrantes no generan adeudo; quedan registrados en el corte.
- **AD-05** **El adeudo solo se registra y audita (P-1)**: el sistema no gestiona su cobro ni su liquidación (nómina, pago, condonación). Estados posibles: `vigente` y `anulado` (por reapertura del corte). Cada alta y cada anulación quedan en la bitácora.

### 4.4 Ledger de caja y efecto en reportes (S-4)

Análisis hecho sobre el código actual:

- `ShiftsService.createTransaction` / `buildShiftReport` / `closeShift`.
- `ReportsService.getCashShiftAuditReport`, `getCashShiftsList`, `getSalesDashboard`, `getPaymentMethodsSalesReport`.
- `reconcileCash` en `ReportsPage.tsx:285`.
- `stock_ledger` / `ledger.service.ts` como patrón de ledger: delta con signo, `event_type`, `reference_type/id`, sin updates.

#### 4.4.1 Modelo

- `cash_transactions` pasa a ser un **ledger append-only**:
  - Las columnas financieras (`shift_id`, `type`, `amount`, `entry_kind`, `reverses_transaction_id`, `created_at`) son inmutables; un trigger impide `UPDATE` de esas columnas y cualquier `DELETE`.
  - Solo cambian las columnas de flujo (`approval_status`, revisores), y cada cambio queda en `audit_log`.
- `entry_kind`:
  - `movimiento`: el asiento original.
  - `reverso`: compensa a `reverses_transaction_id`.
  - `ajuste`: el asiento nuevo con el monto corregido, enlazado al original con `replaces_transaction_id`.
- Columna generada `cash_effect` con el signo ya aplicado, igual que `stock_ledger.quantity_delta`:
  - `+amount` para `cash-in` y `−amount` para `cash-out`;
  - invertido si es `reverso`.
- **Esperado = fondo inicial + ventas en efectivo + Σ `cash_effect` del turno.** Un movimiento rechazado o cancelado suma 0 en neto (original + reverso). Un ajustado suma el monto nuevo.
- `cash_shifts.cash_drawer_amount` hoy es un acumulado mutable que además `closeShift` sobrescribe con el contado (`shifts.service.ts:188`). **Deja de usarse como esperado**: el esperado siempre se calcula del ledger, y la columna queda solo como "contado" por compatibilidad (R-15).

#### 4.4.2 ¿Con qué fecha se registra el reverso?

**Recomendación: con la fecha real del rechazo o cancelación, sin retrofechar, pero atribuido al turno del movimiento original.**

- `created_at` del reverso = momento en que se decidió. El ledger nunca se reescribe y la bitácora sabe cuándo y quién corrigió.
- `shift_id` del reverso = **turno del original**. Todos los reportes **por turno** (Corte X/Z, diferencias, adeudos, KPIs de caja) lo cuentan en ese turno.
- Un futuro reporte **por fecha** (flujo de efectivo del día) usa `created_at` y muestra el reverso el día en que ocurrió.
- Es el mismo criterio de `stock_ledger`: un ajuste de inventario lleva su propia fecha y referencia al documento original.
- **Retrofechar** al día del original se descarta: cambiaría en silencio reportes ya consultados y rompería la inmutabilidad.

#### 4.4.3 ¿Se recalcula un corte ya cerrado o se muestra el ajuste aparte?

**Recomendación: nunca se recalcula ni sobrescribe el `close_snapshot`. Los reversos posteriores al cierre se muestran aparte, y la cifra oficial se congela al aprobar.**

| Momento del reverso | Qué pasa |
|---|---|
| Turno abierto | Entra al mismo turno; el Corte X lo refleja de inmediato. |
| Corte Z hecho, aún sin aprobación final (`pendiente_n1/n2`, `rechazado_*`) | El detalle muestra **"Esperado al cierre"** (snapshot) + **"Ajustes posteriores al cierre"** (asientos del turno con `created_at > closed_at`) = **"Esperado ajustado"**, y la **diferencia ajustada** = contado − esperado ajustado. N1 y N2 deciden sobre los valores ajustados. |
| Aprobación final (N2) | Se guarda un `approval_snapshot` congelado (esperado ajustado, contado aceptado, diferencia final y lista de asientos) junto con `approved_difference`. El adeudo (D-8) se calcula de aquí. |
| Corte ya aprobado | **No se aceptan más reversos** en ese turno (MV-04). Para corregirlo, el owner lo reabre: hace los reversos, se vuelve a aprobar con un `approval_snapshot` nuevo, y el adeudo anterior se anula y se regenera. Todo queda en la bitácora. |

**Efecto clave para el dueño.** Ejemplo:

- Fondo $1,000, ventas en efectivo $5,000, egreso "gasto operativo" de $800. Esperado al cierre: $5,200. El cajero cuenta $5,200, así que la diferencia es $0.
- El supervisor **rechaza** el egreso después del cierre. Se inserta un reverso de +$800 y el esperado ajustado sube a $6,000.
- La diferencia ajustada queda en **−$800 (faltante)**. Si se aprueba así, se genera un **adeudo de $800** al cajero.

Al revés, rechazar un **ingreso** baja el esperado y aparece un **sobrante**. Es el comportamiento correcto ("ese dinero no estaba justificado"), pero conviene que el dueño lo sepa antes de usar el rechazo.

#### 4.4.4 ¿Cómo se distinguen pendientes, aprobados y revertidos?

Todos los reportes de caja muestran los movimientos del turno en cuatro grupos, con su neto:

| Grupo | Incluye | Efecto en el esperado |
|---|---|---|
| **Aprobados** | `aprobado`, `aprobado_historico` | Cuentan |
| **Pendientes de aprobación** | `pendiente_n1`, `pendiente_n2` | **Cuentan** (S-4), marcados "por aprobar" |
| **Revertidos** | `rechazado`, `cancelado`: original + reverso juntos | Neto 0 |
| **Ajustados** | original + reverso + asiento de ajuste | Cuenta el monto nuevo |

Totales: ingresos brutos, egresos brutos, reversos, **neto** (lo que entra al esperado) y **monto pendiente** (para saber qué parte del esperado aún no está validada).

#### 4.4.5 Efecto en cada reporte

| Reporte | Hoy (código) | Efecto del ledger | Recomendación |
|---|---|---|---|
| **Ventas del día / dashboard / métodos de pago / ventas por producto** | `getSalesDashboard`, `getPaymentMethodsSalesReport`, `getProductSalesReport` leen solo `payments` + `orders`; no tocan `cash_transactions`. | **Ninguno**: los ingresos/egresos no son ventas. | Sin cambios. |
| **Resumen de Sucursal** (spec 015) | Ventas desde `payments`; efectivo/esperado desde el reporte del turno. | Las ventas no cambian. El efectivo esperado pasa a ser el neto del ledger. | Mostrar "esperado (incluye $X pendientes de aprobación)" y el contador de pendientes. |
| **Corte X** | `getCorteReport('x')` → `buildShiftReport` suma todos los `cash-in`/`cash-out`. | Debe sumar `cash_effect` (incluye reversos). | Usar los 4 grupos de §4.4.4. |
| **Corte Z al cerrar** | `closeShift` guarda `close_snapshot`. | El snapshot congela los asientos y estados al cierre. | Agregar al snapshot los grupos y el monto pendiente. |
| **Corte Z ya cerrado** | `getCashShiftAuditReport` devuelve el `close_snapshot` tal cual. | Los reversos posteriores no aparecerían. | Devolver `closeSnapshot` + `postCloseEntries` + `adjustedExpected` + `adjustedDifference`. Si está aprobado, devolver `approvalSnapshot` como cifra oficial. |
| **`reconcileCash`** (`ReportsPage.tsx:285`, cliente) | Clasifica en BALANCED / SURPLUS / SHORTAGE / `REQUIRES_RECONCILIATION` (esperado < 0) usando el esperado del snapshot vs `cashDrawerAmount`. | Si sigue usando el snapshot, ignora los reversos. Un reverso de ingreso puede dejar el esperado < 0. | Calcular el estado **en el backend** sobre el esperado ajustado (o aprobado) y devolver `reconciliationStatus`, para que Admin, POS y CSV coincidan. Mantener `REQUIRES_RECONCILIATION`, ahora alcanzable por reversos. |
| **Lista de cortes** (`getCashShiftsList`) | Sin estado de revisión. | — | Agregar `reviewStatus`, `approvedDifference` y la bandera "tiene ajustes posteriores al cierre". |
| **Diferencias de caja** | Del snapshot. | Cambian si hay reversos posteriores. | **Oficial** = `approved_difference` (solo cortes aprobados). Los no aprobados se muestran como "diferencia provisional". |
| **Adeudos (D-8)** | — | — | Solo desde `approval_snapshot`. |
| **KPIs (Fase 4)** | — | — | Diferencias y adeudos por **fecha del turno** usando cifras aprobadas. Incidencias = número y monto de reversos por motivo y por cajero. Extra: tiempo hasta la aprobación. |

Datos históricos: las filas existentes quedan `entry_kind = movimiento` y `aprobado_historico`, sin reversos, así que todos los reportes pasados dan exactamente lo mismo.

## 5. Umbrales configurables — fase futura

Sin umbrales en Fase 1 (D-3). Para el futuro, sin montos definidos: auto-aprobación de cortes con diferencia pequeña, autorización previa de movimientos por monto o categoría, PIN del supervisor en la terminal, límite de reconteos, SLA de pendientes, y política por negocio con override por sucursal.

## 6. Bitácora de auditoría

Tabla append-only `audit_log` con `business_id`, `branch_id`, `entity_type` (`cash_shift`, `cash_transaction`, `cashier_debt`, `supervisor_assignment`), `entity_id`, `action`, `approval_level` (`n1`, `n2`, `owner`), `actor_id`, `actor_role`, `reason`, `before`, `after`, `source` (`admin_web`, `pos`, `system`), `device_id` y `created_at` (servidor).

Acciones: `corte_z_cerrado`, `corte_z_aprobado`, `corte_z_rechazado`, `corte_z_reconteo`, `corte_z_ajustado`, `corte_z_reabierto`, `movimiento_creado`, `movimiento_aprobado`, `movimiento_rechazado`, `movimiento_cancelado`, `movimiento_ajustado`, `adeudo_generado`, `adeudo_anulado`, `apertura_bloqueada`, `apertura_desbloqueada`, `asignacion_actualizada`.

- **AU-01** Solo inserción: sin `UPDATE`/`DELETE` (revocar privilegios o usar un trigger).
- **AU-02** Se escribe en la misma transacción que el cambio de estado.
- **AU-03** El motivo es obligatorio en: rechazar, ajustar, cancelar, reabrir y desbloquear apertura.
- **AU-04** Consultable por el supervisor (sus sucursales) y el owner. Filtros: sucursal, entidad, actor (cajero/OIS), acción y fechas. Exportable a CSV.
- **AU-05** "Eliminar registros financieros" no existe para ningún rol.

## 7. Matriz de permisos (Fase 1)

✅ permitido · 🔸 solo su sucursal/su caja · 🔹 solo sucursales asignadas · ❌ no

| Acción | Cajero | OIS (`branch_operator`) | Supervisor (`branch_supervisor`) | Owner |
|---|---|---|---|---|
| Abrir turno / Corte X / Corte Z de su caja (también offline) | 🔸 | 🔸 | ❌ | ✅ |
| Registrar ingreso/egreso en su turno | 🔸 | 🔸 | ❌ | ✅ |
| Registrar reconteo tras rechazo de N1 | 🔸 (su turno) | 🔸 (su propio corte) | ❌ | ❌ |
| Registrar reconteo tras rechazo de N2 (va directo a N2, S-5) | 🔸 (su turno) | 🔸 (su sucursal) | ❌ | ❌ |
| N1: aprobar/rechazar Corte Z **de un cajero** | ❌ | 🔸 | ❌ (S-6) | ❌ (S-6) |
| N1: aprobar/rechazar movimiento **de un cajero** | ❌ | 🔸 | ❌ (S-6) | ❌ (S-6) |
| N1: aprobar/rechazar Corte Z o movimiento **del OIS** (S-3) | ❌ | ❌ (propio) | 🔹 | ❌ |
| N2: aprobar/rechazar/ajustar Corte Z | ❌ | ❌ | 🔹 (no si hizo N1, C-1) | ✅ (S-2: único admin) |
| Cancelar o ajustar un movimiento con asiento de reverso (antes de aprobar el corte) | ❌ | ❌ | 🔹 | ✅ |
| Reabrir un Corte Z aprobado | ❌ | ❌ | ❌ | ✅ con motivo |
| Desbloquear apertura de turno en emergencia (P-2) | ❌ | ❌ | ❌ | ✅ con motivo |
| Ver cortes, movimientos y bitácora de caja de cajeros y OIS | 🔸 (los suyos) | 🔸 | 🔹 | ✅ |
| Ver ventas (reportes) | — | (como hoy) | 🔹 (D-9, P-3) | ✅ |
| Ver notificaciones | 🔸 (las suyas) | 🔸 (las suyas) | 🔹 (sección en el Admin web) | ✅ |
| Ver adeudos | 🔸 (los suyos) | ❌ | 🔹 | ✅ |
| Asignar supervisores a sucursales | ❌ | ❌ | ❌ | ✅ |
| Crear sucursales / modificar permisos de administradores | ❌ | ❌ | ❌ | ✅ |
| Eliminar registros financieros | ❌ | ❌ | ❌ | ❌ |

Lo que el supervisor **aprueba** en Fase 1 es **solo caja**; las ventas solo las **consulta** (D-9, P-3).

Para fases siguientes (tabla del brief):
- Autorizar descuentos, cancelaciones/devoluciones y ajustes de inventario: ✅🔹 (Fase 3).
- Primer visto bueno de requisiciones: ✅🔹 (Fase 3).
- Ventas de sus sucursales: ✅🔹 (consulta desde Fase 1; dashboard con ventas en Fase 2).
- Crear sucursales, modificar permisos de administradores y eliminar registros financieros: ❌.

## 8. Notificaciones (D-6: persistentes, consultables por REST)

No hay push en Fase 1. El servidor **guarda** cada notificación en la tabla `notifications` y los clientes las **consultan** por REST:

- `GET /notifications`, con filtros: no leídas, sucursal, tipo y fechas.
- `GET /notifications/unread-count`.
- `POST /notifications/:id/read` y `POST /notifications/read-all`.

| Evento | Destinatarios |
|---|---|
| Corte Z o movimiento en `pendiente_n1` | Quien resuelve N1: el OIS de la sucursal, o los supervisores asignados si el autor es el OIS (S-3) (**requiere acción**) |
| Corte Z en `pendiente_n2` | Supervisores asignados y owner (**requiere acción**) |
| Aprobado / rechazado / cancelado / ajustado | Cajero autor; supervisores asignados (informativa) |
| Apertura de turno bloqueada | OIS de la sucursal; supervisores asignados y owner |
| Apertura desbloqueada por el owner | OIS y supervisores asignados |
| Adeudo generado o anulado | Cajero; supervisores asignados y owner |

Dónde se ven:

- **Admin web**: nueva sección **"Notificaciones"** en https://cacharelo-central.web.app/, con campana y contador de no leídas en el layout (polling cada 60 s). El supervisor ve las de sus sucursales y el owner, todas. Cada notificación enlaza al corte o movimiento correspondiente. Las que requieren acción se resaltan.
- **POS Flutter**: el OIS y el cajero consultan el mismo endpoint (contador en la pestaña Caja, polling cuando hay conexión).
- **Tiempo real (opcional)**: los eventos WebSocket existentes (`approval_requested` / `approval_resolved`, cuarto por sucursal) solo sirven para refrescar más rápido. La fuente de verdad es la API REST.

Push al celular queda como mejora futura (R-12).

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
- **FR-003** Todo Corte Z MUST pasar por N1 (OIS, o el supervisor si el autor es el OIS) y N2 (supervisor u owner). Tras un rechazo de N2, el reconteo MUST volver directo a N2 (S-5).
- **FR-004** Todo ingreso/egreso MUST registrarse como asiento inmutable que cuenta en caja desde su registro, y MUST ser aprobado solo en N1 (OIS, o el supervisor si su autor es el OIS); no tiene N2 (S-1). El supervisor lo revisa dentro del Corte Z. Rechazos, cancelaciones y ajustes MUST generar asientos de reverso, nunca borrar ni editar.
- **FR-015** Los reportes de caja MUST distinguir montos pendientes, aprobados, revertidos y ajustados, y MUST mostrar los ajustes posteriores al cierre aparte del `close_snapshot`.
- **FR-005** El supervisor y el owner MUST poder cancelar o ajustar movimientos, con motivo, hasta que se apruebe el corte.
- **FR-006** El sistema MUST impedir abrir un turno nuevo mientras el último Corte Z de la sucursal esté pendiente o rechazado en N1.
- **FR-007** El POS MUST permitir el Corte Z sin conexión y sincronizarlo después, con recálculo en el servidor.
- **FR-008** El sistema MUST generar un adeudo al cajero cuando N2 apruebe un corte con faltante.
- **FR-009** El sistema MUST generar notificaciones persistentes, consultables por REST, para quien deba aprobar y para quien sea afectado por la decisión, y el Admin web MUST mostrarlas en una sección "Notificaciones" para el supervisor y el owner.
- **FR-010** El supervisor MUST ver cortes, movimientos y bitácora de caja de cajeros y OIS de sus sucursales, y las ventas de esas sucursales; MUST NOT ver otras sucursales.
- **FR-014** El owner MUST poder desbloquear la apertura de turno de una sucursal con motivo, sin aprobar el corte pendiente.
- **FR-011** El sistema MUST impedir la auto-aprobación y que el supervisor u owner actúen en N1, también vía peticiones directas.
- **FR-012** Toda transición MUST escribir en `audit_log` en la misma transacción, con nivel, antes y después.
- **FR-013** Las autorizaciones MUST validarse en el servidor (BR-ROLE-004).

## 11. Fases posteriores

| Fase | Contenido |
|---|---|
| **2 — Dashboard de supervisión** | Sucursales abiertas X/Y, diferencias de caja acumuladas, pendientes por sucursal, "N sucursales requieren revisión". **Incluye las métricas de ventas** del brief (ventas totales, ventas por sucursal), limitadas a sus sucursales (P-3). Push al celular (D-6) como mejora opcional. |
| **2b — Umbrales y auto-cierre** | Umbrales (§5); turnos auto-cerrados >24 h (R-7). |
| **3 — Autorizaciones operativas** | Descuentos, cancelaciones/devoluciones, ajustes de inventario, primer visto bueno de requisiciones, sobre la misma cadena y la misma bitácora. |
| **4 — KPIs del supervisor** | Diferencias de caja, adeudos, movimientos rechazados/cancelados por cajero, merma, cancelaciones/devoluciones, disponibilidad de productos, productividad, cumplimiento operativo. |
| **5 — Operación de campo** | Arqueo sorpresa, checklists de visita, asistencia. |

## 12. Criterios de éxito

- **SC-001** 100 % de los Cortes Z posteriores al despliegue (no auto-cerrados) tienen `review_status` distinto de `no_aplica`.
- **SC-002** 0 movimientos sin `created_by`.
- **SC-003** Las peticiones HTTP directas para auto-aprobar, para que el supervisor actúe en N1 o para aprobar N2 antes de N1 devuelven 403/409.
- **SC-004** Abrir un turno con el último corte en `pendiente_n1` devuelve 409 con un mensaje claro.
- **SC-005** Un Corte Z hecho offline se sincroniza sin duplicarse y con el esperado recalculado.
- **SC-006** Cada transición tiene exactamente un evento en `audit_log`.
- **SC-007** Un corte aprobado con faltante genera exactamente un adeudo.
- **SC-008** El supervisor solo ve datos (caja, ventas, notificaciones) de sus sucursales asignadas.
- **SC-009** Toda notificación generada se puede consultar por `GET /notifications` y aparece en la sección del Admin web.
- **SC-011** La suma de `cash_effect` de un turno con movimientos rechazados o cancelados es igual a la de un turno sin esos movimientos; ningún `DELETE` ni `UPDATE` de columnas financieras tiene éxito en `cash_transactions`.
- **SC-010** Un desbloqueo de emergencia permite abrir el turno sin cambiar el estado del corte pendiente y deja un evento en la bitácora.

## 13. Riesgos

| # | Riesgo | Evidencia | Mitigación |
|---|---|---|---|
| R-1 | **Endpoints de reportes sin guard** | `reports.controller.ts`: `cash-shifts`, `sales/payment-methods`, `sales/products`, `inventory/existence` e `inventory/kardex` no tienen `@UseGuards` (no hay guard global). | Corregir antes de Fase 1. Al proteger los endpoints, el alcance del supervisor se limita a sus sucursales asignadas (también en ventas, P-3). |
| R-2 | Agregar el supervisor a `ADMIN_ROLES` le daría todas las sucursales | `reports.service.ts:613`, `users.service.ts` | Nuevo grupo `SUPERVISION_ROLES` + `supervisor_branch_assignments`. |
| R-3 | `RolesGuard` deja pasar siempre a `owner` | `roles.guard.ts` | Las reglas de nivel (S-6: owner no actúa en N1) van en el servicio, no en el guard. |
| R-4 | Admin web decide pestañas por `user.role` | `App.tsx` | Usar la unión de `user.roles`. |
| R-5 | Movimientos sin idempotencia ni actor | `cash_transactions` | `client_uuid`, `created_by`. |
| R-6 | Egresos dejan el cajón negativo en el servidor | `ShiftsService.createTransaction` | MV-05. |
| R-7 | **Auto-cierre >24 h sin conteo (fuera de Fase 1, D-11)** | `openShift` cierra sin conteo; `cash_drawer_amount` no incluye ventas en efectivo, así que el reporte muestra un faltante falso ≈ ventas en efectivo. | Fase 2b. En Fase 1 quedan `no_aplica`, no bloquean y **no generan adeudo** (evita cobrarle al cajero un faltante falso). |
| R-8 | **Sucursal bloqueada sin poder abrir caja (D-4)** | Si el OIS no está o no tiene conexión, nadie más puede hacer N1 (S-6). | Notificación al OIS (§8), mensaje claro en el POS y **desbloqueo de emergencia del owner** (CZ-10b, P-2). |
| R-9 | Corte Z offline con esperado distinto al del servidor | OF-02 | Recalcular en el servidor, mostrar ambos valores y respetar el orden de sincronización (OF-03). |
| R-10 | **Adeudo generado por error** (ventas no sincronizadas, auto-cierre, ajuste posterior) | AD-01 | Solo se genera tras N2; se anula si el owner reabre; los auto-cerrados se excluyen. |
| R-11 | Carga operativa: cada movimiento y cada corte requieren aprobación | D-3 | Medir el volumen; los umbrales son la palanca futura. |
| R-12 | **Notificaciones solo por consulta (sin push)** | D-6: notificaciones por REST. Ni `pubspec.yaml` ni `package.json` tienen Firebase Messaging, así que no se agrega esa dependencia. | El aviso depende de que el usuario abra la app: contador con polling (60 s) en el Admin web y en la pestaña Caja del POS. Push queda como mejora futura. |
| R-15 | **`cash_drawer_amount` con doble significado** | Hoy es el acumulado del cajón (`createTransaction`) y al cerrar se sobrescribe con el contado (`shifts.service.ts:188`); los reportes lo leen como "contado". | El esperado siempre se calcula del ledger; la columna solo significa "contado" tras el cierre. |
| R-16 | **Rechazar después del cierre genera faltante/adeudo** | §4.4.3 | Mostrar en la UI, antes de confirmar el rechazo, el impacto ("esto generará un faltante de $X"). |
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
| **D-6** | ¿Canal de aviso fuera de la bandeja? | ✅ RESUELTA (actualizada) | **Notificaciones persistentes consultables por REST**, visibles para el supervisor y en una sección "Notificaciones" del Admin web. **Sin push** en Fase 1 (§8). |
| **D-7** | ¿PIN del supervisor en la terminal? | Pospuesta | Fase futura (§5). |
| **D-8** | ¿Faltante como adeudo del cajero? | ✅ RESUELTA | **Sí**, adeudo formal (§4.3). |
| **D-9** | ¿Supervisor ve ventas? | ✅ RESUELTA (actualizada por P-3) | **Sí**, ve las ventas de sus sucursales (reportes en Fase 1, dashboard en Fase 2). También ve lo que hicieron el cajero y el OIS en caja. Lo que revisa y aprueba es **solo caja**. |
| **D-10** | ¿Admins aprueban desde el Admin web? | ✅ RESUELTA | Sí; la bandeja del Admin web está en Fase 1 (admin = owner, S-2). |
| **D-11** | ¿Auto-cierre >24 h en Fase 1? | ✅ RESUELTA | No por ahora (R-7). |

### 15.2 Supuestos (decisión final, 2026-11-22)

| # | Pregunta | Estado | Resolución |
|---|---|---|---|
| **S-1** | ¿N2 obligatorio también para ingresos/egresos? | ✅ RESUELTA (opción B) | **N2 solo para el Corte Z.** Los ingresos/egresos los aprueba solo el OIS (N1). El supervisor los revisa dentro del Corte Z del turno y puede cancelarlos o ajustarlos con asiento compensatorio en el ledger. |
| **S-2** | ¿Qué administradores aprueban? | ✅ RESUELTA | **Solo `owner`.** `inventory_admin` y `support_tech` no aprueban. |
| **S-3** | ¿Quién hace N1 cuando el autor es el OIS? | ✅ RESUELTA (actualizada) | **El supervisor asignado a esa sucursal** hace el N1 (antes decía "directo a N2"). Aplica a cortes y movimientos. |
| **S-4** | ¿El movimiento cuenta desde que se registra? | ✅ RESUELTA | **Sí, como ledger**: nada se borra; los rechazos, cancelaciones y ajustes se corrigen con asientos de reverso. Reverso con fecha real y atribuido al turno original; el `close_snapshot` no se recalcula, los ajustes se muestran aparte y la cifra oficial se congela al aprobar (§4.4). |
| **S-5** | ¿Por dónde pasa el reconteo tras un rechazo de N2? | ✅ RESUELTA (opción 2) | **Directo a N2** (`pendiente_n2`, antes llamado `pendiente_supervisor`), sin volver al OIS. El supervisor también puede ajustar. |
| **S-6** | ¿Supervisor/owner sustituyen al OIS en N1? | ✅ RESUELTA | **No.** Única excepción: S-3 (si el autor es el OIS, el N1 lo hace el supervisor). |

**Consecuencias de S-3 por confirmar** (propuestas, no reglas del dueño):

> Implementación (2026-11-22): C-1 y C-2 están implementadas con las propuestas por defecto como constantes en `apps/sync_api/src/modules/supervision/cash-approval.config.ts` (`n2MustDifferFromN1`, `oisCloseBlocksOpeningUntilN1`). Siguen **por confirmar** por el dueño; cambiarlas no requiere migración.

| # | Punto | Propuesta |
|---|---|---|
| **C-1** | En un corte del OIS, el supervisor hace N1. ¿Puede la misma persona hacer también N2? | **No**: N1 y N2 deben ser personas distintas. El N2 lo hace el owner u otro supervisor asignado a la sucursal. |
| **C-2** | Con D-4, un corte del OIS bloquea la apertura hasta su N1, que ahora hace el supervisor (puede estar en otra sucursal). | Se aplica igual: bloquea hasta que el supervisor apruebe el N1, con el desbloqueo de emergencia del owner (CZ-10b) como salida. Alternativa: que los cortes del OIS no bloqueen. |

### 15.3 Detalles (3.ª ronda)

| # | Pregunta | Estado | Resolución |
|---|---|---|---|
| **P-1** | ¿Cómo se liquida un adeudo? | ✅ RESUELTA | **Solo se audita.** El adeudo se registra y queda en la bitácora; el sistema no gestiona su cobro (AD-05). |
| **P-2** | ¿El owner puede desbloquear la apertura en emergencia? | ✅ RESUELTA | **Sí**, con motivo obligatorio y sin aprobar el corte (CZ-10b). |
| **P-3** | ¿El supervisor ve ventas? | ✅ RESUELTA | **Sí**, las de sus sucursales asignadas (D-9 actualizada). |

No quedan decisiones abiertas para Fase 1.
