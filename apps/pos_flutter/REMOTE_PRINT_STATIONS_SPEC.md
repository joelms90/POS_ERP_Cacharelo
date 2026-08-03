# Remote Print Stations Implementation Spec

## Objective

Allow a waiter without a local Bluetooth printer to print a comanda on a specific online cashier station/device. Routing must target the device/station, not the cashier role in general.

## Current Code Context

Main files:

- `lib/ui/common/app_state.dart`
  - `submitOrder(...)` creates comanda `PrintJob`s for `Cocina` and `Barra`.
  - `enqueuePrintJob(...)` currently prints locally if the current device has a configured printer.
  - Desktop printer support uses the `printing` package.
  - Mobile printer support uses Bluetooth through `print_bluetooth_thermal`.

- `lib/ui/waiter/cart_sidebar.dart`
  - Confirmation dialog currently has:
    - `ENVIAR E IMPRIMIR COMANDA`
    - `ENVIAR COMANDA (SIN IMPRIMIR)`

- `lib/ui/waiter/waiter_ordering_screen.dart`
  - Calls `state.submitOrder(..., printComanda: shouldPrint)`.

- `lib/ui/common/sync_socket_service.dart`
  - Existing WebSocket sync infrastructure by branch and role.
  - Currently handles order/table/kitchen updates, not print station presence or remote print jobs.

## Core Design

Introduce a print station abstraction.

A print station represents one physical app install/device that can print:

```dart
class PrintStation {
  final String stationId;
  final String deviceName;
  final String? operatorId;
  final String? operatorName;
  final String printerName;
  final UserRole role;
  final DateTime lastSeenAt;
  final bool canPrintComandas;
  final bool online;
}
```

Important: route by `stationId`, not `operatorId`. Operator name is display context only.

## New Print Modes

Replace `bool printComanda` with an explicit mode:

```dart
enum ComandaPrintMode {
  none,
  local,
  remoteStation,
}
```

For remote station mode, pass the selected `targetStationId`.

Suggested signature:

```dart
void submitOrder(
  int tableId,
  List<OrderItem> cartItems,
  int guestsCount,
  List<String> genders, {
  ComandaPrintMode printMode = ComandaPrintMode.none,
  String? targetStationId,
})
```

## Backend/API Requirements

The backend needs support for two concepts.

### 1. Print Station Presence

```json
{
  "stationId": "station-device-uuid",
  "branchId": "branch-id",
  "deviceName": "Caja Principal",
  "role": "cashier",
  "operatorId": "user-id",
  "operatorName": "Carlos",
  "printerName": "EPSON TM-T20",
  "canPrintComandas": true,
  "lastSeenAt": "2026-08-01T00:00:00.000Z"
}
```

Cashier or encargado terminals should heartbeat every 20-30 seconds while:

- logged in
- branch configured
- printer configured
- role can act as print station

### 2. Remote Print Jobs

```json
{
  "id": "print-job-id",
  "branchId": "branch-id",
  "targetStationId": "station-device-uuid",
  "sourceUserId": "waiter-id",
  "sourceUserName": "Mesero",
  "title": "Comanda Cocina - Mesa 4",
  "details": "...formatted ticket text...",
  "target": "Cocina",
  "status": "queued",
  "createdAt": "2026-08-01T00:00:00.000Z"
}
```

Status lifecycle:

- `queued`
- `printing`
- `printed`
- `failed`

## Flutter Implementation Steps

1. Add persistent local station ID in `SecureStorageService`.
   - New key: `local_station_id`.
   - Generate once if missing.
   - Use a stable value across logins on the same device.

2. Add `PrintStation` model and remote print job model.
   - Can live initially in `app_state.dart`.
   - Prefer separate model files if the implementation grows.

3. Add `AppState` fields:

```dart
String? localStationId;
List<PrintStation> onlinePrintStations = [];
String? lastSelectedPrintStationId;
```

4. Add cashier station heartbeat.
   - Start when current role is `cashier` or `encargado`.
   - Only announce if `connectedPrinterName != null`.
   - Stop on logout, disconnect, or printer disconnect.
   - Send through backend REST or WebSocket, depending on backend support.

5. Add waiter station discovery.
   - Fetch/listen to online stations for current branch.
   - Filter:
     - same branch
     - online or recent `lastSeenAt`
     - has printer
     - `canPrintComandas == true`

6. Update waiter confirmation dialog.
   Replace the current binary print choice with:

   - `ENVIAR SIN IMPRIMIR`
   - `IMPRIMIR AQUI` if local printer exists
   - `IMPRIMIR EN CAJA...`

   `IMPRIMIR EN CAJA...` opens a station picker:

```text
Caja Principal
Carlos - EPSON TM-T20

Caja Terraza
Ana - Star TSP100
```

7. Remember last station.
   - Save selected `stationId` in secure storage.
   - Preselect it next time if still online.
   - If unavailable, ask again.

8. Modify comanda printing in `submitOrder`.
   - `none`: create kitchen orders, no print.
   - `local`: current behavior with `enqueuePrintJob(..., forcePhysical: true)`.
   - `remoteStation`: create remote print job addressed to `targetStationId`; do not mark as locally printed.

9. Add cashier remote print consumer.
   - Cashier app listens or polls for remote jobs where:

```dart
job.targetStationId == localStationId
```

   - On receipt:
     - mark `printing`
     - call existing local physical print path
     - mark `printed` or `failed`

10. Extend printer monitor.
    - Show remote jobs relevant to this station.
    - Failed jobs should be retryable from the cashier station.

## UX Rules

- If waiter has no Bluetooth/local printer, default action should guide them to station picker.
- If no stations are online:
  - show `No hay cajas con impresora disponibles`.
  - still allow `Enviar sin imprimir`.
- After remote send:
  - show `Comanda enviada a Caja Principal`.
  - If backend returns failure: `No se pudo enviar a esa estacion`.

## Testing Scope

Add tests for:

- Waiter sends without print: no local or remote print job created.
- Waiter local print: existing physical queue path is used.
- Waiter remote print: remote job includes selected `targetStationId`.
- Last station is persisted and reused only when online.
- Cashier station ignores jobs for other station IDs.
- Cashier station prints matching job and updates status.
- Failed physical print marks remote job as `failed`.

## Implementation Note

Do not fake cross-device printing by saving the cashier printer name on the waiter device. The waiter device cannot print to a USB/system printer attached to the cashier terminal. The correct path is:

1. Waiter creates a remote print job.
2. Cashier station receives the remote print job.
3. Cashier station prints locally.
4. Cashier station updates the job status.
