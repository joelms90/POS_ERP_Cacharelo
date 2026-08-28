import { test, expect, Page } from '@playwright/test';

const API_URL = 'http://localhost:3000/api';
const BUSINESS_ID = 'd3b07384-d113-4a0e-a555-e5b12824bf01';

async function login(page: Page): Promise<string> {
  await page.goto('/');

  const passwordInput = page.locator('input[type="password"]');
  if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill('owner@cacharelo.com');
    }
    await passwordInput.fill('owner123');
    await page.locator('button[type="submit"]').click();
  }

  await expect(page.locator('aside nav')).toBeVisible({ timeout: 15000 });

  // Extract the JWT access token for direct API verification
  return page.evaluate(() => localStorage.getItem('BC-Access-Token') || '');
}

async function getStock(token: string, productId: string, warehouseId: string): Promise<number> {
  const res = await fetch(`${API_URL}/inventory/stock?businessId=${BUSINESS_ID}&warehouseId=${warehouseId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const rows = await res.json() as Array<{ productId: string; quantity: string }>;
  const row = rows.find((r) => r.productId === productId);
  return row ? parseFloat(row.quantity) : 0;
}

test.describe('Purchase Order -> Reception -> Inventory flow', () => {
  test('creates an OC, sends it, receives it, and inventory increases', async ({ page }) => {
    const token = await login(page);

    // Pick the first warehouse and first product via API to verify inventory delta
    const warehouses = await (await fetch(`${API_URL}/warehouses?businessId=${BUSINESS_ID}`, {
      headers: { authorization: `Bearer ${token}` },
    })).json() as Array<{ id: string; name: string }>;
    const products = await (await fetch(`${API_URL}/products?businessId=${BUSINESS_ID}`, {
      headers: { authorization: `Bearer ${token}` },
    })).json() as Array<{ id: string; name: string }>;

    expect(warehouses.length).toBeGreaterThan(0);
    expect(products.length).toBeGreaterThan(0);

    const warehouse = warehouses[0];
    const product = products[0];
    const receiveQty = 3;

    const initialStock = await getStock(token, product.id, warehouse.id);

    // ── Step 1: Create the purchase order ────────────────────────────────
    await page.locator('aside nav button', { hasText: 'Órdenes de Compra' }).click();
    await page.locator('button', { hasText: '+ Nueva Orden' }).click();

    const orderNumber = `E2E-${Date.now()}`;
    await page.locator('[data-testid="po-order-number"]').fill(orderNumber);
    await page.locator('[data-testid="po-provider"]').selectOption({ index: 1 });
    await page.locator('[data-testid="po-warehouse"]').selectOption(warehouse.id);

    // Select the product through the autocomplete (type name then click option)
    const productSearch = page.getByPlaceholder('Buscar insumo o producto...');
    await productSearch.click();
    await productSearch.fill(product.name);
    await page.locator('ul li', { hasText: product.name }).first().click();

    await page.locator('[data-testid="po-quantity"]').fill(String(receiveQty));
    await page.locator('[data-testid="po-cost"]').fill('10');
    await page.locator('button', { hasText: '+ Agregar Insumo' }).click();

    await page.locator('button', { hasText: 'Crear Orden' }).click();
    await expect(page.getByText('creada exitosamente')).toBeVisible({ timeout: 10000 });

    // ── Step 2: Mark as sent ─────────────────────────────────────────────
    const orderRow = page.locator('tr', { hasText: orderNumber });
    await expect(orderRow).toBeVisible();

    // Accept the confirm() dialog
    page.once('dialog', (dialog) => dialog.accept());
    await orderRow.locator('button', { hasText: 'Enviar' }).click();
    await expect(page.getByText('marcada como enviada')).toBeVisible({ timeout: 10000 });

    // Status badge should now read "Enviada"
    await expect(orderRow.getByText('Enviada')).toBeVisible();

    // ── Step 3: Receive the merchandise ──────────────────────────────────
    await page.locator('aside nav button', { hasText: 'Recepción de Insumos' }).click();

    const poLink = page.locator('[data-testid="receipt-po-link"]');
    await expect(poLink).toBeVisible();

    // Select the PO we just created by its order number
    const poValue = await poLink.locator('option', { hasText: orderNumber }).getAttribute('value');
    expect(poValue).toBeTruthy();
    await poLink.selectOption(poValue as string);

    // Items should be pre-filled (pending quantities)
    await expect(page.getByText(product.name)).toBeVisible();

    // Register the reception
    await page.locator('[data-testid="receipt-submit"]').click();
    await expect(page.getByText('Recepción de orden registrada')).toBeVisible({ timeout: 10000 });

    // ── Verify inventory increased ───────────────────────────────────────
    const finalStock = await getStock(token, product.id, warehouse.id);
    expect(finalStock).toBe(initialStock + receiveQty);

    // ── Verify the OC is now "Recibida" ──────────────────────────────────
    await page.locator('aside nav button', { hasText: 'Órdenes de Compra' }).click();
    const receivedRow = page.locator('tr', { hasText: orderNumber });
    await expect(receivedRow.getByText('Recibida')).toBeVisible();
  });
});
