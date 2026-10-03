# 🤖 POS-ERP MCP Server (Model Context Protocol)

Servidor oficial de **Model Context Protocol (MCP)** para el sistema **POS-ERP Cacharelo**. 

Permite a modelos de inteligencia artificial (Claude Desktop, Cursor, Antigravity CLI, Windsurf, ChatGPT, asistentes en WhatsApp/Slack) interactuar directamente con el backend del ERP: consultar inventarios, auditoría Kardex, catálogo de productos, órdenes de mesas, tickets de cocina (KDS), arqueos de caja y compras.

---

## 🚀 Inicio Rápido

### 1. Verificar Conectividad con el Backend
Asegúrate de que el backend esté corriendo (`make dev-backend-local` en el puerto 3001 o apunta a producción).
```bash
make mcp-verify
# o directamente:
cd apps/mcp_server && pnpm test:verify
```

### 2. Iniciar el Servidor MCP en modo Stdio
```bash
make mcp-start
# o directamente:
cd apps/mcp_server && pnpm start
```

---

## 🛠️ Catálogo Completo de Herramientas (Tools)

El servidor organiza sus herramientas en **7 dominios operativos**:

### 1. Catálogo & Menú (`catalog.tools.ts`)
| Herramienta | Parámetros | Descripción | Ejemplo de consulta IA |
| :--- | :--- | :--- | :--- |
| `search_products` | `search?`, `categoryId?`, `isSellable?`, `businessId?` | Busca productos por nombre, SKU o categoría con precios y costos. | *"¿Cuánto cuesta el Baguette Cacharelo y cuál es su SKU?"* |
| `get_product_details` | `productId` | Obtiene la ficha técnica completa del producto. | *"Dame la ficha del producto con ID cf661b19..."* |
| `update_product_price` | `productId`, `price?`, `priceWholesale?` | Modifica el precio de venta o mayoreo de un producto. | *"Sube el precio del Baguette a $125.00"* |
| `get_categories` | `businessId?` | Lista categorías del catálogo con su estación KDS. | *"¿Qué categorías tenemos asignadas a Barra?"* |

### 2. Inventario & Kardex (`inventory.tools.ts`)
| Herramienta | Parámetros | Descripción | Ejemplo de consulta IA |
| :--- | :--- | :--- | :--- |
| `get_stock_alerts` | `warehouseId?`, `businessId?` | Consulta insumos por debajo del stock mínimo. | *"¿Qué insumos están en alerta de desabasto?"* |
| `get_inventory_existence` | `productId?`, `warehouseId?`, `businessId?` | Existencia física por bodega/almacén o consolidada. | *"¿Cuánto café en grano queda en el Almacén Cafetería?"* |
| `get_product_kardex` | `productId`, `limit?`, `businessId?` | Trazabilidad histórica de movimientos (entradas, ventas, mermas). | *"Muéstrame los últimos 10 movimientos Kardex del insumo X"* |
| `get_warehouses` | `businessId?` | Lista almacenes y bodegas físicas del negocio. | *"¿Qué almacenes tenemos registrados?"* |

### 3. Ventas & Cortes de Caja (`sales.tools.ts`)
| Herramienta | Parámetros | Descripción | Ejemplo de consulta IA |
| :--- | :--- | :--- | :--- |
| `get_active_orders` | `branchId` | Consulta cuentas abiertas o por cobrar en mesas con desglose. | *"¿Qué órdenes están abiertas en la sucursal Centro?"* |
| `simulate_corte_caja` | `type` ('x' \| 'z'), `branchName?`, `cashierName?` | Arqueo parcial (Corte X) o corte de cierre de turno (Corte Z). | *"Genera un simulacro de Corte Z para el turno de la tarde"* |

### 4. Operación POS & Cocina (`pos.tools.ts`)
| Herramienta | Parámetros | Descripción | Ejemplo de consulta IA |
| :--- | :--- | :--- | :--- |
| `get_branch_tables` | `branchId` | Semáforo de mesas (disponibles, ocupadas, por cobrar, limpieza). | *"¿Cuántas mesas están ocupadas y cuántas libres en Centro?"* |
| `update_table_state` | `branchId`, `tableId`, `state` | Actualiza estado de mesa (ej. liberar mesa tras limpieza). | *"Marca la Mesa 6 como disponible"* |
| `get_kitchen_tickets` | `branchId` | Tickets activos en pantalla KDS de cocina y barra. | *"¿Qué comandas están pendientes de preparar en cocina?"* |
| `update_kitchen_ticket_status` | `ticketId`, `status` | Avanza estado del ticket (`preparing`, `ready`, `served`). | *"Cambia el ticket 8b8a71d6 a Listo para servir"* |

