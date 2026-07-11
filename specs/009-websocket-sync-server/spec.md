# Feature Specification: WebSocket Sync Server

**Feature Branch**: `009-websocket-sync-server`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Sincronización app Flutter (Cajero · Mesero · Cocina)
Backend: VM dedicada (WebSocket) + Cloud SQL en GCP · 20 sucursales · ~200 operaciones/día · Julio 2026
WebSocket sobre una VM dedicada e2-micro (Compute Engine), corriendo un servidor Node.js liviano. Se prioriza sincronización inmediata (push en vivo a Cocina/Mesero/Cajero)...
Con 200 operaciones/día y 60 dispositivos totales (3 roles × 20 sucursales), un solo e2-micro sostiene sin problema las conexiones WebSocket concurrentes. La cola local offline-first en cada app se mantiene igual que en el diseño de polling..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Real-Time Order Dispatch to Kitchen (Priority: P1)

Como Mesero o Cajero, cuando confirmo un pedido desde mi terminal, el pedido se envía de inmediato al servidor WebSocket y se notifica instantáneamente a la pantalla de la Cocina (KDS) de mi misma sucursal, permitiendo la preparación sin esperas ni demoras de polling.

**Why this priority**: La sincronización inmediata de comandas entre meseros/cajeros y la cocina es el núcleo del flujo de servicio rápido en los restaurantes.

**Independent Test**:
1. Conectar una terminal de Mesero y una de Cocina (KDS) en la sucursal 1 al servidor de sincronización.
2. Registrar un pedido en la terminal de Mesero.
3. Verificar que la pantalla de Cocina muestra el nuevo pedido en menos de 1 segundo sin realizar polling HTTP manual.
4. Verificar que se guarda la comanda en Cloud SQL.

**Acceptance Scenarios**:
1. **Given** el mesero y el cocinero están conectados al WebSocket de la misma sucursal, **When** el mesero envía un nuevo pedido, **Then** la cocina recibe el evento `{ tipo: "cambio", entidad: "orders", ... }` de forma inmediata (< 1s).
2. **Given** el servidor recibe el evento de push, **When** escribe exitosamente en la base de datos, **Then** envía un `ack` al emisor original y emite el broadcast a los demás dispositivos autorizados de la sucursal.

---

### User Story 2 - Offline Continuity & Reconnection Sync (Priority: P2)

Como Mesero, si la conexión wifi de la sucursal falla temporalmente, puedo seguir tomando pedidos localmente. Al recuperarse la red, la aplicación reconecta automáticamente al WebSocket con un mecanismo de reintento exponencial, sincroniza los cambios pendientes localmente y recibe todo lo que ocurrió en la sucursal mientras estuvo desconectado.

**Why this priority**: La resiliencia offline asegura que la operación comercial nunca se detenga por fallas del proveedor de internet local.

**Independent Test**:
1. Desconectar la conexión wifi de la tablet del Mesero.
2. Crear 2 nuevos pedidos offline (se guardan localmente en cola de sincronización con UUID v4 y estado `pending`).
3. En la cocina (conectada), marcar un pedido preexistente como "listo".
4. Reconectar la red en la tablet del Mesero.
5. Verificar que el socket reconecta solo, recupera las actualizaciones del change_log de la cocina desde su última sincronización, y luego empuja los 2 pedidos pendientes de forma idempotente.

**Acceptance Scenarios**:
1. **Given** la tablet está offline, **When** se guarda un pedido, **Then** se encola localmente en la lista de pendientes y la UI responde de inmediato.
2. **Given** la tablet reconecta al socket, **When** inicia el handshake, **Then** primero envía un mensaje de `resync` para jalar las actualizaciones remotas ocurridas desde su último timestamp conocido, y luego envía su cola de pendientes local.

---

### User Story 3 - Production Compatibility & Coexistence (Priority: P3)

Como Operador en una sucursal con dispositivos antiguos o restricciones de red que impiden el uso de WebSocket, el sistema sigue respondiendo a las peticiones REST normales sin ninguna alteración ni interrupción de su flujo operativo actual.

**Why this priority**: El sistema ya está en producción. Cualquier interrupción en las APIs REST actuales (que los dispositivos en producción usan) detendría inmediatamente la operación comercial de las sucursales activas.

**Independent Test**:
1. Con el servidor WebSocket y el nuevo código corriendo en staging/producción, enviar peticiones `POST /sync/push` y `POST /sync/pull` usando el formato DTO existente de la versión anterior.
2. Verificar que el servidor procesa y responde con éxito exactamente de la misma manera que antes.
3. Verificar que las escrituras mediante REST también se propagan al canal de WebSocket (para que las tablets nuevas conectadas por WebSocket reciban los cambios de inmediato).

**Acceptance Scenarios**:
1. **Given** hay dispositivos viejos haciendo polling REST HTTP, **When** envían una orden, **Then** el servidor procesa la orden correctamente mediante la API existente sin romper la compatibilidad, e inserta la entrada en `change_log`.
2. **Given** una orden se recibe mediante la API REST, **When** es procesada, **Then** el servidor también emite el cambio por WebSocket a las tablets nuevas de esa sucursal que estén conectadas por socket.

