# 🖨️ Thermal Receipt Printing Architecture & Knowledge Base

**Document Version**: 1.0.0  
**Target Module**: `apps/pos_flutter/` (`AppState`, `DesktopPrinterSettingsDialog`, `BluetoothSettingsDialog`)  

---

## 1. Overview & Supported Paper Profiles

The POS system supports two primary physical thermal paper profiles:

| Profile Key | Paper Width | Character Capacity | Font Size | Page Format Engine | Primary Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`58mm`** (Default) | 58 mm (2 in) | **26 columns** | **7.5 pt** Courier Bold | **`PdfPageFormat.roll57`** (Native continuous roll) | Small bluetooth & USB 2-inch thermal printers (POS-58) |
| **`80mm`** | 80 mm (3 in) | **40 columns** | **8.0 pt** Courier Bold | **`PdfPageFormat.roll80`** (Native continuous roll) | Heavy-duty desktop 3-inch thermal printers with auto-cutter (POS-80) |

---

## 2. Thermal Printer Hardware Specifications & Mathematical Formulas

### A. 58mm Paper Profile (`printerPaperWidth == '58mm'`)
* **Total Paper Width**: 58.0 mm (164.4 pt).
* **Page Format**: **`PdfPageFormat.roll57`** (Native continuous roll defined in `package:pdf/pdf.dart`).
* **Margins**: Standard `roll57` margins (`5.0 mm` / `14.17 pt` left and right) ➔ **133.2 pt printable width**.
* **Character Math**:
  * Font: `pw.Font.courierBold()` at `fontSize: 7.5 pt`.
  * Single character width: `0.6 × 7.5 pt` = **4.5 points**.
  * Line width for **26 columns**: `26 × 4.5 pt` = **117.0 points**.
  * Safety buffer: `133.2 pt − 117.0 pt` = **16.2 points (~5.7 mm)** margin buffer.
* **Overflow-Proof Height Formula**:
  $$\text{targetHeightMm} = \max\left(\text{minHeightMm},\ \left((\text{totalVisualLines} \times (\text{fontSize} \times 1.35)) + 16.0\right) \times 0.352778\right)$$
  * **Line Spacing Factor (`1.35`)**: Accounts for full Courier font ascent/descent metrics and line height.
  * **Safety Buffer (`+16.0 pt`)**: Ensures text inside `pw.Page` never overflows Page 1. Eliminates blank Page 2 creation.
  * **Zero Vertical Margin (`vertical: 0.0`)**: Prevents canvas clipping inside the single page frame.

---

### B. 80mm Paper Profile (`printerPaperWidth == '80mm'`)
* **Total Paper Width**: 80.0 mm (226.8 pt).
* **Page Format**: **`PdfPageFormat.roll80`** (Native continuous roll defined in `package:pdf/pdf.dart`).
* **Margins**: Standard `roll80` margins (`5.0 mm` / `14.17 pt` left and right) ➔ **198.4 pt printable width**.
* **Character Math**:
  * Font: `pw.Font.courierBold()` at `fontSize: 8.0 pt`.
  * Single character width: `0.6 × 8.0 pt` = **4.8 points**.
  * Line width for **40 columns**: `40 × 4.8 pt` = **192.0 points**.
  * Safety buffer: `198.4 pt − 192.0 pt` = **6.4 points (~2.2 mm)** margin buffer.
* **Line Wrapping Result**:
  * **192.0 pt < 198.4 pt** ➔ All 40 dashes (`----------------------------------------`) fit on **1 single line** with zero line wrapping!

---

## 3. Core Thermal Printing Rules & Safeguards

### Rule 1: Text Sanitization (`_sanitizePdfText`)
PDF Type1 fonts (`pw.Font.courierBold()`) in Flutter `pdf` only support standard ASCII (0..127). Passing non-ASCII characters (`á`, `é`, `í`, `ó`, `ú`, `ñ`, `¡`, `¿`) causes an unhandled `Font Courier-Bold has no unicode support` exception, resulting in blank pages.

