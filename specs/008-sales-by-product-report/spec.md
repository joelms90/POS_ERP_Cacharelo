# Feature Specification: Reporte de Ventas por Producto Vendido

**Feature Branch**: `008-sales-by-product-report`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "now I have this spec for the business control I want that you generate a `Reporte de Ventas por producto vendido` spec and plan to implement"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Visualización del Reporte de Ventas por Producto (Priority: P1)

Como Administrador o Auditor de Negocios, quiero ver una tabla detallada con los productos vendidos en un rango de fechas y sucursal específicos para analizar el rendimiento comercial de cada artículo.

**Why this priority**: Este es el núcleo del reporte. Permite a la administración saber qué productos se están vendiendo, en qué cantidad y cuántos ingresos brutos/netos representan.

**Independent Test**: Filtrar el reporte para el día de hoy y verificar que las cantidades y montos totales coincidan con la sumatoria de los tickets cobrados en el POS durante el día.

**Acceptance Scenarios**:

1. **Given** que el usuario está en el panel de reportes administrativos, **When** selecciona la pestaña "Ventas por Producto", **Then** se debe mostrar una tabla con los campos: Producto, Categoría, Unidades Vendidas, Precio Unitario Promedio (Bruto), Venta Bruta Total, IVA Incluido (16%) y Venta Neta Total.
2. **Given** que el usuario cambia el filtro de sucursal o el rango de fechas, **When** hace clic en buscar o se actualizan los filtros, **Then** la tabla debe recalcular inmediatamente las unidades vendidas y montos para el nuevo criterio seleccionado.

---

### User Story 2 - Filtros Avanzados y Búsqueda (Priority: P2)

Como Administrador, quiero poder buscar productos específicos por nombre/SKU y filtrarlos por categoría para auditar rápidamente líneas de productos específicas sin tener que navegar por toda la lista.

**Why this priority**: Mejora la experiencia del usuario y la eficiencia operativa cuando el catálogo contiene cientos de productos.

**Independent Test**: Ingresar el nombre de un producto (ej. "Chocolatín") en la barra de búsqueda y verificar que solo aparezcan las filas correspondientes a ese producto.

**Acceptance Scenarios**:

1. **Given** un reporte cargado con múltiples productos, **When** el usuario selecciona una categoría del selector, **Then** la tabla debe mostrar únicamente los productos pertenecientes a esa categoría.
2. **Given** la barra de búsqueda de producto, **When** el usuario escribe al menos 3 caracteres, **Then** la tabla se debe filtrar en tiempo real para mostrar coincidencias por nombre o SKU.

---

### User Story 3 - Exportación de Datos (Priority: P3)

Como Administrador, quiero exportar el reporte actual filtrado en formatos Excel (.xlsx), CSV o PDF para compartirlo con contabilidad o archivarlo localmente.

**Why this priority**: Permite la portabilidad de los datos financieros hacia otros sistemas (como software contable) u hojas de cálculo.

**Independent Test**: Hacer clic en "Exportar Excel" y verificar que el archivo descargado contenga exactamente las mismas filas, columnas y totales visibles en la interfaz.

**Acceptance Scenarios**:

1. **Given** un reporte con filtros activos de fecha y categoría, **When** el usuario hace clic en el botón "Exportar Excel", **Then** se debe iniciar la descarga automática de un archivo `.xlsx` estructurado con la información filtrada.
2. **Given** el reporte en pantalla, **When** el usuario hace clic en "Exportar PDF", **Then** se genera una vista limpia en formato PDF lista para impresión o guardado.

---

### Edge Cases

