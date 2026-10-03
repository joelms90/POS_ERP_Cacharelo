import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PosApiClient } from '../client.js';
import { config } from '../config.js';

export function registerPurchasingTools(server: McpServer, client: PosApiClient) {
  // 1. Get branch requisitions
  server.tool(
    'get_requisitions',
    'Consulta requisiciones de insumos solicitadas por sucursales a los almacenes centrales.',
    {
      status: z.enum(['pending', 'pending_approval', 'approved', 'rejected', 'completed']).optional().describe('Filtrar por estado'),
      businessId: z.string().optional().describe('ID del negocio (opcional)'),
    },
    async ({ status, businessId }) => {
      const bId = businessId || config.defaultBusinessId;
      const requisitions = await client.getRequisitions(bId, status);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ total: requisitions.length, requisitions }, null, 2),
          },
        ],
      };
    },
  );

  // 2. Get purchase orders
  server.tool(
    'get_purchase_orders',
    'Consulta órdenes de compra emitidas a proveedores para reabastecimiento de almacén.',
    {
      status: z.enum(['draft', 'sent', 'received', 'partially_received', 'cancelled']).optional().describe('Filtrar por estado'),
      businessId: z.string().optional().describe('ID del negocio (opcional)'),
    },
    async ({ status, businessId }) => {
      const bId = businessId || config.defaultBusinessId;
      const pos = await client.getPurchaseOrders(bId, status);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ total: pos.length, purchaseOrders: pos }, null, 2),
          },
        ],
      };
    },
  );
}
