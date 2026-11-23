import dotenv from 'dotenv';

// Load .env from current directory or monorepo root if present
dotenv.config();

export interface ServerConfig {
  apiUrl: string;
  accessToken: string;
  defaultBusinessId: string;
  serverName: string;
  serverVersion: string;
}

export const config: ServerConfig = {
  apiUrl: process.env.POS_API_URL || 'http://localhost:3000/api',
  // A short-lived JWT obtained by the actual owner. Never use an admin token
  // or JWT signing secret in this local process.
  accessToken: process.env.POS_MCP_ACCESS_TOKEN || '',
  defaultBusinessId: process.env.POS_DEFAULT_BUSINESS_ID || 'd3b07384-d113-4a0e-a555-e5b12824bf01',
  serverName: 'pos-erp-mcp-server',
  serverVersion: '1.0.0',
};

export function assertPrivateReadOnlyConfig(serverConfig = config): void {
  if (!serverConfig.accessToken) {
    throw new Error('POS_MCP_ACCESS_TOKEN es obligatorio. Usa un JWT vigente de un propietario; nunca configures secretos de firma ni tokens administrativos.');
  }

  const url = new URL(serverConfig.apiUrl);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('POS_API_URL debe usar HTTPS fuera de localhost.');
  }
}
