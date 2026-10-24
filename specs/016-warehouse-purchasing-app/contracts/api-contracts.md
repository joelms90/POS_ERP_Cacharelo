# API Contracts: Dedicated Warehouse Operator App

This document details the REST endpoints consumed by the Flutter Warehouse application (`016-warehouse-purchasing-app`).

---

## 1. Purchase Orders (Recepciones de Proveedor)

### 1.1 List Open POs for Warehouse
```http
GET /purchase-orders?businessId={businessId}&status=sent,partially_received&warehouseId={warehouseId}
Authorization: Bearer <token>
```
**Response (200 OK)**:
```json
[
  {
    "id": "9a12cdea-8951-46d9-837a-9a4ace3b25ba",
    "poNumber": "OC-0015",
    "providerId": "provider-uuid",
    "providerName": "Distribuidora Lácteos del Sur",
    "status": "sent",
    "orderDate": "2026-10-24T10:00:00.000Z",
    "expectedDeliveryDate": "2026-10-24T18:00:00.000Z",
    "items": [
      {
        "id": "item-1",
        "productId": "prod-1",
        "productName": "Leche Entera 1L",
        "sku": "LEC-ENT-1L",
        "unit": "pza",
        "quantityOrdered": 40.0,
        "quantityReceived": 0.0,
        "unitCostEstimated": "22.50"
      }
    ]
  }
]
```

### 1.2 Receive Delivery
```http
POST /purchase-orders/{id}/receive
Authorization: Bearer <token>
Content-Type: application/json

{
  "warehouseId": "warehouse-uuid",
  "invoiceNumber": "REM-4521",
  "items": [
    {
      "productId": "prod-1",
      "quantityReceived": 40.0,
      "actualUnitCost": "22.50",
      "rejectionReason": null
    }
  ],
  "receivingNotes": "Recibido en buen estado"
}
```
**Response (200 OK)**:
```json
{
  "success": true,
  "poStatus": "received",
  "updatedProducts": [
    {
      "productId": "prod-1",
      "newStock": 140.0,
      "newAverageCost": "22.50"
    }
  ]
}
```

---

## 2. Branch Requisitions (Surtido a Sucursales)

### 2.1 List Pending Branch Requisitions
```http
GET /branch-requisitions?businessId={businessId}&status=pending_approval,standby&warehouseId={warehouseId}
Authorization: Bearer <token>
```
**Response (200 OK)**:
```json
[
  {
    "id": "req-uuid-1",
    "fromBranchId": "branch-jaltipan-uuid",
    "fromBranchName": "Cafetería Jáltipan",
    "status": "pending_approval",
    "createdAt": "2026-10-24T11:15:00.000Z",
    "notes": "Urgente para turno vespertino",
    "items": [
      {
        "productId": "prod-1",
        "productName": "Leche Entera 1L",
        "quantityRequested": 12.0
      }
    ]
  }
]
```

### 2.2 Approve & Dispatch Requisition
```http
POST /branch-requisitions/{id}/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "warehouseId": "warehouse-uuid",
  "dispatchedItems": [
    {
      "productId": "prod-1",
      "quantityDispatched": 12.0
    }
  ],
  "dispatchNotes": "Despachado en camioneta de reparto #1"
}
```
**Response (200 OK)**:
```json
{
  "success": true,
  "transferId": "transfer-uuid-1",
  "status": "in_transit"
}
```

---

## 3. Warehouse Stock & Adjustments

### 3.1 Fetch Bodega On-Hand Stock
```http
GET /inventory/warehouse-stock?warehouseId={warehouseId}
Authorization: Bearer <token>
```
**Response (200 OK)**:
```json
[
  {
    "productId": "prod-1",
    "productName": "Leche Entera 1L",
    "sku": "LEC-ENT-1L",
    "barcode": "7501000123456",
    "unit": "pza",
    "currentStock": 128.0,
    "averageCost": "22.50"
  }
]
```

### 3.2 Adjust Bodega Stock
```http
POST /inventory/adjustments
Authorization: Bearer <token>
Content-Type: application/json

{
  "warehouseId": "warehouse-uuid",
  "productId": "prod-1",
  "deltaQuantity": -1.0,
  "reasonCode": "rotura",
  "notes": "Envase dañado por caída en estantería"
}
```
**Response (200 OK)**:
```json
{
  "success": true,
  "newStock": 127.0
}
```
