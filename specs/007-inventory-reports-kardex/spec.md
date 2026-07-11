# Especificación Funcional: Módulo de Reportes de Inventario y Traspasos Flexibles (v2.5)

Este documento define los requisitos funcionales y el alcance para la implementación de traspasos de inventario multidireccionales y el módulo completo de reportes administrativos y de auditoría de existencias.

---

## 1. Traspasos de Inventario Flexibles (Polimórficos)

Actualmente, el sistema está limitado a traspasos de Bodega a Sucursal en su panel administrativo. Se requiere ampliar la lógica para admitir **cualquier combinación** de movimiento interno de inventario:

* **Bodega a Bodega (Warehouse to Warehouse)**
* **Sucursal a Sucursal (Branch to Branch)**
* **Sucursal a Bodega (Branch to Warehouse)**
* **Bodega a Sucursal (Warehouse to Branch)**

### Reglas de Operación:
* **Integridad del Inventario Total**: Los traspasos no incrementan ni disminuyen el inventario consolidado a nivel empresa; únicamente mueven las cantidades entre ubicaciones físicas del mismo negocio.
* **Compensación**: Cada traspaso genera un impacto negativo de salida (`-Q`) en el origen y un impacto positivo de entrada (`+Q`) en el destino en los registros del Kardex, sumando una variación neta de `0`.
* **Restricción de Origen/Destino**: No se permite realizar traspasos donde el origen y el destino sean el mismo nodo físico (ej. Bodega A a Bodega A).

---

## 2. Alcance del Módulo de Reportes

El sistema debe proveer los siguientes 12 reportes administrativos consolidados:

1. **Reporte de Existencia de Almacén**: Muestra las existencias por producto en una ubicación (bodega/sucursal) con valorizaciones de costo (promedio o unitario).
2. **Reporte de Existencia General**: Muestra el total de existencias consolidado a nivel negocio para cada producto (suma de todas las sucursales y bodegas).
3. **Reporte por Almacén / Bodega**: Existencias y costos filtrados para un almacén específico.
4. **Reporte por Sucursal**: Existencia y costos totales segmentados por punto de venta.
5. **Reporte de Cajón o Ubicación**: Mapeo físico de artículos organizados en cajones, estanterías o secciones del almacén.
6. **Reporte de Entradas**: Listado cronológico de compras a proveedores, ajustes positivos, cancelaciones de venta e inventario inicial.
7. **Reporte de Salidas**: Listado cronológico de mermas, ventas registradas, consumos internos, recetas de ensamble y ajustes negativos.
8. **Reporte de Kardex**: Auditoría paso a paso de movimientos de stock para un producto, mostrando la ecuación: `Existencia Final = Existencia Anterior + Entradas - Salidas`.
9. **Reporte de Órdenes de Compra por Fecha**: Control de compras planeadas, recibidas y pendientes.
10. **Reporte de Entradas por Día y Proveedor**: Análisis de compras valorizadas por día de entrega y proveedor asociado.
11. **Reporte de Traspasos Enviados y Recibidos**: Historial de movimientos entre ubicaciones con registro de discrepancias.
12. **Reporte de Costos de Inventario**: Desglose económico del inventario basado en costo promedio, último costo de compra y valor total.

---

## 3. Requerimientos Generales y UX

### A. Filtros Comunes
Cuando aplique, el usuario podrá filtrar por:
* Rango de fechas.
* Almacén / Sucursal de origen/destino.
* Producto / Categoría.
* Estado del producto (Activo, Inactivo, Todos).
* Proveedor / Lote / Fecha de caducidad.
* Folio de referencia.

### B. Columnas Configurables
El usuario puede elegir qué columnas visualizar. El sistema almacenará localmente estas configuraciones por reporte para mantener la personalización por usuario.

### C. Exportación
Cada reporte debe permitir la descarga en formatos **Excel (.xlsx)**, **CSV** y **PDF**, respetando los filtros activos y las columnas visibles.

### D. Seguridad de Costos
Los costos económicos del inventario (unitarios, totales y promedios) son información sensible. Solo se mostrarán a usuarios con roles autorizados (Administrador, Compras, Auditor). Se ocultarán para los roles de Cajero o Mesero.
