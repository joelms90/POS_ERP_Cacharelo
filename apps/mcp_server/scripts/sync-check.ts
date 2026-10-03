import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYNC_API_MODULES_DIR = path.resolve(__dirname, '../../sync_api/src/modules');

interface EndpointInfo {
  module: string;
  controller: string;
  method: string;
  path: string;
  fullPath: string;
}

function scanControllers(dir: string): EndpointInfo[] {
  const endpoints: EndpointInfo[] = [];

  function walk(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.controller.ts')) {
        parseController(fullPath, endpoints);
      }
    }
  }

  function parseController(filePath: string, list: EndpointInfo[]) {
    const content = fs.readFileSync(filePath, 'utf8');
    const controllerMatch = content.match(/@Controller\(['"]?([^'")]*)['"]?\)/);
    const controllerPrefix = controllerMatch ? controllerMatch[1] : '';

    const methodRegex = /@(Get|Post|Patch|Put|Delete)\(['"]?([^'")]*)['"]?\)\s*(?:@\w+\([^)]*\)\s*)*(?:async\s+)?(\w+)\s*\(/g;
    let match;

    while ((match = methodRegex.exec(content)) !== null) {
      const httpMethod = match[1].toUpperCase();
      const subPath = match[2];
      const fnName = match[3];

      const cleanSub = subPath ? `/${subPath.replace(/^\//, '')}` : '';
      const fullRoute = `/api/${controllerPrefix}${cleanSub}`.replace(/\/+/g, '/').replace(/\/$/, '');

      list.push({
        module: path.basename(path.dirname(filePath)),
        controller: path.basename(filePath),
        method: httpMethod,
        path: subPath || '/',
        fullPath: fullRoute,
      });
    }
  }

  walk(dir);
  return endpoints;
}

// Known mappings of MCP tools to backend endpoints
const MAPPED_TOOL_PREFIXES: Record<string, string[]> = {
  search_products: ['/api/products'],
  get_product_details: ['/api/products'],
  update_product_price: ['/api/products'],
  get_categories: ['/api/categories'],
  get_stock_alerts: ['/api/inventory/alerts'],
  get_inventory_existence: ['/api/inventory/reports/existence'],
  get_product_kardex: ['/api/inventory/reports/kardex'],
  get_warehouses: ['/api/warehouses'],
  get_active_orders: ['/api/orders/active'],
  simulate_corte_caja: ['/api/reports/daily-sales', '/api/reports/corte'],
  get_branch_tables: ['/api/branches'],
  update_table_state: ['/api/branches'],
  get_kitchen_tickets: ['/api/kitchen/active'],
  update_kitchen_ticket_status: ['/api/kitchen/tickets'],
  get_requisitions: ['/api/requisitions'],
  get_purchase_orders: ['/api/purchase-orders'],
  get_product_recipe_bom: ['/api/assembly/bom'],
  simulate_recipe_depletion: ['/api/assembly/bom'],
};

function main() {
  console.log('===============================================================');
  console.log('  🔄 POS-ERP MCP Server - Backend Synchronization Audit Check');
  console.log('===============================================================\n');

  console.log(`Scanning backend controllers in: ${SYNC_API_MODULES_DIR}`);
  const endpoints = scanControllers(SYNC_API_MODULES_DIR);
  console.log(`Total backend routes detected: ${endpoints.length}\n`);

  const mappedEndpoints = new Set<string>();
  const unmappedEndpoints: EndpointInfo[] = [];

  for (const ep of endpoints) {
    let isCovered = false;
    for (const [toolName, prefixes] of Object.entries(MAPPED_TOOL_PREFIXES)) {
      if (prefixes.some((prefix) => ep.fullPath.startsWith(prefix))) {
        mappedEndpoints.add(`${ep.method} ${ep.fullPath}`);
        isCovered = true;
        break;
      }
    }
    if (!isCovered) {
      unmappedEndpoints.push(ep);
    }
  }

  console.log(`✅ Dedicated MCP Tools Coverage: ${mappedEndpoints.size} endpoints covered`);
  console.log(`⚡ Dynamic Fallback Coverage: ALL ${endpoints.length} endpoints are immediately callable via "call_backend_api"\n`);

  if (unmappedEndpoints.length > 0) {
    console.log('---------------------------------------------------------------');
    console.log('  💡 Candidate Endpoints for Dedicated MCP Tools in Future:');
    console.log('---------------------------------------------------------------');
    
    // Group by module
    const grouped: Record<string, EndpointInfo[]> = {};
    for (const ep of unmappedEndpoints) {
      if (!grouped[ep.module]) grouped[ep.module] = [];
      grouped[ep.module].push(ep);
    }

    for (const [mod, eps] of Object.entries(grouped)) {
      console.log(`\n📦 Módulo [${mod}]:`);
      for (const ep of eps.slice(0, 4)) {
        console.log(`   • ${ep.method.padEnd(6)} ${ep.fullPath}`);
      }
      if (eps.length > 4) {
        console.log(`   ... y ${eps.length - 4} más`);
      }
    }

    console.log('\n===============================================================');
    console.log('  Mecanismo de sincronización:');
    console.log('  1. Cualquier nuevo endpoint puede ser consumido hoy mismo con:');
    console.log('     Tool: call_backend_api({ endpoint: "/nuevo-endpoint" })');
    console.log('  2. Para crear una herramienta especializada, añade la función en');
    console.log('     apps/mcp_server/src/tools/<modulo>.tools.ts');
    console.log('===============================================================\n');
  }
}

main();
