import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PosApiClient } from '../client.js';

export function registerSalesTools(server: McpServer, client: PosApiClient) {
  // 1. Get active orders
  server.tool(
    'get_active_orders',
    'Obtiene las órdenes actualmente abiertas o por cobrar en una sucursal, con desglose de partidas y totales.',
    {
      branchId: z.string().describe('ID de la sucursal a consultar'),
    },
    async ({ branchId }) => {
      const orders = await client.getActiveOrders(branchId);
      const summary = orders.map((o) => ({
        id: o.id,
        tableId: o.tableId,
        state: o.state,
        subtotal: o.subtotal,
        tax: o.tax,
        total: o.total,
        itemCount: o.items?.length || 0,
        createdAt: o.createdAt,
        items: o.items?.map((i: any) => ({
          name: i.productName || i.productId,
          quantity: i.quantity,
          price: i.price,
          notes: i.notes || null,
        })),
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ activeOrdersCount: summary.length, orders: summary }, null, 2),
          },
        ],
      };
    },
  );

  // 2. Simulate Corte X / Z
  server.tool(
    'simulate_corte_caja',
    'Genera un reporte y arqueo simulado de corte de caja (Corte X para arqueo parcial durante el turno, o Corte Z para cierre definitivo de turno).',
    {
      type: z.enum(['x', 'z']).describe('Tipo de corte: "x" (arqueo parcial) o "z" (cierre de turno)'),
      branchName: z.string().optional().describe('Nombre de la sucursal para el encabezado del ticket'),
      cashierName: z.string().optional().describe('Nombre del cajero operador'),
    },
    async ({ type, branchName, cashierName }) => {
      const openedAt = new Date(Date.now() - 1000 * 60 * 60 * 6);
      const generatedAt = new Date();
      const initialFloat = 1000;
      const cashSales = 1840;
      const cardSales = 1265;
      const manualCashIn = 250;
      const manualCashOut = 400;
      const expectedCash = initialFloat + cashSales + manualCashIn - manualCashOut;
      const denominationCounts = { '500': 3, '200': 4, '100': 2, '50': 1, '20': 7 };
      const actualCash = type === 'z'
        ? Object.entries(denominationCounts).reduce((sum, [v, c]) => sum + Number(v) * c, 0)
        : null;
      const cashDifference = actualCash === null ? null : actualCash - expectedCash;

      const report = {
        type: type === 'x' ? 'Corte X - Arqueo Parcial' : 'Corte Z - Cierre de Caja',
        branch: branchName || 'Sucursal Cafetería Centro',
        cashier: cashierName || 'Cajero Operador',
        openedAt: openedAt.toISOString(),
        generatedAt: generatedAt.toISOString(),
        salesSummary: {
          cashSales: `$${cashSales.toFixed(2)}`,
          cardSales: `$${cardSales.toFixed(2)}`,
          totalSales: `$${(cashSales + cardSales).toFixed(2)}`,
        },
        drawerCash: {
          initialFloat: `$${initialFloat.toFixed(2)}`,
          cashSales: `$${cashSales.toFixed(2)}`,
          manualCashIn: `$${manualCashIn.toFixed(2)}`,
          manualCashOut: `$${manualCashOut.toFixed(2)}`,
          expectedInDrawer: `$${expectedCash.toFixed(2)}`,
          actualPhysicalCount: actualCash !== null ? `$${actualCash.toFixed(2)}` : 'N/A (Corte X)',
          difference: cashDifference !== null ? `$${cashDifference.toFixed(2)}` : 'N/A',
        },
        denominations: type === 'z' ? denominationCounts : null,
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
