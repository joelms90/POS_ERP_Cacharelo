# Phase 1 Quickstart: Validation & Testing Guide

This guide helps verify the functionality of the Purchase Orders & Requisitions module across backend APIs, the Admin Portal, and the Flutter POS Client.

---

## 1. Backend API Verification

### 1.1 Purchase Order Workflow

1. **Create a Purchase Order**:
   ```bash
   curl -X POST http://localhost:3000/api/purchase-orders \
     -H "Content-Type: application/json" \
     -d '{
       "businessId": "BUSINESS-UUID",
       "providerId": "PROVIDER-UUID",
       "warehouseId": "WAREHOUSE-UUID",
       "items": [
         { "productId": "PRODUCT-UUID", "quantityOrdered": 100, "unitCostEstimated": 10.50 }
       ],
       "notes": "First PO order",
       "createdBy": "USER-UUID"
     }'
   ```
   *Expected Response*: `201 Created` with the PO ID and details.

2. **Transition status to Sent**:
   ```bash
   curl -X PATCH http://localhost:3000/api/purchase-orders/PO-UUID/status \
     -H "Content-Type: application/json" \
     -d '{ "status": "sent" }'
   ```

### 1.2 Reception & Average Cost Recalculation

1. **Check Current Cost & Stock**:
   Query the product and stock levels before reception:
   ```bash
   curl http://localhost:3000/api/products/PRODUCT-UUID
   ```
   *Note*: Suppose Current Stock = 50 units, Current Cost = $10.00.

2. **Record Reception**:
   Submit PO reception with new costs and quantities:
   ```bash
   curl -X POST http://localhost:3000/api/purchase-orders/PO-UUID/receive \
     -H "Content-Type: application/json" \
     -d '{
       "items": [
         { "productId": "PRODUCT-UUID", "quantityReceived": 50, "unitCostActual": 12.00 }
       ]
     }'
   ```
   *Average Cost Calculation*:
   - Total Cost Before = 50 * $10.00 = $500.00
   - Total Cost Received = 50 * $12.00 = $600.00
   - New Weighted Average Cost = ($500 + $600) / (50 + 50) = $1100 / 100 = $11.00.

3. **Verify Updated Cost**:
   Query the product again. The `cost` field must be updated to `$11.00`.
   Additionally, verify that an inventory movement of type `receipt` with quantity `50` was logged under the warehouse ID.

---

## 2. Requisitions Workflow

### 2.1 Branch Requisition Creation & Status Transitions

1. **Create Requisition**:
   ```bash
   curl -X POST http://localhost:3000/api/requisitions \
     -H "Content-Type: application/json" \
     -d '{
       "businessId": "BUSINESS-UUID",
       "fromBranchId": "BRANCH-UUID",
       "toWarehouseId": "WAREHOUSE-UUID",
       "items": [
         { "productId": "PRODUCT-UUID", "quantityRequested": 20 }
       ],
       "createdBy": "USER-UUID"
     }'
   ```
   *Expected Status*: `pending_approval`.

2. **Approve Requisition**:
   ```bash
   curl -X POST http://localhost:3000/api/requisitions/REQUISITION-UUID/approve \
     -H "Content-Type: application/json" \
     -d '{
       "items": [
         { "productId": "PRODUCT-UUID", "quantityApproved": 20 }
       ]
     }'
   ```
   *Expected Outcome*: Requisition status moves to `approved`, and a pending stock transfer (`stock_transfers`) is automatically created linking from the warehouse to the branch.

---

## 3. Flutter POS Client (Offline Testing)

1. **Disconnect internet connectivity** on the POS terminal device or simulator.
2. **Create a Requisition**: Go to Requisition creation screen, fill out products/quantities, and tap "Enviar".
3. **Verify local cache**: The request should succeed immediately. Verify the status shows "Pendiente de Sincronizar" (Written to Isar database local collections).
4. **Reconnect internet**: Turn on network connectivity.
5. **Verify sync**: The sync worker should automatically fetch the pending `SyncOperation` queue and sync the requisition to the NestJS cloud API.
