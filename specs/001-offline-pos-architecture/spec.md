# Feature Specification: Offline-First POS Architecture

**Feature Branch**: `001-offline-pos-architecture`

**Created**: 2026-05-19

**Status**: Draft

**Input**: User description: "El frontend y la logica local se construiran en Flutter compartiendo codigo para Windows 10 y Android. La base de datos local sera Isar Database guardando transacciones con UUID v4. Las impresoras termicas se controlaran mediante comandos ESC/POS por USB en Windows y Bluetooth/Red en Android. El backend se compondra de AWS Lambda functions conectadas a AWS RDS PostgreSQL mediante AWS RDS Proxy."

## Clarifications

### Session 2026-05-19

- Q: How should POS authentication work when internet is unavailable? -> A: Session and roles are cached locally; offline access requires user PIN/biometric unlock.
- Q: How should payments work while the POS is offline? -> A: Cash is allowed offline; card is manual/external reference or online authorization only.
- Q: How should inventory conflicts from offline sales be handled? -> A: Allow offline sales; create auditable adjustment or conflict if cloud stock is insufficient.
- Q: What should happen when receipt or kitchen printing fails after a local sale is confirmed? -> A: Confirm sale; mark print job failed and allow retry or reprint.
- Q: How should POS devices be identified across offline operation and cloud sync? -> A: Each device registers online once and keeps a persistent local deviceId.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operar POS Sin Internet (Priority: P1)

Como cajero del negocio de comida, puedo registrar una venta localmente en Windows 10 o
Android, guardar sus transacciones con UUID v4 e imprimir el ticket aunque internet este
caido.

**Why this priority**: La continuidad de caja, cocina y atencion al cliente es el objetivo
central de la arquitectura.

**Independent Test**: Deshabilitar internet, registrar una venta con items, pago y ticket;
verificar que la transaccion queda en Isar con UUID v4 y estado pendiente de sincronizacion.

**Acceptance Scenarios**:

1. **Given** el POS esta sin internet, **When** el cajero confirma una venta, **Then** la
   venta queda persistida localmente con UUID v4 y el flujo no espera al backend.
2. **Given** hay una impresora termica configurada, **When** la venta se completa, **Then**
   el sistema genera comandos ESC/POS y envia el ticket por el transporte disponible.

---

### User Story 2 - Sincronizar Al Reconectar (Priority: P2)

Como operador, cuando vuelve internet, las operaciones pendientes se envian al backend y se
consolidan en PostgreSQL sin duplicar ventas ni perder auditoria.

**Why this priority**: La nube debe reflejar lo ocurrido localmente para reportes, respaldo y
operacion multi-dispositivo.

**Independent Test**: Crear ventas offline, restaurar internet y verificar que cada operacion
se envia una sola vez usando claves idempotentes basadas en UUID v4.

**Acceptance Scenarios**:

1. **Given** existen transacciones pendientes en Isar, **When** el dispositivo recupera red,
   **Then** el sincronizador las envia a AWS Lambda y marca cada una como sincronizada solo
   cuando la nube confirma persistencia.
2. **Given** el mismo UUID v4 se reintenta por timeout, **When** Lambda recibe el duplicado,
   **Then** responde de forma idempotente sin crear otra transaccion en PostgreSQL.

---

### User Story 3 - Imprimir En Windows Y Android (Priority: P3)

Como administrador, puedo configurar impresoras termicas para Windows 10 por USB y Android
por Bluetooth o red, usando una capa comun de formato ESC/POS.

**Why this priority**: La impresion de tickets y comandas es parte de la operacion diaria,
pero puede implementarse despues del flujo local y la sincronizacion.

**Independent Test**: Generar el mismo ticket desde una venta local y enviarlo por USB en
Windows, Bluetooth en Android y red en Android, verificando comandos ESC/POS equivalentes.

**Acceptance Scenarios**:

1. **Given** una impresora USB esta configurada en Windows 10, **When** se imprime un ticket,
   **Then** el adaptador USB envia el payload ESC/POS generado por la capa comun.
2. **Given** una impresora Bluetooth o de red esta configurada en Android, **When** se
   imprime una comanda, **Then** el adaptador Android usa el transporte seleccionado sin
   cambiar el formato del ticket.

---

### Edge Cases

- El dispositivo se apaga despues de guardar una venta pero antes de sincronizarla.
- Un dispositivo pierde internet despues del registro inicial y debe seguir operando con su
  deviceId persistente.
- Internet cae entre el cobro y la impresion del ticket.
- El cliente intenta pagar con tarjeta cuando no hay internet ni terminal externa disponible.
- Lambda confirma la recepcion pero el cliente no recibe la respuesta por timeout.
- Dos dispositivos registran movimientos que afectan el mismo inventario mientras estan
  offline.
- Una venta offline usa inventario que otro dispositivo ya consumio antes de la
  sincronizacion.
- La impresora configurada no esta disponible, pierde conexion o rechaza el trabajo.
- Una venta ya confirmada localmente no puede imprimirse por falla de impresora; el sistema
  conserva el PrintJob fallido para reintento o reimpresion.
