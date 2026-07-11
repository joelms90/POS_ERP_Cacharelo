# Lista de Tareas: Módulo de Reportes de Inventario y Traspasos Flexibles (v2.5)

Este documento describe la lista de tareas ordenadas por dependencia para completar la implementación técnica del módulo.

---

## Fase 1: Base de Datos y Ledger (Kardex)

- [ ] **Tarea 1: Actualizar Schema de Base de Datos**
  - Crear la definición de la tabla `inventory_movements` en `apps/sync_api/src/database/schema.ts` con todos los campos especificados (lote, ubicación de cajón, referencias).
  - Agregar índices de alto rendimiento para búsquedas por rangos de fecha y productos.
- [ ] **Tarea 2: Generar y Ejecutar Migración**
  - Ejecutar `pnpm run db-migrate` o equivalente (`drizzle-kit generate` y aplicar) para actualizar la base de datos de producción y local.

---

## Fase 2: Lógica de Traspasos Multidireccionales en el Backend

- [ ] **Tarea 3: Modificar Servicio de Traspasos (`InventoryService`)**
  - Actualizar `recordTransfer` para admitir cualquier combinación (Bodega a Bodega, Sucursal a Sucursal, etc.).
  - Asegurar la validación para impedir origen y destino idénticos.
  - Insertar de forma transaccional los movimientos correspondientes en `inventory_movements` (Salida `-Q` en origen y Entrada `+Q` en destino).
- [ ] **Tarea 4: Modificar Flujos de Inventario Existentes para poblar el Ledger**
  - Conectar los métodos de compra a proveedores (`recordReceipt`), ensamble (`assembleProduct`), ajustes manuales (`adjustStock`) y ventas POS para registrar cada cambio físico en `inventory_movements`.

---

## Fase 3: Endpoints de la API Backend (NestJS)

- [ ] **Tarea 5: Crear Controlador y Endpoints de Reportes**
  - Implementar controladores NestJS específicos para los reportes de inventario (existencias, general, sucursal, entradas, salidas, Kardex, etc.).
  - Agregar DTOs con soporte para parámetros comunes (paginación, ordenamiento, filtrado por fecha, etc.).
- [ ] **Tarea 6: Pruebas Unitarias**
  - Escribir pruebas unitarias en Jest para validar que los endpoints de reportes calculan adecuadamente las existencias históricas y consolidadas.

---

## Fase 4: Frontend y UI/UX (Tauri Admin Console)

- [ ] **Tarea 7: Rediseñar Formulario de Creación de Traspasos**
  - En `TransfersPage.tsx`, implementar los selectores de origen y destino dinámicos (Bodega o Sucursal) y validar que no coincidan antes del envío.
- [ ] **Tarea 8: Crear la Interfaz Modular de Reportes**
  - Construir en `ReportsPage.tsx` el selector de columnas visibles, popover de filtros específicos por reporte y las tablas paginadas para cada uno de los 12 reportes.
- [ ] **Tarea 9: Implementar Exportación a XLSX/CSV/PDF**
  - Desarrollar la descarga de reportes aplicando UTF-8 BOM para evitar problemas de caracteres en Microsoft Excel.
- [ ] **Tarea 10: Auditoría Visual de Kardex**
  - Renderizar el listado histórico de movimientos con colores indicativos de tipo y la tarjeta verificadora de integridad matemática.
