import dotenv from 'dotenv';

// Load .env from current directory or monorepo root if present
dotenv.config();

export interface ServerConfig {
  apiUrl: string;
  adminToken: string;
  jwtSecret: string;
  defaultBusinessId: string;
  serverName: string;
  serverVersion: string;
}

export const config: ServerConfig = {
  apiUrl: process.env.POS_API_URL || 'http://localhost:3001/api',
  adminToken: process.env.POS_ADMIN_TOKEN || 'admin123',
  jwtSecret: process.env.POS_JWT_SECRET || process.env.JWT_SECRET || 'dev_jwt_secret_key',
  defaultBusinessId: process.env.POS_DEFAULT_BUSINESS_ID || 'd3b07384-d113-4a0e-a555-e5b12824bf01',
  serverName: 'pos-erp-mcp-server',
  serverVersion: '1.0.0',
};
