# 58mm Thermal Printer — Printing Guide

## Overview

This project prints to 58mm (and 80mm) thermal printers using **plain-text, fixed-width monospace formatting**.  
Ticket content is sent as plain ASCII/Latin-1 text. A **paper cut command** (`GS V 0` — `0x1D 0x56 0x00`) is appended at the end of every Bluetooth print job, followed by 3 line feeds to clear the text before the cut.

---

## Character Dimensions

| Paper Width | Columns (chars/line) | PDF Width | PDF Font Size | PDF Margin |
|-------------|---------------------|-----------|---------------|------------|
| **58mm** (default) | **26 cols** | 58.0 mm | 7.5 pt | 4.0 pt |
| **80mm**           | **40 cols** | 80.0 mm | 8.0 pt | 6.0 pt |

Defined in `lib/ui/common/app_state.dart`:

```dart
int get ticketWidth => printerPaperWidth == '80mm' ? 40 : 26;   // line 620
```

The `printerPaperWidth` string (`'58mm'` / `'80mm'`) is persisted to secure storage and set via printer settings dialogs.

---

## Formatting Primitives

All helpers live in `lib/ui/common/app_state.dart` (lines 5129–5193).

### `formatCenter(text, [width])`
Pads text with leading spaces to center it on the line.

```dart
formatCenter("=== TITLE ===")  // → "        === TITLE ===        "  (26 cols)
```

### `formatCenterLines(text, [width])`
Word-wraps text, then centers each resulting line. Useful for multi-line centered blocks (addresses, slogans).

```dart
formatCenterLines("Calle Falsa 123, Col. Centro") 
// → "   Calle Falsa 123,    "
//   "     Col. Centro       "
```

### `formatRow(left, right, [width])`
Left-justifies `left` and right-justifies `right`, padding the middle with spaces.

```dart
formatRow("2x Hamburguesa", "$180.00")  
// → "2x Hamburguesa        $180.00"
```

If the combined text exceeds the column width, truncation prioritizes `left` — it gets clipped first, only preserving enough room for `right` plus one space.

### `formatDivider({char: '-', [width]})`
Fills one line with the given character (default `-`).

```dart
formatDivider()              // → "--------------------------"  (26 dashes)
formatDivider(char: '=')     // → "=========================="
```

### `_wrapText(text, [width])`
Word-wraps a paragraph to fit within the column width, respecting words (not mid-word). Returns `List<String>`.

```dart
_wrapText("Esto es un texto muy largo", 12)
// → ["Esto es un", "texto muy", "largo"]
```

Words longer than the width are force-split character-by-character.

---

## Text Sanitization

The function `_sanitizePdfText()` (line 4433) strips all non-ASCII characters:

1. Replaces accented Spanish characters with ASCII equivalents:

   | From | To | From | To | From | To |
   |------|----|------|----|------|----|
   | `á` | `a` | `é` | `e` | `í` | `i` |
   | `ó` | `o` | `ú` | `u` | `ü` | `u` |
   | `ñ` | `n` | `Á` | `A` | `É` | `E` |
   | `Í` | `I` | `Ó` | `O` | `Ú` | `U` |
   | `Ü` | `U` | `Ñ` | `N` | `¡` | `!` |
   | `¿` | `?` | | | | |

2. Removes any remaining non-ASCII bytes: `replaceAll(RegExp(r'[^\x00-\x7F]'), '')`

This is applied to **all output paths** (Bluetooth and Desktop PDF) to avoid encoding issues. The Bluetooth path uses `latin1.encode()`, which only supports bytes 0–255. The PDF renderer also works best with pure ASCII.

---

## Output Paths

The function `_printToPhysicalPrinter(details)` (line 4487) routes to one of three outputs based on `connectedPrinterMac`:

### Path A — Simulated Printer (`00:11:22:33:44:55`)

```dart
debugPrint('Simulated Printer Print Job:\n$details');
return true;
```

No hardware interaction. Used for development/demo.

### Path B — Desktop System Printer (`'desktop'`)

Called via `_printToDesktopPrinter()` (line 4521):

