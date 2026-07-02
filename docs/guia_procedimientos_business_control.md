# Guía de Procedimientos: Gestión de Inventario, Recetas y Catálogo

Esta guía describe los procedimientos operativos estándar y las preguntas frecuentes (FAQ) para administrar el catálogo, inventario de materias primas y recetas en el panel de control administrativo (**Business Control**).

---

## 📌 Conceptos Clave

Para operar el sistema correctamente, es fundamental entender la diferencia entre los dos roles principales que puede tener un artículo:

| Rol de Artículo | ¿Para Venta? (`isSellable`) | ¿Es Insumo? (`isIngredient`) | ¿Aparece en Caja? | ¿Aparece en Recetas? | Ejemplo |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Producto Terminado** | **SÍ** | NO | SÍ (Menú del cajero) | SÍ (Permite configurarle receta) | Sándwich de Jamón, Paste de Piña, Café Americano |
| **Insumo / Materia Prima** | NO | **SÍ** | NO (No se vende suelto) | NO (Se usa para armar recetas) | Pan de caja, Jamón, Harina, Café en grano |

---

## 🛠️ Procedimientos Paso a Paso

### Procedimiento 1: Crear un nuevo producto y configurar su receta
Sigue estos pasos cuando agregues un nuevo plato, bebida o artículo preparado al menú del negocio:

1. **Dar de alta en el Catálogo:**
   * Entra a la sección **Inventario y Catálogo**.
   * Haz clic en **Nuevo Producto**.
   * Llena los campos obligatorios: Nombre, Categoría, Costo, y Precio de Venta.
   * Asegúrate de marcar **Para Venta = SÍ** y **Es Insumo = NO**.
   * Haz clic en **Guardar**.
2. **Definir su receta (BOM):**
   * Entra a la sección **Producción (Recetas)**.
   * En la columna izquierda (*1. Seleccione Producto Terminado*), haz clic sobre tu nuevo producto.
   * En el formulario de la derecha, selecciona un ingrediente componente (insumo) del menú desplegable y escribe la cantidad exacta que lleva **1 unidad** del producto terminado.
   * Haz clic en **Añadir** para agregarlo a la tabla. Repite para cada insumo.
   * Finalmente, haz clic en el botón superior **Guardar Receta**.

---

### Procedimiento 2: Registrar la compra/entrada de materias primas (Insumos)
Cuando llega mercadería o insumos del proveedor:

1. Entra a la sección **Inventario y Catálogo** y ve a la pestaña **Entradas de Inventario**.
2. Haz clic en **Registrar Entrada**.
3. Selecciona:
   * **Proveedor** que te vendió la mercancía.
   * **Bodega o Sucursal** de destino.
   * Fecha de recepción y notas opcionales (ej. número de factura).
4. En el buscador inferior, agrega los insumos comprados ingresando la **cantidad** y el **costo unitario**.
5. Haz clic en **Guardar Entrada**. El stock de tus materias primas se actualizará de inmediato.

---

### Procedimiento 3: Hornear o pre-fabricar en lotes (ej. Pastes)
Si produces un lote de artículos preparados con anticipación para exhibir en vitrinas:

1. Entra a la sección **Producción (Recetas)** y ve a la pestaña **Ensamble de Productos**.
2. Selecciona la **Bodega/Sucursal** donde se están cocinando.
3. Selecciona el **Producto Terminado** a producir (ej. *Paste de Piña*).
4. Escribe la **Cantidad a Producir** (ej. `10`).
5. Haz clic en **Procesar Ensamble**.
   * *El sistema automáticamente restará del stock los ingredientes proporcionales del lote y sumará los 10 pastes terminados listos para ser vendidos en la sucursal.*

---

### Procedimiento 4: Importación masiva desde Excel
Si tienes un listado grande de artículos en una hoja de cálculo:

1. En la pestaña **Importaciones Masivas**, descarga la plantilla en formato CSV utilizando el botón **Descargar Plantilla**.
2. Rellena las columnas correspondientes en Excel.
3. **Clasificación de Insumos vs Venta en el archivo:**
   * Agrega la columna **`Para Venta`**.
   * Para los ingredientes base (ej. *Harina*), deja la celda vacía o escribe **`NO`**. El sistema los creará automáticamente como **Insumos**.
   * Para los platos listos para venta (ej. *Pastes*), escribe **`SI`**. El sistema los creará como **Productos de Venta**.
4. Sube el archivo haciendo clic en **Seleccionar Archivo** e importar.

---

## ❓ Preguntas Frecuentes (FAQ)

### ¿Cómo descuenta inventario el sistema al vender en la caja?
El sistema opera con un **algoritmo híbrido** inteligente:
* **Si el producto vendido tiene stock disponible** (porque registraste su horneado previo en la pestaña de Ensamble): Descuenta la cantidad directamente de ese stock terminado.
* **Si el producto vendido tiene stock en 0** (porque se prepara al momento, como un *Sándwich* o *Café*): El sistema busca automáticamente su receta y descuenta los ingredientes proporcionales (pan, jamón) de tu bodega en tiempo real.

### ¿Por qué mi insumo (ej. "Harina") no aparece en la lista para configurarle receta?
Porque la Harina está marcada como **Es Insumo = SÍ**. Las recetas se configuran únicamente **para** productos terminados que se venden al cliente. Los insumos se registran y administran dentro de la mermelada o receta del producto terminado.

### ¿Qué pasa si intento hacer un Ensamble de Producción y no tengo suficientes insumos?
El sistema bloqueará la transacción y te mostrará un aviso detallado indicándote cuál ingrediente falta y el stock disponible actual para evitar inconsistencias en el inventario.
