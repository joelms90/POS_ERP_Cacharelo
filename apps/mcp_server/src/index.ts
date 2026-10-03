import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config } from './config.js';
import { PosApiClient } from './client.js';
import { registerAllTools } from './registry.js';

async function main() {
  const server = new McpServer({
    name: config.serverName,
    version: config.serverVersion,
  });

  const client = new PosApiClient(config.apiUrl, config.adminToken);

  const registeredCount = registerAllTools(server, client);

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Send diagnostic notice to stderr (so it doesn't pollute stdout JSON-RPC)
  console.error(`[POS-ERP MCP Server] Running v${config.serverVersion}`);
  console.error(`[POS-ERP MCP Server] Target API: ${config.apiUrl}`);
  console.error(`[POS-ERP MCP Server] Registered Tools: ${registeredCount}`);
  console.error(`[POS-ERP MCP Server] Stdio transport connected successfully.`);
}

main().catch((err) => {
  console.error('[POS-ERP MCP Server] Fatal error:', err);
  process.exit(1);
});