1. `reformatTicketForWidth(details, currentWidth)` — normalizes ticket formatting
2. `_sanitizePdfText(reformatted)` — strips accents
3. PDF is generated with these specs:
   - Font: **Courier Bold** (monospace)
   - Page width: `58.0 mm` (or `80.0 mm`)
   - Page height: calculated from line count × `fontSize * 1.35` + 16 pt safety buffer, with a floor of **35 mm** (58mm) or **50 mm** (80mm)
   - Horizontal margin: `4.0 pt` (58mm) / `6.0 pt` (80mm)
4. Sent to the printer via `Printing.directPrintPdf()` using the system print dialog's selected printer URL/name.

```dart
// Height calculation (line 4561–4564):
final double lineSpacingPt = fontSize * 1.35;
final double calculatedHeightMm = ((totalVisualLines * lineSpacingPt) + 16.0) * 0.352778;
final double targetHeightMm = max(minHeightMm, calculatedHeightMm);
```

The `+16.0 pt` safety buffer prevents the PDF layout engine from spawning a blank second page.

### Path C — Mobile Bluetooth Thermal Printer

1. Checks/establishes Bluetooth connection via `PrintBluetoothThermal.connect(macPrinterAddress)`
2. Re-formats ticket via `reformatTicketForWidth()`
3. Sanitizes via `_sanitizePdfText()`
4. Encodes as **Latin-1** (`latin1.encode()`) and sends raw bytes, with a **paper cut command** appended:

```dart
final bytes = latin1.encode('${sanitizedDetails.trimRight()}\n\n\n').toList();
bytes.addAll([0x1D, 0x56, 0x00]); // GS V 0 — full paper cut
return await PrintBluetoothThermal.writeBytes(bytes);
```

**ESC/POS Paper Cut Command:** `GS V 0` (`0x1D 0x56 0x00`) — performs a full cut at the current paper position.
- `GS V 1` (`0x1D 0x56 0x01`) would perform a partial cut (leaves one point uncut)
- Three line feeds (`\n\n\n`) precede the cut to ensure text clears the cutter blade

Most Bluetooth thermal printers auto-render ASCII text with line breaks — no ESC/POS formatting codes are required for the ticket content itself.

### Reformatter Logic (`reformatTicketForWidth`, line 4454)

Before sending to the physical printer, the ticket text is re-parsed line-by-line:
- Lines starting with `---` are replaced with `formatDivider()`
- Lines starting with `===` or `***` are re-centered
- Lines starting with known labels (`Fecha:`, `Mesero:`, `Atendió:`, `Estado:`, `Conectado a:`) are reformatted as `formatRow(label, value)`
- All other lines pass through unchanged

This ensures the ticket always fits the current paper width correctly.

---

## Ticket Types

All tickets are plain-text strings built with `StringBuffer` using the formatting primitives.

### 1 — Comanda Cocina (Kitchen Order)
**File:** `app_state.dart` line 2446  
**Target:** `Cocina`  
**Purpose:** Sent when a waiter submits an order with kitchen items (non-`Bebidas`)

```
=== COMANDA COCINA ===
       Mesa 5        
Fecha:           12:30
Mesero:    Juan Perez
--------------------------
2x Hamburguesa
   [Persona 1]
   + sin cebolla
   * Nota: termino medio
1x Refresco Cola
--------------------------
```

### 2 — Comanda Barra (Bar Order)
**File:** `app_state.dart` line 2489  
**Target:** `Barra`  
**Purpose:** Sent when a waiter submits an order with drink items (category `Bebidas`)

```
=== COMANDA BARRA ===
       Mesa 5        
Fecha:           12:30
Mesero:    Juan Perez
--------------------------
2x Margarita
1x Cerveza Corona
--------------------------
```

### 3 — Pre-Cuenta (Pre-Bill)
**File:** `app_state.dart` line 2862 + `payment_flow_dialog.dart` line 43  
**Target:** `Caja`  
**Purpose:** Preliminary bill shown to customers before payment

```
     === PRE-CUENTA ===     
      GRUPO CACHARELO       
           Mesa 5           
Fecha:                12:30 
Atendio:        Juan Perez  
--------------------------
Cant Descripcion        Total
--------------------------
2x Hamburguesa       $180.00 
1x Refresco           $30.00 
==========================
TOTAL:               $210.00 
==========================

   * FAVOR DE PAGAR EN CAJA *   
    GRACIAS POR SU VISITA    
```

