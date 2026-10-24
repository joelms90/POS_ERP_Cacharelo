# Quickstart Guide: Testing the Warehouse Operator App

This guide walks through testing the dedicated **Warehouse Operator App (`WarehouseDashboardScreen`)** in Flutter.

---

## 1. Prerequisites & Operator Credentials

Ensure the local or remote backend API is accessible:
- Production Backend: `https://pos-sync-api-232144991863.us-central1.run.app/api`
- Or local development backend: `http://localhost:3000/api`

### Operator User
Ensure an operator exists with the role `warehouse_purchasing_operator` associated with your business and warehouse.

---

## 2. Launching the Flutter Client

Run Flutter on macOS desktop, Web, or Android tablet:

```bash
cd apps/pos_flutter
flutter run -d macos --dart-define=API_URL=https://pos-sync-api-232144991863.us-central1.run.app/api
```

---

## 3. Operational Walkthrough

### Step 1: Login & Workspace Verification
1. On the Login screen, enter the PIN for the Warehouse Operator.
2. The application routes automatically to **`WarehouseDashboardScreen`**.
3. **Verify Segregation of Duties**:
   - Confirm there are **no dining tables, no waiter order carts, no cash drawer, and no corte X/Z**.
   - Confirm there is **no button to create or edit original Purchase Orders**.

### Step 2: Receiving Goods from a Supplier (Entrada a Bodega)
1. Tap the **📥 Entradas** tab.
2. Select an incoming Purchase Order in status `Enviada` (e.g. `OC-0015`).
3. Tap **Recibir Mercancía**.
4. The check-in modal shows ordered items with default counts:
   - For complete deliveries: Enter invoice/remisión folio and tap **Confirmar Entrada**.
   - For partial/damaged items: Tap the item, adjust actual received units with the keypad, and select a reason (e.g. `Empaque roto`).
5. Tap **Confirmar Entrada**.
6. Verify:
   - The stock increases in the bodega.
   - The PO status updates to `received` or `partially_received`.

### Step 3: Fulfilling Branch Requests (Salida a Sucursales)
1. Tap the **📤 Salidas** tab.
2. Review pending requisitions from retail branches (e.g. *Cafetería Jáltipan*).
3. Tap **Surtir Pedido**:
   - Review requested items alongside current bodega stock.
   - Tap **Despachar Traspaso**.
4. Verify:
   - Bodega stock decrements immediately.
   - The transfer is marked as `in_transit`.

### Step 4: Warehouse Stock Audit & Barcode Lookup
1. Tap the **📦 Inventario en Bodega** tab.
2. Scan a product barcode or type its SKU.
3. Verify on-hand stock matches the physical bin.
4. Tap **Ajustar Stock** to record a justified variance (e.g. `-1` due to `Rotura`).

### Step 5: Turno & Movement History
1. Tap the **📜 Historial** tab.
2. Verify that today's receipts from suppliers and dispatches to branches appear chronologically with timestamps and operator notes.
