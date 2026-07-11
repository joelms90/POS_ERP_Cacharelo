# Plan de Implementación Técnica: Reportes de Inventario y Traspasos Flexibles (v2.5)

Este documento detalla los cambios de base de datos, APIs de NestJS, componentes de frontend en Tauri y la lógica de negocio necesaria para cumplir con la especificación.

---

## 1. Diseño de Base de Datos (Drizzle ORM)

### A. Tabla Centralizada de Kardex (`inventory_movements`)
Agregaremos una tabla de libro diario/ledger para rastrear todos los movimientos y flujos físicos de stock.

```typescript
export const inventoryMovements = pgTable('inventory_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  
  // Ubicaciones
  branchId: uuid('branch_id').references(() => branches.id),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id),
  
  // Detalle del Movimiento
  quantity: decimal('quantity', { precision: 12, scale: 3 }).notNull(), // Positivo = Entrada, Negativo = Salida
  type: varchar('type', { length: 30 }).notNull(), 
  // 'receipt' | 'sale' | 'production_input' | 'production_output' | 'transfer_out' | 'transfer_in' | 'adjustment' | 'initial'
  
  // Referencias cruzadas
  referenceId: uuid('reference_id'), // ID de la tabla asociada (order_id, receipt_id, transfer_id, etc.)
  documentNumber: varchar('document_number', { length: 50 }), // SKU de orden, Folio de compra, etc.
  notes: text('notes'),
  
  // Lotes y Caducidades
  lotNumber: varchar('lot_number', { length: 100 }),
  expirationDate: timestamp('expiration_date', { withTimezone: true }),
  drawerLocation: varchar('drawer_location', { length: 100 }), // Ubicación física (cajón/anaquel)

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdById: uuid('created_by_id').references(() => users.id),
});
```

### B. Índices de Base de Datos para Alto Rendimiento (Performance)
Para optimizar las búsquedas de reportes masivos por rangos de fecha, se agregarán índices en `inventory_movements`:
* `idx_inv_movements_business_product`: `(business_id, product_id)`
* `idx_inv_movements_branch`: `(branch_id)`
* `idx_inv_movements_warehouse`: `(warehouse_id)`
* `idx_inv_movements_created_at`: `(created_at)`

---

## 2. Modificaciones al Flujo de Traspasos en Backend (`sync_api`)

La API en `InventoryService.recordTransfer` ya soporta opcionalmente `fromWarehouseId`, `fromBranchId`, `toWarehouseId` y `toBranchId` en base de datos. Ajustaremos las reglas de validación para garantizar:

1. **Compensación Neta Cero**:
   Por cada traspaso completado de `Origen` a `Destino`, insertaremos dos filas en `inventory_movements`:
   - Salida del Origen: `quantity = -Q`, `type = 'transfer_out'`, `referenceId = transferId`.
   - Entrada al Destino: `quantity = +Q`, `type = 'transfer_in'`, `referenceId = transferId`.
2. **Validación de Unicidad**:
   Lanzar `BadRequestException` si:
   `fromWarehouseId === toWarehouseId` o `fromBranchId === toBranchId` (cuando los otros campos son nulos).

---

## 3. Nuevos Endpoints y Queries SQL para Reportes

Crearemos el controlador `ReportsInventoryController` para manejar los endpoints con paginación y sumatorias de auditoría:

### A. Reporte de Existencias (`GET /api/reports/inventory/existence`)
Combina `stockLevels` con `products` y `categories` filtrado por estado (`isActive`) y ubicación.
* **Query Drizzle**:
  ```typescript
  const rows = await db
    .select({
      id: schema.stockLevels.id,
      productName: schema.products.name,
      sku: schema.products.sku,
      category: schema.categories.name,
      isActive: schema.products.isActive,
      quantity: schema.stockLevels.quantity,
      cost: schema.products.cost,
      minStock: schema.products.minStock,
    })
    .from(schema.stockLevels)
    .innerJoin(schema.products, eq(schema.stockLevels.productId, schema.products.id))
    .innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
    .where(and(...conditions));
  ```

### B. Reporte de Kardex (`GET /api/reports/inventory/kardex`)
Calcula los saldos históricos acumulados para un producto sumando consecutivamente `quantity` en `inventoryMovements`.
* **Query Drizzle**:
  ```typescript
  const movements = await db
    .select()
    .from(schema.inventoryMovements)
    .where(and(
      eq(schema.inventoryMovements.businessId, businessId),
      eq(schema.inventoryMovements.productId, productId)
    ))
    .orderBy(asc(schema.inventoryMovements.createdAt));
  
  // Lógica de cálculo en memoria para devolver saldo_anterior y saldo_final
  let runningBalance = 0;
  const result = movements.map(m => {
    const prev = runningBalance;
    runningBalance += parseFloat(m.quantity);
    return { ...m, previousBalance: prev, finalBalance: runningBalance };
  });
  ```

---

## 4. Frontend Tauri Console (`business_control_tauri`)

### A. Traspasos Multidireccionales (`TransfersPage.tsx`)
Rediseñaremos la sección de creación de traspasos:
1. **Selector de Origen**:
   - Selector radial: **"Bodega"** o **"Sucursal"**.
   - Dropdown que muestra la lista correspondiente filtrada por selección.
2. **Selector de Destino**:
   - Selector radial: **"Bodega"** o **"Sucursal"**.
   - Dropdown que muestra la lista correspondiente.
3. **Validación**: Deshabilita el botón de envío y arroja alerta si el origen y destino seleccionados coinciden.

### B. Módulo de Reportes de Inventario y Kardex (`ReportsPage.tsx`)
Crearemos una interfaz interactiva y modular con:
1. **Configurador de Columnas**: Un dropdown tipo popover con casillas de verificación que actualiza el estado de columnas visibles.
2. **Exportador CSV y Excel**: Un script utilitario en React que genera y descarga archivos CSV/XLSX aplicando formato a las celdas, incluyendo el prefijo BOM (`\uFEFF`) para compatibilidad completa en Excel.
3. **Componente de Kardex Interactivo**:
   - Permite elegir un producto específico del catálogo.
   - Renderiza la tabla de movimientos mostrando el balance acumulado del producto con badges de color indicativos (verde para incrementos reales, rojo para decrementos por venta/merma, amarillo para traspasos internos).