- PostgreSQL aplica una migracion mientras clientes tienen operaciones pendientes en Isar.
- El UUID v4 ya existe en la nube por reintento o importacion previa.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a shared Flutter codebase for Windows 10 and Android POS
  flows.
- **FR-002**: System MUST persist every local transaction in Isar before reporting success to
  the user.
- **FR-003**: System MUST assign a UUID v4 to each transaction and use it as the idempotency
  key for cloud synchronization.
- **FR-004**: System MUST maintain local sync state for pending, syncing, synced, failed and
  conflict states.
- **FR-005**: System MUST generate ESC/POS command payloads through a shared formatting layer.
- **FR-006**: System MUST support thermal printer transport adapters for USB on Windows 10.
- **FR-007**: System MUST support thermal printer transport adapters for Bluetooth and network
  printing on Android.
- **FR-008**: System MUST expose AWS Lambda APIs for accepting idempotent sync operations.
- **FR-009**: System MUST connect Lambda functions to AWS RDS PostgreSQL through AWS RDS Proxy.
- **FR-010**: System MUST persist cloud transactions in PostgreSQL with uniqueness constraints
  that prevent duplicate UUID v4 transactions.
- **FR-011**: System MUST define offline behavior for every critical POS action in scope.
- **FR-012**: System MUST define synchronization and conflict behavior for data shared with the
  cloud.
- **FR-013**: System MUST log sync attempts, printer failures and cloud acceptance events
  without exposing sensitive payment data.
- **FR-014**: System MUST cache authenticated user sessions and role permissions locally, and
  MUST require PIN or biometric unlock before allowing offline POS actions.
- **FR-015**: System MUST allow cash payments while offline, and MUST treat card payments as
  either manual references from an external terminal or online-authorized payments outside the
  local offline capture path.
- **FR-016**: System MUST allow offline sales even when local stock may be stale, and MUST
  create an auditable inventory adjustment or conflict when synchronized cloud stock is
  insufficient.
- **FR-017**: System MUST NOT roll back a locally confirmed sale when printing fails; it MUST
  mark the related PrintJob as failed and allow retry or reprint with audit linkage to the
  original transaction.
- **FR-018**: System MUST require each POS device to register online once and persist a stable
  local deviceId used for offline transactions, sync operations, audit records and conflict
  resolution.

### Key Entities *(include if feature involves data)*

- **LocalTransaction**: Locally authoritative POS transaction stored in Isar, identified by a
  UUID v4 and tracked through sync states.
- **SyncOperation**: Retryable operation queued locally for cloud delivery and idempotent
  acceptance.
- **PrintJob**: Local print request containing ESC/POS payload, target printer and delivery
  state.
- **PrinterDevice**: Configured thermal printer with platform, transport and capability
  metadata.
- **POSDevice**: Registered physical POS device with a persistent deviceId used across local
  operation and cloud synchronization.
- **CloudTransaction**: PostgreSQL representation of an accepted transaction used for
  consolidation and reporting.
- **ConflictRecord**: Audit record for operations that cannot be reconciled automatically.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A cashier can complete 20 consecutive sales with internet disabled and no cloud
  calls on the critical path.
- **SC-002**: 100% of local transactions receive UUID v4 identifiers before local commit.
- **SC-003**: Replaying the same sync operation at least 10 times results in exactly one
  PostgreSQL transaction.
- **SC-004**: Pending transactions survive app restart and synchronize after reconnecting.
- **SC-005**: The same ticket model produces ESC/POS output for Windows USB and Android
  Bluetooth/network adapters.
- **SC-006**: Lambda database access uses RDS Proxy, not direct per-invocation PostgreSQL
  connection storms.
- **SC-007**: A previously authenticated cashier can unlock the POS while offline using local
  PIN or biometric verification and only access actions allowed by cached role permissions.
- **SC-008**: With internet disabled, a cashier can complete a cash sale locally, while card
  payment entry requires either an external terminal reference or online authorization.
- **SC-009**: When two offline devices sell the same stock, synchronization preserves both
  sales and records an auditable inventory adjustment or conflict instead of silently
  overwriting stock.
- **SC-010**: If the printer is unavailable after a local sale, the sale remains confirmed and
  the failed PrintJob can be retried or reprinted without creating a duplicate transaction.
- **SC-011**: After one successful online device registration, the POS can create offline
  transactions that include the same persistent deviceId across app restarts and sync retries.

## Assumptions

- Users may lose internet during normal restaurant operation.
- This feature defines the architecture baseline and contracts; detailed product catalog,
  taxation and payment-provider rules are handled by later features.
- Flutter targets Windows 10 and Android from a shared domain/application layer, with thin
  platform adapters for printing and permissions.
- The backend implementation will use AWS Lambda behind HTTPS APIs and PostgreSQL in AWS RDS.
- Payment capture can be recorded locally as a transaction outcome; provider-specific online
  authorization is out of scope for this architecture baseline.