---

### Edge Cases

- **Reinicio del Servidor VM**: Como solo hay una VM e2-micro (sin redundancia directa), si la VM se reinicia o se cae, todos los sockets se cerrarán de inmediato. Los clientes deben retener su estado local y reintentar con backoff exponencial. Al reconectar, la resincronización por change_log debe evitar pisar cambios remotos más nuevos (Last-Write-Wins robusto).
- **Envío Duplicado (Ack perdido)**: Si el cliente envía un pedido, el servidor lo guarda y manda el ack, pero la red se corta y el cliente no recibe el ack; el cliente lo volverá a mandar al reconectar. El servidor debe detectar el UUID existente e ignorar/confirmar de forma idempotente sin duplicar los items.
- **Change Log Creciente**: Con el tiempo, la tabla de `change_log` crecerá indefinidamente. Se requiere un proceso automático/cron para purgar registros confirmados o antiguos de más de 7 días.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST establish connection via secure WebSockets (`wss://`) using a JWT token in the query/header parameters to validate the device, tenant (business), branch (sucursal), and operator role.
- **FR-002**: System MUST segment all WebSocket traffic by `branchId` (sucursal) so that updates are only broadcast to devices connected within the same branch.
- **FR-003**: System MUST guarantee idempotency using UUID v4 for all transaction and entity writes (orders, items, payments).
- **FR-004**: System MUST record all mutations in a centralized `change_log` table containing: `id`, `entidad`, `entidad_id`, `sucursal_id`, `version_en` (timestamp), and `payload` (JSON).
- **FR-005**: System MUST allow clients to query differences since a specific timestamp using a `resync` payload over WebSocket, and return all updates from the `change_log`.
- **FR-006**: System MUST keep all existing REST endpoints (`POST /sync/push`, `POST /sync/pull`, `POST /sync/ack`) fully backward-compatible and unchanged to prevent breaking production devices.
- **FR-007**: System MUST implement automatic client-side reconnection with exponential backoff (e.g., 1s, 3s, 10s, 15s) and display the connection status ("Conectado", "Reconectando", "Offline (REST)") clearly in the application UI.
- **FR-008**: System MUST perform a clean-up job periodically (cron or background task) to purge entries from the `change_log` older than 7 days.
- **FR-009**: System MUST support roles: `waiter` (mesero), `cashier` (cajero), and `kitchen` (cocina), broadcasting state changes of tables and orders to the correct role terminals.
- **FR-010**: System MUST ensure that any transaction or update processed through the REST API is also written to the `change_log` and broadcast to active WebSocket clients on the target branch.

### Key Entities *(include if feature involves data)*

- **ConnectionState**: Client-side state tracking the active connection channel (WebSocket vs HTTP Fallback, and connection health status).
- **ChangeLog**: Database record of every change made to synchronized entities, used to replay missed updates for reconnecting devices. Contains:
  - `id` (bigserial primary key)
  - `entidad` (text, e.g., 'orders' | 'orderItems' | 'branchTables')
  - `entidad_id` (uuid)
  - `branch_id` (uuid, mapping to sucursal)
  - `version_en` (timestamp with time zone)
  - `payload` (jsonb snapshot of the updated record)
- **SyncQueueItem**: Local client-side model representing a pending operation with a UUID, payload, retry count, and creation timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Real-time broadcast: When a Mesero updates an order state, the kitchen KDS receives the update in less than **800ms** under normal network conditions.
- **SC-002**: Zero duplicates: Replaying a WebSocket push command 5 times due to network packet loss results in exactly 1 write in Cloud SQL.
- **SC-003**: Always Free Tier compliance: The WebSocket sync server must be deployable on an e2-micro instance (1 vCPU, 1 GB RAM, 30 GB HDD) running on GCP, handling up to 60 concurrent socket connections and 200 operations/day at $0/month compute cost.
- **SC-004**: Zero-downtime deployment: The implementation of the WebSocket gateway and database migrations must not disrupt active production REST API clients, showing 100% success rate on REST HTTP clients during and after server rollout.
- **SC-005**: Automatic fallback transition: If a WebSocket connection remains unresponsive for 30 seconds, the client automatically switches to REST polling every 15 seconds, reverting to WebSocket automatically once the socket is reachable again.

## Assumptions

- **Cloud SQL**: The database is already provisioned on Cloud SQL (PostgreSQL), and the VM will connect securely using Cloud SQL Auth Proxy or direct VPC peering.
- **TLS Configuration**: The VM will expose the WebSocket server securely using Let's Encrypt SSL/TLS certificates (wss://).
- **JWT Authentication**: The application will reuse the existing token-based authentication generated during terminal activation.
- **LWW Rule**: Last-Write-Wins will resolve conflicts on identical orders based on the `updatedAt` field.
