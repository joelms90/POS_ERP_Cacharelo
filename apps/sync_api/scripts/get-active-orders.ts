import http from 'http';
import https from 'https';

const DEFAULT_BRANCH_ID = '91ce10b2-94c1-45e0-baf3-9485eae01fbf';
const API_BASE_URL = process.env.API_URL || 'https://pos-sync-api-232144991863.us-central1.run.app/api';

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function getBranchSummary() {
  const branchId = process.argv[2] || DEFAULT_BRANCH_ID;
  console.log(`\n======================================================`);
  console.log(`  📊 POS-ERP: DESGLOSE DE MESAS Y CUENTAS ACTIVAS`);
  console.log(`  Sucursal ID: ${branchId}`);
  console.log(`  Fecha/Hora:  ${new Date().toLocaleString('es-MX')}`);
  console.log(`======================================================\n`);

  try {
    const [tables, products, activeOrders] = await Promise.all([
      fetchJson(`${API_BASE_URL}/branches/${branchId}/tables`),
      fetchJson(`${API_BASE_URL}/products`),
      fetchJson(`${API_BASE_URL}/orders/active?branchId=${branchId}`),
    ]);

    const productMap = new Map<string, string>();
    if (Array.isArray(products)) {
      products.forEach((p: any) => productMap.set(p.id, p.name));
    }

    const tableMap = new Map<string, any>();
    if (Array.isArray(tables)) {
      tables.forEach((t: any) => tableMap.set(t.id, t));
    }

    if (!Array.isArray(activeOrders) || activeOrders.length === 0) {
      console.log(`ℹ️  No hay órdenes ni cuentas abiertas actualmente en esta sucursal.\n`);
    } else {
      let grandTotalItems = 0;
      let grandTotalDb = 0;

      activeOrders.forEach((order: any, idx: number) => {
        const table = tableMap.get(order.tableId);
        const tableLabel = table ? `${table.label} (${table.room || 'Salón'})` : order.tableId;

        let itemsSum = 0;

        console.log(`🔴 [MESA #${idx + 1}] ${tableLabel}`);
        console.log(`   ID Orden: ${order.id}`);
        console.log(`   Mesero:   ${order.waiterId || 'No asignado'}`);
        console.log(`   ---------------------------------------------------`);
        console.log(`   Cant. | Artículo                             | Precio Unit. | Importe`);
        console.log(`   ---------------------------------------------------`);

        if (Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            const pName = productMap.get(item.productId) || item.productId;
            const unitPrice = parseFloat(item.price || '0');
            const qty = parseInt(item.quantity || 1, 10);
            const lineTotal = unitPrice * qty;
            itemsSum += lineTotal;

            const notes = item.notes ? `  [Nota: ${item.notes}]` : '';
            const qtyStr = `${qty}x`.padEnd(5);
            const nameStr = pName.padEnd(36).substring(0, 36);
            const unitStr = `$${unitPrice.toFixed(2).padStart(6)}`;
            const lineStr = `$${lineTotal.toFixed(2).padStart(7)}`;
            console.log(`   ${qtyStr} | ${nameStr} | ${unitStr} | ${lineStr}${notes}`);
          });
        }

        const dbSubtotal = parseFloat(order.subtotal || '0');
        const dbTax = parseFloat(order.tax || '0');
        const dbTotal = parseFloat(order.total || '0');

        grandTotalItems += itemsSum;
        grandTotalDb += dbTotal;

        console.log(`   ---------------------------------------------------`);
        console.log(`   💵 SUMA DE ARTÍCULOS: $${itemsSum.toFixed(2)}`);
        console.log(`   📋 Datos Orden BD: Subtotal: $${dbSubtotal.toFixed(2)} | IVA: $${dbTax.toFixed(2)} | Total BD: $${dbTotal.toFixed(2)}\n`);
      });

      console.log(`======================================================`);
      console.log(` 💰 SUMA DE ARTÍCULOS EN MESAS: $${grandTotalItems.toFixed(2)}`);
      console.log(` 📋 TOTAL REGISTRADO EN BD:     $${grandTotalDb.toFixed(2)}`);
      console.log(`======================================================\n`);
    }

    // Print Tables Summary Status
    if (Array.isArray(tables)) {
      const free = tables.filter((t: any) => t.state === 'free').length;
      const occupied = tables.filter((t: any) => t.state === 'occupied').length;
      const cleaning = tables.filter((t: any) => t.state === 'cleaning').length;
      console.log(`📌 Resumen de Mesas (${tables.length} Total):`);
      console.log(`   🟢 Libres: ${free}  |  🔴 Ocupadas: ${occupied}  |  🧹 En Limpieza: ${cleaning}\n`);
    }
  } catch (e) {
    console.error(`❌ Error al consultar la información de la sucursal:`, e);
  }
}

getBranchSummary();