### 5. Compras & Requisiciones (`purchasing.tools.ts`)
| Herramienta | Parámetros | Descripción | Ejemplo de consulta IA |
| :--- | :--- | :--- | :--- |
| `get_requisitions` | `status?`, `businessId?` | Requisiciones de insumos solicitadas por sucursales. | *"¿Hay requisiciones pendientes de aprobar?"* |
| `get_purchase_orders` | `status?`, `businessId?` | Órdenes de compra a proveedores y estado de recepción. | *"Lista las órdenes de compra enviadas esta semana"* |

### 6. Producción & Recetas (`production.tools.ts`)
| Herramienta | Parámetros | Descripción | Ejemplo de consulta IA |
| :--- | :--- | :--- | :--- |
| `get_product_recipe_bom` | `productId` | Receta (BOM) de un platillo con gramos/piezas de cada ingrediente. | *"¿Cuál es la receta del Omelette con Panela?"* |
| `simulate_recipe_depletion` | `productId`, `quantity` | Calcula el consumo teórico de insumos para N unidades producidas. | *"Si producimos 50 Baguettes, ¿cuánto queso y pollo requerimos?"* |

### 7. Sistema & Extensibilidad Dinámica (`system.tools.ts`)
| Herramienta | Parámetros | Descripción |
| :--- | :--- | :--- |
| `system_health_and_capabilities` | *(ninguno)* | Diagnóstico de conexión al backend, latencia y lista de herramientas activas. |
| `call_backend_api` | `endpoint`, `method?`, `query?`, `body?` | **Comodín de extensión dinámico**: permite llamar a cualquier endpoint nuevo o existente de la API sin esperar una nueva versión de MCP. |

---

## ⚙️ Configuración en Clientes de IA

### A. Claude Desktop
Añade a tu archivo `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "pos-erp": {
      "command": "npx",
      "args": ["-y", "tsx", "/Users/joelmorales/web/POS-ERP/apps/mcp_server/src/index.ts"],
      "env": {
        "POS_API_URL": "http://localhost:3001/api",
        "POS_DEFAULT_BUSINESS_ID": "d3b07384-d113-4a0e-a555-e5b12824bf01"
      }
    }
  }
}
```

### B. Cursor IDE
Crea o edita `.cursor/mcp.json` en la raíz del proyecto:
```json
{
  "mcpServers": {
    "pos-erp": {
      "command": "npx",
      "args": ["-y", "tsx", "apps/mcp_server/src/index.ts"],
      "env": {
        "POS_API_URL": "http://localhost:3001/api",
        "POS_DEFAULT_BUSINESS_ID": "d3b07384-d113-4a0e-a555-e5b12824bf01"
      }
    }
  }
}
```

### C. Producción (Google Cloud Run)
Para apuntar el MCP a la API en producción en lugar del backend local:
```env
POS_API_URL=https://pos-sync-api-232144991863.us-central1.run.app/api
POS_ADMIN_TOKEN=pos-secure-db-pass-2026!
POS_DEFAULT_BUSINESS_ID=d3b07384-d113-4a0e-a555-e5b12824bf01
```

---

## 🔄 Mecanismo de Sincronización y Actualización Continua

Para garantizar que el servidor MCP **nunca quede obsoleto** conforme el backend crece y mejora, se implementaron 3 mecanismos:

### 1. Auditoría Automática de Cobertura (`make mcp-sync-check`)
Ejecuta en cualquier momento:
```bash
make mcp-sync-check
```
Este script:
- Escanea todos los controladores NestJS en `apps/sync_api/src/modules/` en tiempo real.
- Detecta todas las rutas HTTP (`@Get`, `@Post`, `@Patch`, `@Delete`).
- Compara las rutas contra las herramientas registradas en el MCP.
- Reporta la cobertura exacta y genera una lista de candidatos agrupados por módulo listos para convertirse en nuevas herramientas dedicadas.

### 2. Comodín Dinámico `call_backend_api` (Cero Espera)
Si hoy agregas un nuevo módulo en el backend (por ejemplo `/api/loyalty/points`), la IA **no tiene que esperar a que alguien cree la herramienta en MCP**. Puede invocar inmediatamente:
```json
call_backend_api({
  "endpoint": "/loyalty/points",
  "method": "GET",
  "query": { "customerId": "..." }
})
```
Esto garantiza compatibilidad del 100% el mismo día que se despliega cualquier cambio en el backend.

### 3. Arquitectura Modular por Dominios
Agregar una nueva herramienta especializada toma menos de 2 minutos:
1. Abre el archivo de su dominio (ej. `src/tools/inventory.tools.ts`).
2. Agrega `server.tool(...)` con su esquema `zod`.
3. Ejecuta `make mcp-verify` para validar que responde correctamente.
