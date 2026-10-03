import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PosApiClient } from './client.js';
import { registerCatalogTools } from './tools/catalog.tools.js';
import { registerInventoryTools } from './tools/inventory.tools.js';
import { registerSalesTools } from './tools/sales.tools.js';
import { registerPosTools } from './tools/pos.tools.js';
import { registerPurchasingTools } from './tools/purchasing.tools.js';
import { registerProductionTools } from './tools/production.tools.js';
import { registerSystemTools } from './tools/system.tools.js';

export function registerAllTools(server: McpServer, client: PosApiClient) {
  let toolCount = 0;

  // Wrap server.tool to count registered tools accurately
  const originalTool = server.tool.bind(server);
  (server as any).tool = (...args: any[]) => {
    toolCount++;
    return (originalTool as any)(...args);
  };

  registerCatalogTools(server, client);
  registerInventoryTools(server, client);
  registerSalesTools(server, client);
  registerPosTools(server, client);
  registerPurchasingTools(server, client);
  registerProductionTools(server, client);
  registerSystemTools(server, client, () => toolCount);

  // Restore
  (server as any).tool = originalTool;

  return toolCount;
}
