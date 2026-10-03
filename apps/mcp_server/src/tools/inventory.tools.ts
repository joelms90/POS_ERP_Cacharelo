import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PosApiClient } from '../client.js';
import { config } from '../config.js';

export function registerInventoryTools(server: McpServer, client: PosApiClient) {
  // 1. Stock alerts
  server.tool(
    'get_stock_alerts',
    'Consulta insumos y productos con existencia por debajo del nivel mínimo configurado (alertas de stock bajo).',
    {
      warehouseId: z.string().optional().describe('ID del almacén o bodega (opcional)'),
      businessId: z.string().optional().describe('ID del negocio (opcional)'),
    },
    async ({ warehouseId, businessId }) => {
      const bId = businessId || config.defaultBusinessId;
      const alerts = await client.getStockAlerts(bId, warehouseId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ totalAlerts: alerts.length, alerts }, null, 2),
          },
        ],
      };
    },
  );

  // 2. Inventory Existence
  server.tool(
    'get_inventory_existence',
    'Reporte de existencias físicas actuales de productos e insumos por almacén o consolidadas.',
    {
      productId: z.string().optional().describe('ID del producto a consultar (opcional)'),
      warehouseId: z.string().optional().describe('ID del almacén a consultar (opcional)'),
      businessId: z.string().optional().describe('ID del negocio (opcional)'),
    },
    async ({ productId, warehouseId, businessId }) => {
      const bId = businessId || config.defaultBusinessId;
      const existence = await client.getInventoryExistence(bId, { productId, warehouseId });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(existence, null, 2),
          },
        ],
      };
    },
  );

  // 3. Product Kardex
  server.tool(
    'get_product_kardex',
    'Auditoría y trazabilidad histórica de movimientos de inventario de un producto (entradas, salidas, ventas, mermas, traslados).',
    {
      productId: z.string().describe('ID del producto para consultar su Kardex'),
      limit: z.number().optional().describe('Límite de movimientos a devolver (por defecto 50)'),
      businessId: z.string().optional().describe('ID del negocio (opcional)'),
    },
    async ({ productId, limit, businessId }) => {
      const bId = businessId || config.defaultBusinessId;
      const movements = await client.getProductKardex(bId, productId, limit || 50);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ productId, count: movements.length, movements }, null, 2),
          },
        ],
      };
    },
  );

  // 4. Get Warehouses
  server.tool(
    'get_warehouses',
    'Lista los almacenes, bodegas y sucursales físicas configuradas para almacenamiento de inventario.',
    {
      businessId: z.string().optional().describe('ID del negocio (opcional)'),
    },
    async ({ businessId }) => {
      const bId = businessId || config.defaultBusinessId;
      const warehouses = await client.getWarehouses(bId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ total: warehouses.length, warehouses }, null, 2),
          },
        ],
      };
    },
  );
}
