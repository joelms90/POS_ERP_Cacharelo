# Printer Contract: ESC/POS Output And Transports

## Shared Formatter Input

The Flutter domain layer sends a platform-neutral print request:

```json
{
  "printJobId": "uuid-v4",
  "transactionId": "uuid-v4",
  "jobType": "receipt",
  "paperWidth": "58mm",
  "encoding": "cp437",
  "sections": [
    {"type": "text", "align": "center", "value": "POS-ERP"},
    {"type": "line_items", "items": []},
    {"type": "total", "label": "TOTAL", "amount": 0}
  ],
  "cut": true,
  "openCashDrawer": false
}
```

## Shared Formatter Output

- Output MUST be ESC/POS bytes or a lossless byte representation.
- Output MUST NOT depend on the target transport.
- Output MUST include printer capability checks for paper width, encoding, cutter and cash
  drawer commands.

## Windows 10 USB Adapter

- Accepts ESC/POS bytes from the shared formatter.
- Resolves the target printer from `PrinterDevice.address`.
- Sends bytes over USB using the selected Windows printing or USB access implementation.
- Updates `PrintJob.state` to `printed` only after successful write acknowledgement.

## Android Bluetooth Adapter

- Accepts ESC/POS bytes from the shared formatter.
- Requires paired device metadata and runtime permissions.
- Sends bytes to the selected Bluetooth thermal printer.
- Records adapter errors in `PrintJob.lastError`.

## Android Network Adapter

- Accepts ESC/POS bytes from the shared formatter.
- Uses host and port from `PrinterDevice.address`.
- Sends bytes over TCP socket to network-capable thermal printers.
- Uses retry behavior separate from cloud sync retries.

## Failure Semantics

- Print jobs MUST be durable before adapter I/O.
- Failed print attempts MUST NOT roll back the completed local transaction.
- Reprinting MUST create or reuse a PrintJob linked to the original transaction for audit.
