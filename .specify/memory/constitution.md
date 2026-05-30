<!--
Sync Impact Report
Version change: template -> 1.0.0
Modified principles:
- Template principle 1 -> I. Operacion Offline-First No Negociable
- Template principle 2 -> II. Estado Local Autoritativo en Flutter + Isar
- Template principle 3 -> III. Sincronizacion Distribuida y Reconciliable
- Template principle 4 -> IV. Nube como Coordinador, No Punto Unico de Falla
- Template principle 5 -> V. Evidencia Operativa, Pruebas y Recuperacion
Added sections:
- Arquitectura y Restricciones Tecnicas
- Flujo de Desarrollo y Puertas de Calidad
Removed sections:
- None
Templates requiring updates:
- updated .specify/templates/plan-template.md
- updated .specify/templates/spec-template.md
- updated .specify/templates/tasks-template.md
- reviewed .specify/extensions/git/commands/*.md (no changes required)
- reviewed AGENTS.md (no changes required)
Follow-up TODOs:
- None
-->
# POS-ERP Constitution

## Core Principles

### I. Operacion Offline-First No Negociable
El sistema MUST permitir vender, cobrar, imprimir o registrar comandas, mover inventario y
cerrar turnos localmente aunque no exista internet. Ninguna ruta critica del negocio de
comida (Cafeteria, Hamburguesas y Empanadas) MUST NOT depender de una llamada de red para
continuar. Cuando un servicio remoto no este disponible, la aplicacion MUST degradar a modo
local con estado visible para el usuario y sin bloquear la operacion.

Rationale: una caida de internet no debe detener caja, cocina ni atencion al cliente.

### II. Estado Local Autoritativo en Flutter + Isar
La aplicacion Flutter MUST persistir sus entidades operativas en Isar Database antes de
considerar completada cualquier accion del usuario. Las pantallas MUST leer desde el estado
local y no directamente desde la nube para flujos criticos. Cada entidad sincronizable MUST
tener identificador estable, version local, marca temporal, estado de sincronizacion y datos
suficientes para reintentar sin perder contexto.

Rationale: el dispositivo local es la fuente inmediata de continuidad operativa durante el
turno.

### III. Sincronizacion Distribuida y Reconciliable
Todo cambio que deba llegar a la nube MUST registrarse como operacion sincronizable,
idempotente y reintentable. Los planes MUST definir direccion de sincronizacion, reglas de
conflicto, ordenamiento, deduplicacion y comportamiento ante reintentos parciales. Los
conflictos que afecten dinero, inventario, pedidos o cierres MUST conservar auditoria y
preferir resolucion explicita antes que sobrescritura silenciosa.

Rationale: multiples dispositivos pueden operar desconectados y luego converger sin perder
ventas ni duplicar movimientos.

### IV. Nube como Coordinador, No Punto Unico de Falla
AWS Lambda y Postgres MUST actuar como capa de coordinacion, consolidacion, reportes,
respaldo y sincronizacion entre dispositivos, no como requisito para completar una venta
local. Las APIs cloud MUST aceptar operaciones idempotentes, validar contratos de datos,
mantener trazabilidad y responder de forma compatible con reintentos. Cambios de esquema
Postgres MUST incluir estrategia de migracion compatible con clientes Flutter que aun tengan
datos pendientes en Isar.

Rationale: la nube aumenta consistencia global, pero no puede ser el interruptor de
continuidad del restaurante.

### V. Evidencia Operativa, Pruebas y Recuperacion
Cada feature que toque ventas, pagos, pedidos, inventario, sincronizacion o cierres MUST
incluir pruebas de modo offline, reconexion, reintentos e idempotencia. Los errores de
sincronizacion MUST quedar observables para soporte sin exponer datos sensibles. El sistema
MUST ofrecer rutas de recuperacion para colas detenidas, conflictos y operaciones pendientes
antes de promover cambios a produccion.

Rationale: offline-first solo es confiable si se prueba, se observa y se puede reparar durante
la operacion real.

## Arquitectura y Restricciones Tecnicas

- Cliente principal: Flutter para las interfaces de punto de venta y operacion.
- Base local: Isar Database para datos operativos, colas de sincronizacion y cache
  autoritativo de flujos criticos.
- Nube: AWS Lambda para APIs y procesos de sincronizacion; Postgres para consolidacion,
  reportes, auditoria y estado compartido entre dispositivos.
- Los modelos compartidos MUST documentar equivalencias entre entidades Isar, payloads API y
  tablas Postgres cuando participen en sincronizacion.
- Las operaciones monetarias MUST registrar importes, moneda, metodo de pago, origen,
  identificador local y estado de sincronizacion de forma auditable.
- Las decisiones de consistencia MUST distinguir entre datos criticos (ventas, pagos,
  inventario, cierres) y datos informativos (catalogos, preferencias, reportes).
- Las features nuevas MUST NOT asumir conectividad estable como condicion normal de uso.

## Flujo de Desarrollo y Puertas de Calidad

- Cada especificacion MUST incluir escenarios de perdida de conectividad, operacion local y
  reconciliacion si toca flujos operativos.
- Cada plan MUST pasar el Constitution Check antes de investigar o disenar: rutas criticas
  offline, persistencia Isar, contrato de sincronizacion, compatibilidad Lambda/Postgres,
  observabilidad y pruebas.
- Cada lista de tareas MUST separar trabajo de modelo local, cola/sincronizacion, API cloud,
  migraciones Postgres, pruebas offline y pruebas de reconexion cuando aplique.
- Los cambios de contratos o esquemas sincronizados MUST incluir migracion y compatibilidad
  hacia atras para clientes con operaciones pendientes.
- Las revisiones MUST bloquear cambios que introduzcan dependencia de red en ventas, pagos,
  pedidos, inventario o cierres sin una excepcion documentada y aprobada.

## Governance

Esta constitucion supersede practicas, planes o decisiones tecnicas que contradigan la
continuidad offline-first del negocio. Las excepciones MUST documentarse en el plan de la
feature con impacto operativo, alternativa evaluada, mitigacion y aprobacion explicita del
responsable tecnico.

Las enmiendas MUST incluir razon, impacto en plantillas, impacto en features activas y plan
de migracion si cambian contratos, modelos o reglas de sincronizacion. Versionado semantico:
MAJOR para redefinir o eliminar principios, MINOR para agregar principios o expandir
obligaciones, PATCH para aclaraciones sin cambio normativo. La revision de cumplimiento es
obligatoria en cada plan, cada PR relevante y antes de liberar cambios que afecten operacion
en restaurante.

**Version**: 1.0.0 | **Ratified**: 2026-05-19 | **Last Amended**: 2026-05-19
