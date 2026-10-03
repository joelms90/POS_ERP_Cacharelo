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

  // 2. Update table state (e.g. mark clean)
  server.tool(
    'update_table_state',
    'Actualiza el estado operativo de una mesa (ej: cambiar de "cleaning" a "available" tras desocuparse y limpiarse).',
    {
      branchId: z.string().describe('ID de la sucursal'),
      tableId: z.string().describe('ID de la mesa'),
      state: z.enum(['available', 'occupied', 'billing', 'cleaning']).describe('Nuevo estado de la mesa'),
    },
    async ({ branchId, tableId, state }) => {
      const updated = await client.updateTable(branchId, tableId, { state });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, message: `Mesa actualizada a estado ${state}`, table: updated }, null, 2),
          },
        ],
      };
    },
  );

  // 3. Get kitchen tickets (KDS)
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

  // 4. Update kitchen ticket status
  server.tool(
    'update_kitchen_ticket_status',
    'Avanza el estado de un ticket en cocina (ej: "preparing" para empezar a cocinar, "ready" cuando esté listo para servir, o "served" al entregarse).',
    {
      ticketId: z.string().describe('ID del ticket de cocina'),
      status: z.enum(['pending', 'preparing', 'ready', 'served']).describe('Nuevo estado del ticket'),
    },
    async ({ ticketId, status }) => {
      const updated = await client.updateKitchenTicket(ticketId, status);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, ticket: updated }, null, 2),
          },
        ],
      };
    },
  );
}
