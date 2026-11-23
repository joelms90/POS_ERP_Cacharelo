import { expect, Page, test } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000/api';

interface Entity {
  id: string;
}

interface Requisition {
  id: string;
  status: string;
}

interface Transfer {
  notes?: string | null;
}

async function login(page: Page): Promise<string> {
  await page.goto('/');
  const passwordInput = page.locator('input[type="password"]');
  if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await page.locator('input[type="email"]').fill(process.env.E2E_ADMIN_EMAIL ?? 'owner@cacharelo.com');
    await passwordInput.fill(process.env.E2E_ADMIN_PASSWORD ?? 'owner123');
    await page.locator('button[type="submit"]').click();
  }
  await expect(page.locator('aside nav')).toBeVisible({ timeout: 15000 });
  return page.evaluate(() => localStorage.getItem('BC-Access-Token') || '');
}

async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init?.headers },
  });
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${path} -> ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

test.describe('Staging requisition rejection', () => {
  // Owner-created requisitions are born authorized, so a pending one is seeded the way
  // the POS creates it: E2E_OIS_TOKEN must be a branch operator JWT (skipped otherwise).
  test('requires a reason and rejects a branch request without generating a stock transfer', async ({ page }) => {
    const oisToken = process.env.E2E_OIS_TOKEN;
    test.skip(!oisToken, 'E2E_OIS_TOKEN (branch operator JWT) is required to create a pending requisition');

    const token = await login(page);
    const businessId = process.env.E2E_BUSINESS_ID ?? await page.locator('header select').inputValue();
    const products = await api<Entity[]>(token, `/products?businessId=${businessId}`);
    expect(products.length).toBeGreaterThan(0);

    const tag = `E2E-STAGING-REJECT-${Date.now()}`;
    const requisition = await api<Requisition>(oisToken!, '/requisitions', {
      method: 'POST',
      body: JSON.stringify({ notes: tag, items: [{ productId: products[0].id, quantityRequested: 0.01 }] }),
    });
    expect(requisition.status).toBe('pending_approval');

    await page.getByRole('button', { name: 'Requisiciones', exact: true }).click();
    await page.getByPlaceholder('Buscar por sucursal...').fill(tag);
    const row = page.locator('tr', { hasText: tag });
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByRole('button', { name: 'Revisar' }).click();

    const modal = page.locator('div.fixed').last();
    await modal.getByRole('button', { name: 'Rechazar', exact: true }).click();
    await expect(page.getByText('Debe proporcionar una razón de rechazo.')).toBeVisible();

    await modal.getByTestId('approval-notes').fill(`${tag} rejected by staging E2E`);
    await modal.getByRole('button', { name: 'Rechazar', exact: true }).click();
    await expect(page.getByText('Requisición rechazada.')).toBeVisible({ timeout: 10000 });

    const rejected = await api<Requisition>(token, `/requisitions/${requisition.id}`);
    expect(rejected.status).toBe('rejected');

    const transfers = await api<Transfer[]>(token, `/inventory/transfers?businessId=${businessId}`);
    expect(transfers.some((transfer) => transfer.notes?.includes(tag))).toBe(false);
  });
});
