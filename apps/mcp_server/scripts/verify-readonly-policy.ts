import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const directory = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(directory, '../src');
const source = (name: string) => readFileSync(resolve(sourceRoot, name), 'utf8');

const client = source('client.ts');
const systemTools = source('tools/system.tools.ts');
const catalogTools = source('tools/catalog.tools.ts');
const posTools = source('tools/pos.tools.ts');

const forbidden = [
  ['generic request API', 'async request<'],
  ['raw backend passthrough', 'rawRequest'],
  ['admin token header', 'X-Admin-Token'],
  ['JWT signing', 'jwt.sign'],
  ['write HTTP method', "method: 'PATCH'"],
  ['write HTTP method', "method: 'POST'"],
];

for (const [label, needle] of forbidden) {
  if (client.includes(needle)) throw new Error(`Read-only policy violated: ${label}`);
}

for (const [label, content, needle] of [
  ['dynamic tool', systemTools, 'call_backend_api'],
  ['catalog write tool', catalogTools, 'update_product_price'],
  ['POS write tool', posTools, 'update_table_state'],
  ['KDS write tool', posTools, 'update_kitchen_ticket_status'],
] as const) {
  if (content.includes(needle)) throw new Error(`Read-only policy violated: ${label}`);
}

if (!client.includes('private async get<')) {
  throw new Error('Read-only policy violated: HTTP GET must remain private to typed adapters.');
}

console.log('Read-only MCP policy verified.');
