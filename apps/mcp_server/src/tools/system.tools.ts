import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PosApiClient } from '../client.js';
import { config } from '../config.js';

export function registerSystemTools(server: McpServer, client: PosApiClient, getRegisteredToolsCount: () => number) {
  // 1. System Health and Capabilities
  server.tool(
    'system_health_and_capabilities',
    'Verifica el estado del backend (NestJS + PostgreSQL), su conectividad, latencia y lista todas las capacidades y dominios del servidor MCP.',
    {},
    async () => {
      const startTime = Date.now();
      let apiHealth: any = null;
      let isOnline = false;
      let latencyMs = 0;

      try {
        apiHealth = await client.getHealth();
        isOnline = true;
        latencyMs = Date.now() - startTime;
      } catch (err: any) {
        apiHealth = { error: err.message };
      }

      let branchesCount = 0;
      try {
        const branches = await client.getBranches(config.defaultBusinessId);
        branchesCount = branches.length;
      } catch {
        // ignore
      }

      const report = {
        server: {
          name: config.serverName,
          version: config.serverVersion,
          targetApiUrl: config.apiUrl,
          defaultBusinessId: config.defaultBusinessId,
        },
        backendStatus: {
          online: isOnline,
          latency: `${latencyMs}ms`,
          database: apiHealth?.database || 'unknown',
          branchesConfigured: branchesCount,
        },
        capabilities: {
          totalRegisteredTools: getRegisteredToolsCount(),
          domains: [
            'Catálogo y Productos (búsqueda, detalles, precios, categorías)',
            'Inventario y Kardex (alertas de stock bajo, existencias, trazabilidad)',
            'Ventas y Caja (órdenes abiertas, cortes X y Z)',
            'Operación POS y Cocina (mesas, estados, tickets KDS)',
            'Compras y Requisiciones (requisiciones de sucursales, órdenes de compra)',
            'Producción y Recetas (BOM, simulación de consumo de insumos)',
            'Llamada Dinámica a Nuevos Endpoints (call_backend_api para compatibilidad continua)',
          ],
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(report, null, 2),
          },
        ],
      };
    },
  );

  // 2. Dynamic Passthrough Tool for Future/Evolving Endpoints
  server.tool(
    'call_backend_api',
    'Mecanismo de extensión dinámico: permite ejecutar llamadas HTTP directamente contra cualquier endpoint actual o recién agregado en el backend (REST), garantizando compatibilidad inmediata sin esperar una nueva versión del MCP.',
    {
      endpoint: z.string().describe('Ruta del endpoint de la API (ej: "/users", "/reports/sales-by-product", "/inventory/movements")'),
      method: z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']).optional().describe('Método HTTP (GET por defecto)'),
      query: z.record(z.any()).optional().describe('Parámetros query string (ej: { businessId: "...", limit: 10 })'),
      body: z.record(z.any()).optional().describe('Cuerpo de la petición para POST/PATCH/PUT en formato JSON'),
    },
    async ({ endpoint, method = 'GET', query, body }) => {
      const response = await client.rawRequest(endpoint, method, body, query);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    },
  );
}
