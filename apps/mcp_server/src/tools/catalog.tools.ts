import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PosApiClient } from '../client.js';
import { config } from '../config.js';

export function registerCatalogTools(server: McpServer, client: PosApiClient) {
  // 1. Search products
  server.tool(
    'search_products',
    'Busca productos en el catálogo por nombre, SKU, código de barras o categoría. Devuelve precios, códigos y tipo de artículo.',
    {
      search: z.string().optional().describe('Texto de búsqueda para filtrar por nombre o código'),
      categoryId: z.string().optional().describe('ID de la categoría para filtrar'),
      isSellable: z.boolean().optional().describe('Filtrar si el producto es vendible en POS (true) o insumo (false)'),
      businessId: z.string().optional().describe('ID del negocio (opcional, usa el predeterminado si se omite)'),
    },
    async ({ search, categoryId, isSellable, businessId }) => {
      const bId = businessId || config.defaultBusinessId;
      const products = await client.getProducts(bId, { search, categoryId, isSellable });

      const summary = products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        cost: p.cost,
        sku: p.sku || null,
        barcode: p.barcode || null,
        categoryId: p.categoryId,
        itemType: p.itemType || 'finished_good',
        isActive: p.isActive !== false,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ total: summary.length, products: summary }, null, 2),
          },
        ],
      };
    },
  );

  // 2. Get product details
  server.tool(
    'get_product_details',
    'Obtiene el detalle completo de un producto por su ID (precios, códigos, receta BOM si aplica).',
    {
      productId: z.string().describe('ID único del producto'),
    },
    async ({ productId }) => {
      const product = await client.getProductById(productId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(product, null, 2),
          },
        ],
      };
    },
  );

  // 3. Get categories
  server.tool(
    'get_categories',
    'Obtiene la lista de categorías del catálogo con su estación KDS asignada (cocina, barra o sin estación).',
    {
      businessId: z.string().optional().describe('ID del negocio (opcional)'),
    },
    async ({ businessId }) => {
      const bId = businessId || config.defaultBusinessId;
      const categories = await client.getCategories(bId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ total: categories.length, categories }, null, 2),
          },
        ],
      };
    },
  );
}
