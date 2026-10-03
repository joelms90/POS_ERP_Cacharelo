import { PosApiClient } from '../src/client.js';
import { config } from '../src/config.js';

async function verify() {
  console.log('======================================================');
  console.log('  🔍 POS-ERP MCP Server - Diagnostic Tool Verification');
  console.log('======================================================');
  console.log(`Target Backend: ${config.apiUrl}`);
  console.log(`Default Business: ${config.defaultBusinessId}\n`);

  const client = new PosApiClient(config.apiUrl, config.adminToken);
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<any>) {
    process.stdout.write(`• Checking ${name}... `);
    try {
      const res = await fn();
      passed++;
      console.log('✅ OK');
      return res;
    } catch (err: any) {
      failed++;
      console.log(`❌ FAILED: ${err.message}`);
      return null;
    }
  }

  // 1. Backend Health
  await test('Backend Health (/health)', () => client.getHealth());

  // 2. Catalog Products
  const prods = await test('Products Catalog (/products)', () =>
    client.getProducts(config.defaultBusinessId),
  );
  if (prods) console.log(`   └─ Found ${prods.length} products`);

  // 3. Categories
  const cats = await test('Categories Catalog (/categories)', () =>
    client.getCategories(config.defaultBusinessId),
  );
  if (cats) console.log(`   └─ Found ${cats.length} categories`);

  // 4. Warehouses
  const warehouses = await test('Warehouses (/warehouses)', () =>
    client.getWarehouses(config.defaultBusinessId),
  );
  if (warehouses) console.log(`   └─ Found ${warehouses.length} warehouses`);

  // 5. Stock Alerts
  const alerts = await test('Stock Alerts (/inventory/alerts)', () =>
    client.getStockAlerts(config.defaultBusinessId),
  );
  if (alerts) console.log(`   └─ Found ${alerts.length} active alerts`);

  // 6. Branches
  const branches = await test('Branches (/branches)', () =>
    client.getBranches(config.defaultBusinessId),
  );
  if (branches && branches.length > 0) {
    const firstBranch = branches[0];
    console.log(`   └─ Active Branch: "${firstBranch.name}" (${firstBranch.id})`);

    // 7. Branch Tables
    const tables = await test(`Tables for ${firstBranch.name}`, () =>
      client.getTables(firstBranch.id),
    );
    if (tables) console.log(`   └─ Found ${tables.length} tables`);

    // 8. Active Orders
    const orders = await test(`Active Orders for ${firstBranch.name}`, () =>
      client.getActiveOrders(firstBranch.id),
    );
    if (orders) console.log(`   └─ Found ${orders.length} open orders`);
  }

  // 9. Requisitions
  const reqs = await test('Requisitions (/requisitions)', () =>
    client.getRequisitions(config.defaultBusinessId),
  );
  if (reqs) console.log(`   └─ Found ${reqs.length} requisitions`);

  console.log('\n======================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

verify().catch(console.error);
