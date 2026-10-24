# Phase 1 Data Model: Dedicated Warehouse Operator App

This document details the data structures, local client models, and API payloads consumed and produced by the Flutter Warehouse application (`016-warehouse-purchasing-app`).

---

## 1. Client-Side Models (Flutter)

### 1.1 `WarehousePurchaseOrder`
Represents an incoming Purchase Order emitted by Administration, awaiting physical delivery.

```dart
class WarehousePurchaseOrder {
  final String id;
  final String poNumber; // e.g. "OC-0012"
  final String providerId;
  final String providerName;
  final String status; // 'sent', 'partially_received', 'received'
  final DateTime orderDate;
  final DateTime? expectedDeliveryDate;
  final List<WarehousePOItem> items;
  final String? notes;

  const WarehousePurchaseOrder({
    required this.id,
    required this.poNumber,
    required this.providerId,
    required this.providerName,
    required this.status,
    required this.orderDate,
    this.expectedDeliveryDate,
    required this.items,
    this.notes,
  });
}
```

### 1.2 `WarehousePOItem`
Represents a line item in an incoming Purchase Order with original vs. actual received values.

```dart
class WarehousePOItem {
  final String id;
  final String productId;
  final String productName;
  final String? sku;
  final String? unit; // e.g. 'kg', 'pza', 'caja'
  final double quantityOrdered; // READ-ONLY original value
  final double quantityPreviouslyReceived;
  final double estimatedUnitCost; // READ-ONLY original value
  
  // Editable fields during check-in:
  double quantityReceivedNow;
  double actualUnitCost;
  String? rejectionReason; // Required if quantityReceivedNow < quantityOrdered

  WarehousePOItem({
    required this.id,
    required this.productId,
    required this.productName,
    this.sku,
    this.unit,
    required this.quantityOrdered,
    this.quantityPreviouslyReceived = 0.0,
    required this.estimatedUnitCost,
    double? quantityReceivedNow,
    double? actualUnitCost,
    this.rejectionReason,
  }) : quantityReceivedNow = quantityReceivedNow ?? (quantityOrdered - quantityPreviouslyReceived),
       actualUnitCost = actualUnitCost ?? estimatedUnitCost;
}
```

### 1.3 `WarehouseRequisitionFulfillment`
Represents the picking and dispatch of items requested by a store branch.

```dart
class WarehouseRequisitionFulfillment {
  final String requisitionId;
  final String branchId;
  final String branchName;
  final String status; // 'pending_approval', 'approved', 'standby', 'rejected'
  final DateTime createdAt;
  final String? storeNotes;
  final List<WarehouseRequisitionItemFulfillment> items;

  const WarehouseRequisitionFulfillment({
    required this.requisitionId,
    required this.branchId,
    required this.branchName,
    required this.status,
    required this.createdAt,
    this.storeNotes,
    required this.items,
  });
}

class WarehouseRequisitionItemFulfillment {
  final String productId;
  final String productName;
  final String? unit;
  final double quantityRequested; // READ-ONLY from branch
  final double currentWarehouseStock;
  double quantityToDispatch;

  WarehouseRequisitionItemFulfillment({
    required this.productId,
    required this.productName,
    this.unit,
    required this.quantityRequested,
    required this.currentWarehouseStock,
    double? quantityToDispatch,
  }) : quantityToDispatch = quantityToDispatch ?? quantityRequested;
}
```

---

## 2. API Submission Payloads

### 2.1 PO Reception Payload (`POST /purchase-orders/:id/receive`)
Submitted when the warehouse operator confirms the delivery from the supplier.

```json
{
  "warehouseId": "b1a07384-d113-4a0e-a555-e5b12824bf10",
  "invoiceNumber": "F-89211",
  "items": [
    {
      "productId": "4e5b9f63-1db2-4de4-8d86-1ec8108fdb1a",
      "quantityReceived": 20.0,
      "actualUnitCost": "65.50",
      "rejectionReason": null
    },
    {
      "productId": "ab842bf9-56ba-4cd9-9e07-5fffc47c7da9",
      "quantityReceived": 8.0,
      "actualUnitCost": "120.00",
      "rejectionReason": "2 frascos rotos durante el traslado del proveedor"
    }
  ],
  "receivingNotes": "Entrega recibida en andén 2 completa salvo 2 frascos rotos."
}
```

### 2.2 Requisition Approval & Dispatch Payload (`POST /branch-requisitions/:id/approve`)
Submitted when the operator packs the items and dispatches the stock transfer to the branch.

```json
{
  "warehouseId": "b1a07384-d113-4a0e-a555-e5b12824bf10",
  "dispatchedItems": [
    {
      "productId": "4e5b9f63-1db2-4de4-8d86-1ec8108fdb1a",
      "quantityDispatched": 10.0
    }
  ],
  "dispatchNotes": "Empacado en 2 cajas selladas para sucursal Jáltipan"
}
```

### 2.3 Physical Adjustment Payload (`POST /inventory/adjustments`)
Submitted when conducting cycle counts or registering damaged/expired goods in the bodega.

```json
{
  "warehouseId": "b1a07384-d113-4a0e-a555-e5b12824bf10",
  "productId": "4e5b9f63-1db2-4de4-8d86-1ec8108fdb1a",
  "deltaQuantity": -2.0,
  "reasonCode": "merma",
  "notes": "Costal roto por humedad en estante 3B"
}
```
