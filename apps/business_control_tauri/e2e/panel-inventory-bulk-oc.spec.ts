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
  branchId: string | null;
  status: string;
}
interface ProductLike {
  id: string;
  providerId?: string;
}

test.describe('Panel de Inventario — bulk OC from selection', () => {
  test('selects multiple alerts and generates one OC with several products', async ({ page }) => {
    const token = await login(page);

    // Find global alerts whose products have providers
    const [alerts, products] = await Promise.all([
      fetch(`${API_URL}/inventory/alerts?businessId=${BUSINESS_ID}`, {
        headers: { authorization: `Bearer ${token}` },
      }).then((r) => r.json() as Promise<AlertLike[]>),
      fetch(`${API_URL}/products?businessId=${BUSINESS_ID}`, {
        headers: { authorization: `Bearer ${token}` },
      }).then((r) => r.json() as Promise<ProductLike[]>),
    ]);

    const providersByProduct = new Map(products.map((p) => [p.id, p.providerId]));
    const targets = alerts.filter(
      (a) =>
        a.branchId === null &&
        a.status !== 'resolved' &&
        providersByProduct.get(a.productId),
    );

    expect(targets.length).toBeGreaterThanOrEqual(2);
    const selected = targets.slice(0, 2);

    // Open the panel and select the two alerts
    await page.locator('aside nav button', { hasText: 'Panel de Inventario' }).click();

    for (const alert of selected) {
      const checkbox = page.locator(`[data-testid="alert-select-${alert.id}"]`);
      await expect(checkbox).toBeVisible({ timeout: 15000 });
      await checkbox.click();
    }

    const bulkButton = page.locator('[data-testid="alert-bulk-generate-oc"]');
    await expect(bulkButton).toContainText(`Generar OC (${selected.length})`);

    await bulkButton.click();
    await expect(page.getByText('Se generaron')).toBeVisible({ timeout: 10000 });

    // Verify draft POs contain the selected products
    const pos = await fetch(`${API_URL}/purchase-orders?businessId=${BUSINESS_ID}`, {
      headers: { authorization: `Bearer ${token}` },
    }).then((r) => r.json() as Promise<Array<{ id: string; status: string }>>);

    const selectedProductIds = new Set(selected.map((a) => a.productId));
    let found = 0;
    for (const po of pos.filter((p) => p.status === 'draft')) {
      const detail = await fetch(`${API_URL}/purchase-orders/${po.id}`, {
        headers: { authorization: `Bearer ${token}` },
      }).then((r) => r.json() as Promise<{ items?: Array<{ productId: string }> }>);
      for (const item of detail.items ?? []) {
        if (selectedProductIds.has(item.productId)) found++;
      }
    }
    expect(found).toBeGreaterThanOrEqual(selected.length);

    // Cleanup: delete the draft POs created for these products
    for (const po of pos.filter((p) => p.status === 'draft')) {
      const detail = await fetch(`${API_URL}/purchase-orders/${po.id}`, {
        headers: { authorization: `Bearer ${token}` },
      }).then((r) => r.json() as Promise<{ items?: Array<{ productId: string }> }>);
      if (detail.items?.some((i) => selectedProductIds.has(i.productId))) {
        await fetch(`${API_URL}/purchase-orders/${po.id}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${token}` },
        });
      }
    }
  });
});
