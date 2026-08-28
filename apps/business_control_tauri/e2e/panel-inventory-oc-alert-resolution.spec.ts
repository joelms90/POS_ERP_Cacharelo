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
  return page.evaluate(() => localStorage.getItem('BC-Access-Token') || '');
}

interface AlertLike {
  id: string;
  productId: string;
  productName: string;
  branchId: string | null;
  alertType: string;
  status: string;
}

interface ProductLike {
  id: string;
  providerId?: string;
}

// Find an active GLOBAL alert whose product has a provider, so "Generar OC" succeeds.
async function findTargetAlert(token: string): Promise<AlertLike> {
  const [alertsRes, productsRes] = await Promise.all([
    fetch(`${API_URL}/inventory/alerts?businessId=${BUSINESS_ID}`, {
      headers: { authorization: `Bearer ${token}` },
    }),
    fetch(`${API_URL}/products?businessId=${BUSINESS_ID}`, {
      headers: { authorization: `Bearer ${token}` },
    }),
  ]);

  const alerts = (await alertsRes.json()) as AlertLike[];
  const products = (await productsRes.json()) as ProductLike[];

  const providersByProduct = new Map(products.map((p) => [p.id, p.providerId]));

  const target = alerts.find(
    (a) =>
      a.branchId === null &&
      (a.status === 'active' || a.status === 'acknowledged') &&
      providersByProduct.get(a.productId),
  );

  if (!target) {
    throw new Error('No active global alert with a provider found. Seed data first.');
  }
  return target;
}

async function findDraftPoForProduct(token: string, productId: string): Promise<{ id: string; poNumber: string }> {
  const res = await fetch(`${API_URL}/purchase-orders?businessId=${BUSINESS_ID}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const pos = (await res.json()) as Array<{ id: string; poNumber: string; status: string }>;

  for (const po of pos) {
    if (po.status !== 'draft') continue;
    const detailRes = await fetch(`${API_URL}/purchase-orders/${po.id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const detail = (await detailRes.json()) as { items?: Array<{ productId: string }> };
    if (detail.items?.some((i) => i.productId === productId)) {
      return po;
    }
  }

  throw new Error('Draft purchase order not found for product');
}

test.describe('Panel de Inventario -> OC -> alert resolution', () => {
  test('generating an OC and receiving it clears the inventory alert', async ({ page }) => {
    const token = await login(page);
    const target = await findTargetAlert(token);

    // ── 1. Open Panel de Inventario and see the alert ────────────────────
    await page.locator('aside nav button', { hasText: 'Panel de Inventario' }).click();

    const alertRow = page.locator(`[data-testid="alert-row-${target.id}"]`);
    await expect(alertRow).toBeVisible({ timeout: 15000 });

    // ── 2. Generate the purchase order from the alert ────────────────────
    await page.locator(`[data-testid="alert-generate-oc-${target.id}"]`).click();
    await expect(page.getByText('generada')).toBeVisible({ timeout: 10000 });

    // ── 3. Send the generated OC ─────────────────────────────────────────
    const draftPo = await findDraftPoForProduct(token, target.productId);

    await page.locator('aside nav button', { hasText: 'Órdenes de Compra' }).click();
    const orderRow = page.locator('tr', { hasText: draftPo.poNumber });
    await expect(orderRow).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await orderRow.locator('button', { hasText: 'Enviar' }).click();
    await expect(page.getByText('marcada como enviada')).toBeVisible({ timeout: 10000 });

    // ── 4. Receive the OC ────────────────────────────────────────────────
    await page.locator('aside nav button', { hasText: 'Recepción de Insumos' }).click();

    const poLink = page.locator('[data-testid="receipt-po-link"]');
    await expect(poLink).toBeVisible();
    const poValue = await poLink.locator('option', { hasText: draftPo.poNumber }).getAttribute('value');
    expect(poValue).toBeTruthy();
    await poLink.selectOption(poValue as string);

    await expect(page.getByText(target.productName)).toBeVisible();
    await page.locator('[data-testid="receipt-submit"]').click();
    await expect(page.getByText('Recepción de orden registrada')).toBeVisible({ timeout: 10000 });

    // ── 5. Return to Panel de Inventario: the alert should be gone ───────
    await page.locator('aside nav button', { hasText: 'Panel de Inventario' }).click();
    await expect(page.locator(`[data-testid="alert-row-${target.id}"]`)).toHaveCount(0, { timeout: 15000 });
  });
});
