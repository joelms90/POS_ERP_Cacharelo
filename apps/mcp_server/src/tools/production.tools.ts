import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PosApiClient } from '../client.js';

export function registerProductionTools(server: McpServer, client: PosApiClient) {
  // 1. Get BOM / Recipe
  server.tool(
    'get_product_recipe_bom',
    'Consulta la receta o lista de materiales (Bill of Materials - BOM) de un platillo o producto terminado.',
    {
      productId: z.string().describe('ID del producto terminado para ver sus ingredientes y cantidades de receta'),
    },
    async ({ productId }) => {
      const bom = await client.getBomRecipe(productId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(bom, null, 2),
          },
        ],
      };
    },
  );

  // 2. Simulate Production Ingredient Depletion
  server.tool(
    'simulate_recipe_depletion',
    'Calcula la cantidad total de insumos necesarios para producir N unidades de un platillo basándose en su receta.',
    {
      productId: z.string().describe('ID del platillo o producto terminado'),
      quantity: z.number().positive().describe('Número de unidades a simular en producción'),
    },
    async ({ productId, quantity }) => {
      const bom = await client.getBomRecipe(productId);
      const items = Array.isArray(bom) ? bom : bom?.items || [];

      const requiredIngredients = items.map((item: any) => {
        const unitQty = Number(item.quantity || item.unitQuantity || 0);
        return {
          ingredientId: item.ingredientId || item.productId,
          ingredientName: item.ingredientName || item.productName || 'Insumo',
          unitQuantity: unitQty,
          uom: item.uom || 'unidad',
          totalRequired: unitQty * quantity,
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              productId,
              unitsToProduce: quantity,
              ingredientsDepletion: requiredIngredients,
            }, null, 2),
          },
        ],
      };
    },
  );
}