- **Producto Eliminado/Inactivo**: Si un producto fue vendido en el pasado pero actualmente está inactivo o fue eliminado del catálogo actual, debe seguir apareciendo en el reporte histórico con su nombre y SKU correspondientes para no distorsionar las ventas totales.
- **Rango de Fechas Vacío o Inválido**: Si el usuario selecciona una fecha de inicio posterior a la fecha de fin, el sistema debe mostrar un mensaje de validación amigable y bloquear la consulta hasta corregir el rango.
- **Sin Conectividad a Internet (Offline)**: Dado que el panel de control administrativo (Tauri) requiere conexión para obtener la información consolidada en la nube, el sistema debe mostrar un estado offline claro ("Sin conexión a la nube de reportes") en lugar de cargar una tabla vacía.
- **Venta de Productos con Precio $0.00 (Cortesia/Muestra)**: Los productos entregados con precio de venta $0.00 deben aparecer listados con su cantidad correspondiente, indicando venta bruta, IVA y venta neta en $0.00 sin causar errores de división o cálculo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST proveer una nueva pestaña llamada "Ventas por Producto" en la sección de reportes del panel administrativo.
- **FR-002**: El sistema MUST permitir filtrar las ventas por rango de fechas (Fecha Inicio y Fecha Fin) y por Sucursal.
- **FR-003**: La tabla de resultados MUST contener las columnas:
  - **Producto**: Nombre del artículo comercializado (incluyendo SKU si está disponible).
  - **Categoría**: Categoría del producto para fácil clasificación.
  - **Unidades Vendidas**: Cantidad total acumulada de unidades vendidas.
  - **Precio Promedio**: Precio bruto unitario ponderado al que se vendió.
  - **Venta Bruta**: Sumatoria de `cantidad * precio_venta_al_momento_de_cobro`.
  - **IVA Incluido (16%)**: Monto del IVA incluido en la venta bruta, calculado como `Venta Bruta - (Venta Bruta / 1.16)`.
  - **Venta Neta**: Ventas antes de impuestos, calculadas como `Venta Bruta - IVA Incluido`.
- **FR-004**: El sistema MUST mostrar una fila de totales al final de la tabla sumando las Unidades Vendidas, Venta Bruta, IVA y Venta Neta consolidada de todos los productos listados.
- **FR-005**: El sistema MUST permitir la búsqueda rápida por texto libre (Nombre o SKU) y filtrado por Categoría.
- **FR-006**: El sistema MUST implementar la descarga del reporte filtrado en formatos Excel (.xlsx), CSV y PDF.
- **FR-007**: Los datos monetarios del reporte MUST mostrarse formateados en Pesos Mexicanos (MXN) con exactamente dos decimales (ej. `$1,250.00`).

### Key Entities

- **ProductSalesReportLine**: Representa la fila consolidada de ventas para un producto en el período consultado.
  - Atributos clave: `productId`, `productName`, `sku`, `categoryName`, `quantitySold`, `averagePrice`, `grossSales`, `taxAmount`, `netSales`.
- **SaleReportFilter**: Objeto que encapsula los filtros de búsqueda aplicados.
  - Atributos clave: `startDate`, `endDate`, `branchId`, `categoryId`, `searchQuery`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El reporte debe generarse y renderizarse en la interfaz en menos de 2.0 segundos para períodos que involucren hasta 15,000 ítems vendidos.
- **SC-002**: Las exportaciones a formatos Excel y CSV deben descargarse en menos de 3.0 segundos desde que el usuario confirma la acción.
- **SC-003**: Las sumatorias en la fila de totales de la tabla deben coincidir matemáticamente al 100% con los montos individuales de cada fila, sin discrepancias por redondeo de centavos.
- **SC-004**: El diseño del reporte debe seguir la estética premium de la aplicación utilizando la paleta metálica e HSL oscura definida.

## Assumptions

- Se asume que el backend calcula los datos de ventas directamente sobre las tablas de órdenes cobradas/completadas (`orders` y `order_items` con estado `closed`).
- Todos los precios de venta almacenados en la base de datos (tanto en productos como en order_items) son precios brutos (con IVA del 16% incluido). Por lo tanto, los cálculos netos de venta y del impuesto se derivan de forma descendente (dividiendo entre 1.16).
- No se incluye en el MVP la desagregación por modificadores (ej. extras de ingredientes), los cuales se totalizan dentro del precio del producto principal vendido.
