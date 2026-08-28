---
type: operational-guide
title: Flujo Completo — Orden de Compra → Recepción → Incremento de Inventario
description: Cómo se genera una Orden de Compra (OC) en Cacharelo y en qué punto exacto el inventario aumenta, con los pasos de UI.
tags: [purchase-orders, recepcion, inventario, stock-ledger, oc]
---

# Flujo Completo: OC → Recepción → Incremento de Inventario

## Regla de oro

> Una Orden de Compra **por sí sola NO incrementa inventario**.
> El inventario solo sube cuando se hace la **Recepción** de la mercancía.

Esto se cumple porque el inventario vive en el `stock_ledger` (inmutable) y
solo la recepción escribe un movimiento positivo (`event_type = 'receipt'`).

## Estados de la Orden de Compra

| Estado | Significado |
|--------|-------------|
| `draft` | Borrador — editable, no enviado |
| `sent` | Enviada al proveedor — esperando mercancía |
| `partially_received` | Parcial — se recibió parte de lo ordenado |
| `received` | Recibida — todo lo ordenado ya entró |

## Pasos en la UI

### Paso 1 — Crear la OC (Borrador)

1. Menú lateral → **"Órdenes de Compra"**.
2. Completar el formulario:
   - Número de orden (folio interno).
   - Proveedor.
   - Bodega destino (donde entrará la mercancía).
   - Productos/insumos con **cantidad ordenada** y **costo estimado**.
3. Botón **"Registrar Orden de Compra"** → se crea en estado `draft`.

> Endpoint: `POST /api/purchase-orders` → crea `purchase_orders` + `purchase_order_items`.

### Paso 2 — Enviar al proveedor

1. En la lista de OC, localizar la orden en `Borrador`.
2. Botón **"Enviar"** (confirma) → estado pasa a `sent`.

> Endpoint: `POST /api/purchase-orders/:id/send`.
> Aún **no** hay movimiento de inventario.

### Paso 3 — Recepción de la mercancía (aquí sube el inventario)

1. Menú lateral → **"Recepción de Insumos"**.
2. En "Vincular a Orden de Compra (opcional)", seleccionar la OC (`sent` o `partially_received`).
3. Los items se precargan con la **cantidad pendiente** (`ordenado − recibido`).
4. Ajustar **cantidad recibida** y **costo real** por item.
5. Botón **"Registrar Recepción OC"**.

> Endpoint: `POST /api/purchase-orders/:id/receive` → `PurchaseOrdersService.receiveOrder`
> → `InventoryService.processPurchaseOrderReception`.

### Qué sucede al recibir (backend)

`processPurchaseOrderReception` ejecuta en una sola transacción:

1. Actualiza `purchase_order_items.quantity_received` y `unit_cost_actual`.
2. Recalcula el **costo promedio ponderado** del producto:
   `nuevoCosto = (stockActual * costoActual + recibido * costoReal) / (stockActual + recibido)`.
3. Escribe un movimiento positivo en `stock_ledger` (`event_type = 'receipt'`) en la
   bodega/sucursal destino → **INCREMENTA el inventario** (y actualiza el read-model `stock_levels`).
4. Actualiza el estado de la OC:
   - Todo recibido → `received`.
   - Parte recibida → `partially_received`.

## Flujo alternativo: OC automática desde el Panel de Inventario

1. Menú → **"Panel de Inventario"**.
2. Desde una alerta de stock bajo:
   - **"Generar OC"** → crea una OC `draft` para ese producto (proveedor más barato o el proveedor principal).
   - **"Generar OC automáticas"** → crea OC `draft` para todos los productos por debajo del mínimo global.
3. Revisar la OC en **"Órdenes de Compra"**.
4. Continuar con **Paso 2 (Enviar)** y **Paso 3 (Recepción)**.

## Resumen visual

```text
Panel de Inventario (alerta) ──┐
                               ▼
  [1] Crear OC (draft)  →  [2] Enviar (sent)  →  [3] Recepción  →  stock_ledger (+qty) = inventario ↑
```

- Solo el paso **[3] Recepción** escribe en el ledger y sube el inventario.
- Si nunca se recibe, la OC queda `sent` y el inventario no cambia.