```dart
String _sanitizePdfText(String text) {
  return text
      .replaceAll('á', 'a').replaceAll('Á', 'A')
      .replaceAll('é', 'e').replaceAll('É', 'E')
      .replaceAll('í', 'i').replaceAll('Í', 'I')
      .replaceAll('ó', 'o').replaceAll('Ó', 'O')
      .replaceAll('ú', 'u').replaceAll('Ú', 'U')
      .replaceAll('ñ', 'n').replaceAll('Ñ', 'N')
      .replaceAll('¡', '!').replaceAll('¿', '?');
}
```

### Rule 2: Automatic Re-formatting for Remote Print Stations (`reformatTicketForWidth`)
When a waiter tablet sends a comanda over WebSocket pub/sub, the comanda is formatted for default width (32 cols). Upon receiving the print job, the Cajero station dynamically executes `reformatTicketForWidth(details, targetWidth)`:
* Re-aligns dividers (`----------------`) to match `targetWidth` (`26` cols for 58mm, `40` cols for 80mm).
* Re-centers headers (`formatCenter()`) according to the active printer paper profile.

### Rule 3: Autocut Hardware Thresholds on 80mm Printers
80mm thermal printers with automatic paper cutters (POS-80, Epson, Xprinter drivers) **reject PDF page format heights under 50mm (2 inches)**.
* **Never** pass custom micro heights (`PdfPageFormat(80.0*mm, 18.0*mm)`) to 80mm printers.
* **Always** use **`PdfPageFormat.roll80`** for 80mm paper to communicate natively with Windows/CUPS print spooler drivers.

### Rule 4: Table Label Formatting (Paper Saving)
To avoid redundant `Mesa: Mesa 1` row duplication on receipts and pre-cuentas:
```dart
final mesaClean = table.label.startsWith('Mesa ')
    ? table.label.substring(5)
    : table.label;
buffer.writeln(formatRow('Mesa:', mesaClean)); // Outputs 'Mesa: 1'
```

### Rule 5: Multi-Station UI Isolation
In printer settings dialogs (`DesktopPrinterSettingsDialog` & `BluetoothSettingsDialog`):
* Remote print station lists MUST filter out `localStationId` (`where((s) => s.stationId != widget.state.localStationId)`).
* Modal containers use `SingleChildScrollView` so all controls remain scrollable on all viewports.

---

## 4. Quick Troubleshooting Matrix

| Symptom | Primary Cause | Resolution |
| :--- | :--- | :--- |
| **Blank ticket printed** | Non-ASCII character (`á`, `ñ`) broke Type1 Courier font compilation. | Verify `_sanitizePdfText()` is wrapping the details before rendering. |
| **80mm printer feeds short blank snippet & autocuts** | Custom page height (< 50mm) rejected by Windows POS-80 driver. | Use **`PdfPageFormat.roll80`** for 80mm paper. |
| **Dividers wrap (e.g. 34 dashes on line 1, 8 on line 2)** | `fontSize` too large for column width inside page margins. | Set `ticketWidth = 40` and `fontSize = 8.0pt` for 80mm `roll80`. |
| **Excess blank paper tail feed** | Unnecessary vertical padding buffer or unstripped trailing newlines. | Use `.trimRight()` on text buffer and set padding buffer to `+6.0 pt`. |
| **Cajero sees own station under Remote Stations** | Missing `localStationId` filter in station list. | Apply `.where((s) => s.stationId != localStationId)`. |

---

## 5. File Location Reference

* **Main App State & PDF Printer Logic**: [`apps/pos_flutter/lib/ui/common/app_state.dart`](file:///Users/joelmorales/web/POS-ERP/apps/pos_flutter/lib/ui/common/app_state.dart#L3968-L4055)
* **Desktop Printer Modal**: [`apps/pos_flutter/lib/ui/widgets/desktop_printer_settings_dialog.dart`](file:///Users/joelmorales/web/POS-ERP/apps/pos_flutter/lib/ui/widgets/desktop_printer_settings_dialog.dart)
* **Bluetooth Printer Modal**: [`apps/pos_flutter/lib/ui/widgets/bluetooth_settings_dialog.dart`](file:///Users/joelmorales/web/POS-ERP/apps/pos_flutter/lib/ui/widgets/bluetooth_settings_dialog.dart)
