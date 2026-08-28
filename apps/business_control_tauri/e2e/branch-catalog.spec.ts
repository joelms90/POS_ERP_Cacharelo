import { test, expect, Page } from '@playwright/test';

const API_URL = 'http://localhost:3000/api';
const BUSINESS_ID = 'd3b07384-d113-4a0e-a555-e5b12824bf01'; // Cafetería Cacharelo

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
  isSellable: boolean;
}
interface BranchLike {
  id: string;
  name: string;
}
interface BranchCatalogEntryLike {
  id: string;
  productId: string;
  isSellable: boolean;
}

async function apiGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

async function apiDelete(token: string, path: string) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`DELETE ${path} -> ${res.status}`);
  return res.json();
}

test.describe('Catálogo por Sucursal (per-branch sellable catalog)', () => {
  test('makes an insumo sellable at a specific branch', async ({ page }) => {
    const token = await login(page);

    const branches = await apiGet<BranchLike[]>(token, `/branches?businessId=${BUSINESS_ID}`);
    expect(branches.length).toBeGreaterThan(0);
    const branch = branches[0];

    // Find an insumo that is NOT sellable globally and has no override for this branch
    const products = await apiGet<ProductLike[]>(token, `/products?businessId=${BUSINESS_ID}`);
    const existingOverrides = await apiGet<BranchCatalogEntryLike[]>(
      token,
      `/branch-catalog?branchId=${branch.id}`,
    );
    const overriddenIds = new Set(existingOverrides.map((o) => o.productId));
    const insumo = products.find((p) => p.isSellable === false && !overriddenIds.has(p.id));
    expect(insumo).toBeTruthy();

    // Open the Catálogo por Sucursal page
    await page.locator('aside nav button', { hasText: 'Catálogo por Sucursal' }).click();
    await page.locator('[data-testid="catalog-search"]').fill(insumo!.name);

    const toggle = page.locator(`[data-testid="catalog-toggle-${insumo!.id}"]`);
    await expect(toggle).toBeVisible({ timeout: 15000 });
    await expect(toggle).not.toBeChecked();

    // Make it sellable at this branch (controlled checkbox -> use click, then wait for reload)
    await toggle.click();

    // The override should now be reflected with a "Personalizado" badge
    await expect(
      page.locator(`[data-testid="catalog-row-${insumo!.id}"]`).getByText('Personalizado'),
    ).toBeVisible({ timeout: 10000 });

    // Verify the branch-aware products endpoint now reports it as sellable
    const branchProducts = await apiGet<ProductLike[]>(
      token,
      `/products?businessId=${BUSINESS_ID}&branchId=${branch.id}`,
    );
    const updated = branchProducts.find((p) => p.id === insumo!.id);
    expect(updated?.isSellable).toBe(true);

    // Cleanup: remove the override
    const overrides = await apiGet<BranchCatalogEntryLike[]>(
      token,
      `/branch-catalog?branchId=${branch.id}`,
    );
    const override = overrides.find((o) => o.productId === insumo!.id);
    if (override) {
      await apiDelete(token, `/branch-catalog/${override.id}`);
    }
  });
});
