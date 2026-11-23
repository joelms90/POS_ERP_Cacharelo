import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
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
            'Catálogo y Productos (búsqueda, detalles y categorías)',
            'Inventario y Kardex (alertas de stock bajo, existencias, trazabilidad)',
            'Ventas y Caja (órdenes abiertas, cortes X y Z)',
            'Operación POS y Cocina (mesas y tickets KDS)',
            'Compras y Requisiciones (requisiciones de sucursales, órdenes de compra)',
            'Producción y Recetas (BOM, simulación de consumo de insumos)',
            'Modo privado de solo lectura (sin llamadas dinámicas ni escrituras)',
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

}
