# API Contracts: Sync API Admin Endpoints

This document outlines the JSON request/response payloads for the Express backend endpoints consumed by the Tauri Business Control app.

All endpoint paths are relative to the API base URL: `http://localhost:3000/api`.

---

## 1. POST `/auth/admin`

**Purpose**: Verifies the administrator password and returns a token for session authentication.

### Request Payload
```json
{
  "password": "admin123"
}
```

### Response (Success - 200 OK)
```json
{
  "success": true,
  "token": "admin123"
}
```

### Response (Failure - 401 Unauthorized)
```json
{
  "success": false,
  "error": "Contraseña de administrador incorrecta"
}
```

---

## 2. GET `/users`

**Purpose**: Retrieves the list of all registered employees.
**Headers**: `X-Admin-Token: <token>`

### Response (Success - 200 OK)
```json
[
  {
    "id": "e3b0c442-98fc-1c14-9afb-f4c530224153",
    "name": "Juan (Mesero)",
    "pin": "1111",
    "role": "waiter"
  },
  {
    "id": "f5d2c332-90fc-2b14-9dfb-f4c530224159",
    "name": "Sofia (Cajero)",
    "pin": "2222",
    "role": "cashier"
  }
]
```

### Response (Failure - 401 Unauthorized)
```json
{
  "error": "No autorizado. Se requiere contraseña de administrador."
}
```

---

## 3. POST `/users`

**Purpose**: Registers a new employee.
**Headers**: `X-Admin-Token: <token>`

### Request Payload
```json
{
  "name": "Sofía Castro",
  "pin": "4321",
  "role": "cashier"
}
```

### Response (Success - 201 Created)
```json
{
  "success": true,
  "user": {
    "id": "d7d1f9fb-a74c-47bb-a94f-561b369527fe",
    "name": "Sofía Castro",
    "pin": "4321",
    "role": "cashier"
  }
}
```

### Response (Failure - 400 Bad Request)
- Duplicate PIN:
```json
{
  "error": "Este PIN ya está asignado a otro usuario"
}
```
- Missing fields or invalid PIN format:
```json
{
  "error": "El PIN debe ser un número de exactamente 4 dígitos"
}
```

---

## 4. DELETE `/users/:id`

**Purpose**: Deletes (revokes access for) an employee.
**Headers**: `X-Admin-Token: <token>`

### Response (Success - 200 OK)
```json
{
  "success": true,
  "message": "Usuario eliminado correctamente"
}
```

### Response (Failure - 404 Not Found)
```json
{
  "error": "Usuario no encontrado"
}
```

---

## 5. GET `/reports/sales-dashboard`

**Purpose**: Returns reconciled restaurant sales intelligence for the Business Control Reports page.
**Headers**: `Authorization: Bearer <accessToken>` or legacy `X-Admin-Token: <token>`

### Query Parameters

- `businessId` (required): Business UUID.
- `startDate` (optional): ISO timestamp inclusive lower bound.
- `endDate` (optional): ISO timestamp inclusive upper bound.
- `timezone` (optional): IANA timezone used for date buckets. Defaults to `America/Mexico_City`.
- `basis` (optional): Sales accounting basis. Supported values: `payments` (default), `orders`.

### Response Shape (Planned)

```json
{
  "financial": {
    "grossSales": 1000.0,
    "discounts": 50.0,
    "taxes": 131.03,
    "netSales": 950.0,
    "collectedSales": 950.0,
    "ordersCount": 17,
    "paidOrdersCount": 14,
    "itemsCount": 31,
    "averageCheck": 67.86,
    "estimatedCogs": 420.0,
    "contributionMargin": 530.0,
    "contributionMarginPercent": 55.79,
    "paymentMix": [
      {
        "paymentMethod": "cash",
        "total": 650.0,
        "paymentsCount": 10,
        "sharePercent": 68.42
      },
      {
        "paymentMethod": "card",
        "total": 300.0,
        "paymentsCount": 4,
        "sharePercent": 31.58
      }
    ]
  },
  "operations": {
    "hourlySales": [
      {
        "hour": 7,
        "localHourLabel": "07:00",
        "totalSales": 886.0,
        "ordersCount": 14
      }
    ],
    "kitchenSpeed": {
      "averageMinutesToReady": 12.5,
      "ticketsCount": 24
    },
    "pendingDataMetrics": [
      {
        "metric": "RevPASH",
        "missingFields": ["seat capacity", "occupied-seat-hours"]
      }
    ]
  },
  "menu": {
    "topProducts": [
      {
        "id": "product-uuid",
        "name": "Croissant italiano",
        "sku": "CACH-CRO-CROISSANT-ITALIANO-002",
        "quantitySold": 3,
        "grossSales": 323.28,
        "estimatedCogs": 150.0,
        "contributionMargin": 173.28,
        "contributionMarginPercent": 53.6
      }
    ]
  },
  "staff": {
    "topWaiters": [
      {
        "id": "user-uuid",
        "name": "Juan (Mesero)",
        "totalSales": 886.0,
        "ordersCount": 14,
        "averageCheck": 63.29
      }
    ],
    "topCashiers": []
  },
  "inventory": {
    "stockValue": 0.0,
    "lowStockCount": 0,
    "actualVsTheoreticalStatus": "needs_data"
  },
  "reconciliation": {
    "status": "warning",
    "ordersTotal": 886.0,
    "paymentsTotal": 886.0,
    "itemsGrossTotal": 2947.42,
    "exceptionsCount": 3,
    "exceptions": [
      {
        "orderId": "order-uuid",
        "type": "zero_total_with_items",
        "orderTotal": 0.0,
        "paymentTotal": 0.0,
        "itemsGrossTotal": 310.35
      }
    ]
  }
}
```

### Contract Rules

- `financial.collectedSales` MUST equal the sum of `paymentMix.total` within MXN 0.01.
- `salesByBranch` and staff totals, if retained for legacy compatibility, MUST state whether they use `basis=payments` or `basis=orders`.
- Product rows MUST be treated as item velocity and contribution-margin data, not as proof that money was collected.
- Closed orders with missing payments, zero totals, or mismatched payment totals MUST appear in `reconciliation.exceptions`.
- Hour buckets MUST use the requested `timezone`, not the server runtime timezone.
- Unsupported restaurant metrics MUST be returned in `operations.pendingDataMetrics` or equivalent metadata.
