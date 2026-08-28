import { test, expect, Page } from '@playwright/test';

const API_URL = 'http://localhost:3000/api';
const BUSINESS_ID = 'd3b07384-d113-4a0e-a555-e5b12824bf03'; // Empanadas

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

interface ProductLike {
  id: string;
  name: string;
}
interface BranchLike {
  id: string;
  name: string;
}
interface StockRow {
  productId: string;
  branchId: string | null;
  quantity: string;
}

async function apiGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

async function apiPost(token: string, path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

test.describe('Sucursal out-of-stock -> requisition flow (Empanadas)', () => {
  test('a branch below its threshold triggers an alert and generates a requisition', async ({ page }) => {
    const token = await login(page);

    // ── Setup: pick a branch and a product with no branch stock, then set a threshold ──
    const branches = await apiGet<BranchLike[]>(token, `/branches?businessId=${BUSINESS_ID}`);
    const products = await apiGet<ProductLike[]>(token, `/products?businessId=${BUSINESS_ID}`);
    const stock = await apiGet<StockRow[]>(token, `/inventory/stock?businessId=${BUSINESS_ID}`);

    expect(branches.length).toBeGreaterThan(0);
    expect(products.length).toBeGreaterThan(0);

    const branch = branches[0];

    // Pick a product that has no stock at this branch (so it's clearly out of stock there)
    const product =
      products.find(
        (p) => !stock.some((s) => s.productId === p.id && s.branchId === branch.id),
      ) ?? products[0];

    await apiPost(token, '/inventory/thresholds', {
      businessId: BUSINESS_ID,
      productId: product.id,
      branchId: branch.id,
      minStock: 5,
      maxStock: 20,
    });

    // Run the alert engine deterministically so the branch alert exists before the UI check
    await apiPost(token, '/inventory/alerts/refresh', { businessId: BUSINESS_ID });

    const alerts = await apiGet<
      Array<{ id: string; productId: string; branchId: string | null; alertType: string; status: string }>
    >(token, `/inventory/alerts?businessId=${BUSINESS_ID}`);

    const alert = alerts.find(
      (a) => a.productId === product.id && a.branchId === branch.id && a.status !== 'resolved',
    );
    expect(alert).toBeTruthy();

    // ── Switch to the Empanadas business and open the Panel de Inventario ──
    await page.locator('header select').selectOption(BUSINESS_ID);
    await page.locator('aside nav button', { hasText: 'Panel de Inventario' }).click();

    // ── The alert should be visible in the panel with the requisition action ──
    const alertRow = page.locator(`[data-testid="alert-row-${alert!.id}"]`);
    await expect(alertRow).toBeVisible({ timeout: 15000 });
    await expect(alertRow.getByText('Requisición sugerida')).toBeVisible();

    // ── Generate the requisition ──
    await page.locator(`[data-testid="alert-generate-req-${alert!.id}"]`).click();
    await expect(page.getByText('Requisición generada')).toBeVisible({ timeout: 10000 });

    // ── Verify a pending requisition now exists for this branch ──
    const requisitions = await apiGet<
      Array<{ id: string; fromBranchId: string; status: string }>
    >(token, `/requisitions?businessId=${BUSINESS_ID}`);

    const requisition = requisitions.find(
      (r) => r.fromBranchId === branch.id && r.status === 'pending',
    );
    expect(requisition).toBeTruthy();
  });
});
