import { test, expect } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
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
}

async function openProductForm(page: import('@playwright/test').Page) {
  const productsButton = page.locator('aside nav button', { hasText: 'Productos' });
  await productsButton.click();
  await page.locator('button', { hasText: 'Nuevo Producto' }).click();
}

test.describe('Product Creation — New Inventory Model', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should expose the new inventory model fields in the product form', async ({ page }) => {
    await openProductForm(page);

    await expect(page.locator('label', { hasText: 'Tipo de Artículo' })).toBeVisible();
    await expect(page.locator('label', { hasText: 'Estrategia de Producción' })).toBeVisible();
    await expect(page.locator('label', { hasText: 'Unidad de Medida' })).toBeVisible();

    // The new fields should be selects with the expected options
    const itemType = page.locator('[data-testid="product-item-type"]');
    await expect(itemType).toBeVisible();
    await expect(itemType.locator('option')).toHaveCount(4);

    const productionStrategy = page.locator('[data-testid="product-production-strategy"]');
    await expect(productionStrategy).toBeVisible();
    await expect(productionStrategy.locator('option')).toHaveCount(3);

    const uom = page.locator('[data-testid="product-uom"]');
    await expect(uom).toBeVisible();
    await expect(uom.locator('option')).toHaveCount(5);
  });

  test('should create a raw material using the new inventory model fields', async ({ page }) => {
    await openProductForm(page);

    const productName = `Test Insumo ${Date.now()}`;

    await page.locator('[data-testid="product-name"]').fill(productName);
    await page.locator('[data-testid="product-category"]').selectOption({ index: 1 });
    await page.locator('[data-testid="product-price"]').fill('25.50');
    await page.locator('[data-testid="product-item-type"]').selectOption('raw_material');
    await page.locator('[data-testid="product-production-strategy"]').selectOption('none');
    await page.locator('[data-testid="product-uom"]').selectOption('kg');

    // Provider selector should appear for raw materials
    await expect(page.locator('label', { hasText: 'Proveedor Principal' })).toBeVisible();

    await page.locator('[data-testid="product-submit"]').click();

    // Success toast should appear
    await expect(page.getByText('registrado con éxito')).toBeVisible({ timeout: 10000 });

    // The product should appear in the catalog list
    const searchInput = page.locator('input[placeholder*="Buscar por nombre"]');
    await searchInput.fill(productName);
    await expect(page.locator('text=' + productName).first()).toBeVisible();
  });

  test('should create a finished good with backflush strategy', async ({ page }) => {
    await openProductForm(page);

    const productName = `Test Producto ${Date.now()}`;

    await page.locator('[data-testid="product-name"]').fill(productName);
    await page.locator('[data-testid="product-category"]').selectOption({ index: 1 });
    await page.locator('[data-testid="product-price"]').fill('60.00');
    await page.locator('[data-testid="product-item-type"]').selectOption('finished_good');
    await page.locator('[data-testid="product-production-strategy"]').selectOption('backflush');
    await page.locator('[data-testid="product-uom"]').selectOption('piece');

    // Provider selector should NOT appear for finished goods
    await expect(page.locator('label', { hasText: 'Proveedor Principal' })).not.toBeVisible();

    await page.locator('[data-testid="product-submit"]').click();
    await expect(page.getByText('registrado con éxito')).toBeVisible({ timeout: 10000 });
  });
});