### 4 — Comprobante Pago (Payment Receipt — Card)
**File:** `payment_flow_dialog.dart` line 83  
**Target:** `Caja`

```
    === COMPROBANTE PAGO ===     
       GRUPO CACHARELO          
            Mesa 5               
Fecha:                     12:30 
Atendio:             Juan Perez  
---------------------------------
Metodo:                 TARJETA  
Referencia:             1234     
TOTAL PAGADO:          $210.00   
---------------------------------
     GRACIAS POR SU COMPRA      
```

### 5 — Final Customer Ticket
**File:** `app_state.dart` line 2919  
**Target:** `Caja`  
**Purpose:** Full fiscal receipt after checkout (registered for SAT)

Includes:
- Business info header (display name, legal name, RFC, branch, address, phone)
- Operation number (e.g., `CCH-20260808-123015`)
- Itemized products with modifiers and notes
- Subtotal/IVA breakdown (configurable: `breakdown` or `included` modes)
- Discount applied
- Payment method and reference code
- Cash received / change (for cash payments)
- Footer text with IVA disclaimer

### 6 — Split Payment Summary
**File:** `app_state.dart` line 3293  
**Target:** `Caja`

```
   === RESUMEN DE PAGO ===   
       Mesa 5                
Fecha:               12:30   
Atendio:       Juan Perez    
-----------------------------
P1 —  Contribución $105.00   
  Metodo: Tarjeta            
  Ref: 1234                  
P2 —  Contribución $105.00   
  Metodo: Efectivo           
-----------------------------
Total Cobrado:     $210.00   
=============================
```

### 7 — Corte X (Partial Shift Report)
**File:** `shift_control_panel.dart` line 549  
**Target:** `Caja`

Summary of cash flow since the shift opened (does not reset counters).

### 8 — Corte Z (Close Shift)
**File:** `shift_control_panel.dart` line 488  
**Target:** `Caja`

Final shift report that resets daily counters.

---

## Print Job Lifecycle

### Data Structures

```dart
class PrintJob {                     // line 295
  final String id;                   // Unique ID, e.g. "pc_1691234567890"
  final String title;                // Human label, e.g. "Pre-Cuenta - Mesa 5"
  final String details;              // The full ticket string
  final String target;               // "Cocina", "Barra", or "Caja"
  String status;                     // "queued" → "printed" / "failed"
  final DateTime timestamp;
}

enum ComandaPrintMode { none, auto, local, remoteStation }  // line 313
```

### Flow Diagram

```
Ticket Generated (string)
        │
        ▼
PrintJob created
        │
        ▼
┌───────────────────────────────────────────────┐
│ Route Decision:                                │
│  - Comanda → _routeComandaPrintJob()           │
│  - Caja → enqueueCajaPrintJob()                │
│  - Force Physical → enqueuePrintJob()           │
└───────────────────────────────────────────────┘
        │
        ├── Remote Station (if configured)
        │      │
        │      ▼
        │   HTTP POST → /api/print-jobs
        │      │
        │      ▼
        │   Remote device prints locally
        │
        ├── Local Physical (if printer connected)
        │      │
        │      ▼
        │   _printToPhysicalPrinter()
        │      │
        │      ├── Simulated MAC  → debugPrint
        │      ├── Desktop MAC    → PDF → Printing.directPrintPdf()
        │      └── Bluetooth MAC  → PrintBluetoothThermal.writeBytes()
        │
        └── Online (no printer)
               │
               ▼
            Mark as "printed" (server-side record)
```

### Enqueue Functions

| Function | Line | Purpose |
|----------|------|---------|
| `enqueuePrintJob(job, forcePhysical)` | 4616 | Adds job to list, prints if caja + printer connected |
| `enqueueCajaPrintJob(job, …)` | 4123 | Tries remote station first, falls back to `enqueuePrintJob` |
| `enqueueRemotePrintJob(job, stationId)` | 4066 | Sends job to remote station via HTTP POST |
| `_routeComandaPrintJob(job, printMode, …)` | 2557 | Routes kitchen/bar comandas by mode: none/auto/local/remoteStation |

---

