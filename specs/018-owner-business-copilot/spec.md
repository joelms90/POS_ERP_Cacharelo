# Feature Specification: Owner Business Copilot

**Feature Branch**: `feat/owner-business-copilot`  
**Created**: 2026-11-22  
**Status**: In progress

## User Scenarios & Testing

### User Story 1 - Consultar el negocio (Priority: P1)

Como propietario autenticado, puedo abrir Copiloto, elegir una pregunta sugerida o escribir una pregunta para recibir un resumen del negocio con las fuentes y las consultas realizadas.

**Why this priority**: Da valor inmediato sin delegar ninguna modificación operativa a un asistente.

**Independent Test**: Un propietario consulta alertas de inventario y ve respuesta, actividad y enlaces de fuente; una cuenta sin rol propietario no puede usar la capacidad.

**Acceptance Scenarios**:

1. **Given** un propietario con sesión válida, **When** pregunta por alertas de inventario, **Then** recibe una respuesta en español, la actividad de una herramienta permitida y una fuente navegable.
2. **Given** una cuenta que no es propietaria, **When** intenta consultar Copiloto, **Then** no recibe datos ni puede iniciar una conversación.

---

### User Story 2 - Revisar una propuesta antes de actuar (Priority: P2)

Como propietario, puedo revisar una propuesta de acción explícita y confirmar o rechazarla antes de que haya cualquier cambio.

**Why this priority**: Conserva al propietario como autoridad de cada cambio y evita que una conversación ejecute acciones implícitas.

**Independent Test**: Una propuesta no produce cambio sin un token de confirmación vigente, y un token vencido o de otro propietario es rechazado.

**Acceptance Scenarios**:

1. **Given** una solicitud que implica cambio, **When** el propietario no confirma, **Then** el sistema registra solo la propuesta y no ejecuta una escritura.
2. **Given** una propuesta vigente, **When** el propietario la confirma explícitamente, **Then** el sistema registra la decisión y ejecuta únicamente la acción permitida por esa propuesta.

---

### User Story 3 - Auditar el uso (Priority: P3)

Como propietario autorizado, puedo volver a una conversación y comprender qué se preguntó, qué datos se consultaron y cuál fue el resultado de una confirmación, sin que secretos o datos sensibles aparezcan en el historial.

**Why this priority**: Permite supervisión y soporte responsable del asistente.

**Independent Test**: Los registros se correlacionan con propietario, negocio y sucursal cuando aplica; entradas con secretos son redactadas.

## Edge Cases

- Una respuesta que no coincide con una intención segura pide reformular y no ejecuta herramientas.
- Una sesión expirada, token de confirmación vencido o token perteneciente a otro propietario se rechaza sin efecto.
- Un fallo de una herramienta muestra estado legible, registra metadatos seguros y no filtra la respuesta interna.
- Una pregunta duplicada conserva ambas entradas de auditoría con su propia correlación.

## Requirements

### Functional Requirements

- **FR-001**: Solo un propietario autenticado puede leer, iniciar o continuar conversaciones de Copiloto.
- **FR-002**: La pantalla debe mostrar historial, preguntas sugeridas, actividad de herramientas, resultados y enlaces de fuente en español.
- **FR-003**: Las llamadas automáticas solo pueden usar un catálogo tipado y permitido de consultas de negocio de solo lectura.
- **FR-004**: Ninguna escritura puede ocurrir por una solicitud conversacional sin propuesta explícita, token de confirmación de un solo uso y vigencia limitada.
- **FR-005**: Cada conversación, mensaje, ejecución de herramienta y decisión de confirmación debe ser auditable y estar correlacionada al propietario, negocio, sucursal y entidad cuando existan.
- **FR-006**: Los registros y respuestas al navegador deben redactar secretos, credenciales, tokens y valores sensibles definidos por la política.
- **FR-007**: El navegador nunca recibe credenciales administrativas, credenciales MCP, secretos de sesión ni secretos de proveedor de IA.
- **FR-008**: El sistema debe ofrecer un proveedor local determinista para las intenciones de consulta del MVP y documentar la configuración segura de un proveedor de producción.
- **FR-009**: El sistema debe incluir una prueba repetible de selección de herramientas y seguridad de confirmación.

### Key Entities

- **Conversación de Copiloto**: Contexto auditable de una sesión del propietario y su negocio.
- **Mensaje de Copiloto**: Pregunta, respuesta o propuesta redactada dentro de una conversación.
- **Ejecución de herramienta**: Consulta permitida, parámetros redactados, resultado resumido y fuente.
- **Confirmación**: Autorización explícita, limitada en tiempo y de un solo uso para una propuesta de escritura.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Un propietario puede completar una consulta sugerida y encontrar la fuente usada en menos de dos minutos.
- **SC-002**: El 100% de las solicitudes de escritura sin confirmación explícita no cambia datos de negocio.
- **SC-003**: El 100% de los casos de prueba de autorización, lista permitida y redacción pasan antes de entregar el MVP.
- **SC-004**: Los revisores pueden relacionar el 100% de las ejecuciones de prueba con propietario, negocio y conversación sin exponer secretos.

## Assumptions

- El MVP vive en el panel administrativo conectado y no sustituye flujos operativos offline del POS.
- Las acciones de escritura pueden permanecer como propuestas no ejecutables mientras se define su catálogo operativo específico.
- Un proveedor de producción se configura solo en el entorno del servidor mediante Secret Manager; ninguna clave se versiona.
