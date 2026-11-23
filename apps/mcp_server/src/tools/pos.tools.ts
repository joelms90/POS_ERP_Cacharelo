import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PosApiClient } from '../client.js';

export function registerPosTools(server: McpServer, client: PosApiClient) {
  // 1. Get branch tables
  server.tool(
    'get_branch_tables',
    'Consulta las mesas de una sucursal, su estado actual (disponible, ocupada, por cobrar, en limpieza), salón y capacidad.',
    {
      branchId: z.string().describe('ID de la sucursal'),
    },
    async ({ branchId }) => {
      const tables = await client.getTables(branchId);
      const summary = tables.map((t) => ({
        id: t.id,
        label: t.label,
        room: t.room || 'General',
        capacity: t.capacity || 4,
        state: t.state || 'available',
      }));

      const counts = {
        total: summary.length,
        available: summary.filter((t) => t.state === 'available' || t.state === 'free').length,
        occupied: summary.filter((t) => t.state === 'occupied').length,
        billing: summary.filter((t) => t.state === 'billing').length,
        cleaning: summary.filter((t) => t.state === 'cleaning').length,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ counts, tables: summary }, null, 2),
          },
        ],
      };
    },
  );

  // 2. Get kitchen tickets (KDS)
  server.tool(
    'get_kitchen_tickets',
    'Obtiene los tickets activos en la pantalla de cocina (KDS) ordenados por estación (cocina o barra) y estado (pending, preparing, ready, served).',
    {
      branchId: z.string().describe('ID de la sucursal'),
    },
    async ({ branchId }) => {
      const tickets = await client.getKitchenTickets(branchId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ totalActiveTickets: tickets.length, tickets }, null, 2),
          },
        ],
      };
    },
  );

}