## Remote Print Station API

When a remote print station is configured, print jobs are sent via:

```
POST {baseUrl}/print-jobs
Content-Type: application/json
```

The remote station polls this endpoint periodically and prints queued jobs using its own local printer configuration.

---

## Configuration Keys (Secure Storage)

| Key | Value | Default |
|-----|-------|---------|
| `connected_printer_mac` | MAC address, `"desktop"`, or `"00:11:22:33:44:55"` | `null` |
| `connected_printer_name` | Human-readable name | `null` |
| `connected_printer_paper_width` | `"58mm"` or `"80mm"` | `"58mm"` |
| `last_print_station_id` | UUID of last selected remote station | `null` |
| `receive_remote_print_jobs` | `"true"` / `"false"` | `"false"` |

---

## Fiscal/Tax Display

`ticketFiscalConfig.taxMode` controls how IVA (16%) is shown on customer tickets:

- **`breakdown`** — Shows net subtotal, net discount, and IVA as separate line items
- **`included`** — Shows gross subtotal, discount, and "IVA incluido" note

The footer auto-appends `IVA incluido` via `_normalizeTicketFooter()`.

---

## ESC/POS Commands

The printer content uses plain text for all formatting. The only ESC/POS byte-level command used is the **paper cut** at the end of each print job.

### Paper Cut — `GS V` (used)

| Command | Hex | Description |
|---------|-----|-------------|
| `GS V 0` | `1D 56 00` | **Full cut** — cuts paper completely. Currently used. |
| `GS V 1` | `1D 56 01` | **Partial cut** — leaves one point uncut (paper stays attached) |
| `GS V 66 n` | `1D 56 42 n` | Feed `n × 0.125mm` to cut position, then full cut |

Implemented in `_printToPhysicalPrinter()` at `lib/ui/common/app_state.dart:4514`:

```dart
bytes.addAll([0x1D, 0x56, 0x00]); // GS V 0 — full paper cut
```

---

## Dependencies

```yaml
# pubspec.yaml
print_bluetooth_thermal: ^1.0.1   # Mobile Bluetooth thermal printing
printing: ^5.13.0                  # Desktop PDF/system printing
pdf: ^3.10.0                       # PDF generation for desktop prints
```

---

## Platform Notes

- **iOS:** Requires Bluetooth permission in `Info.plist` — "58mm or 80mm thermal printers"
- **Android:** Bluetooth and location permissions required at runtime
- **Desktop (macOS/Windows/Linux):** Uses system print dialog via `printing` package
- **Web:** Not supported for physical printing

---

## Example: Building a Custom Ticket

```dart
String buildMyTicket() {
  final w = ticketWidth; // 26 for 58mm
  final b = StringBuffer();

  b.writeln(formatCenter('=== MY TICKET ==='));
  b.writeln(formatCenter('MY BUSINESS NAME'));
  b.writeln(formatDivider());
  b.writeln(formatRow('Fecha:', DateTime.now().toString().substring(0, 16)));
  b.writeln(formatDivider());
  b.writeln(formatRow('1x Producto A', '\$100.00'));
  b.writeln(formatRow('2x Producto B', '\$200.00'));
  b.writeln(formatDivider(char: '='));
  b.writeln(formatRow('TOTAL:', '\$300.00'));
  b.writeln(formatDivider(char: '='));
  b.writeln(formatCenter('GRACIAS'));

  return b.toString();
}
```

---

## Key Files

| File | Role |
|------|------|
| `lib/ui/common/app_state.dart` | All printing logic, ticket generation, helpers |
| `lib/services/secure_storage_service.dart` | Printer config persistence |
| `lib/ui/widgets/printer_settings_dialog.dart` | Platform printer settings router |
| `lib/ui/widgets/bluetooth_settings_dialog.dart` | Mobile Bluetooth setup |
| `lib/ui/widgets/desktop_printer_settings_dialog.dart` | Desktop printer setup + remote stations |
| `lib/ui/widgets/printer_monitor_panel.dart` | Print job monitor (retry/reprint) |
| `lib/ui/waiter/payment_flow_dialog.dart` | Payment tickets |
| `lib/ui/cashier/shift_control_panel.dart` | Corte X/Z shift reports |
