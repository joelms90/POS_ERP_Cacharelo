import { test, expect } from '@playwright/test';

test.describe('Admin Console E2E Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to local admin app
    await page.goto('/');

    // Check if on login screen
    const passwordInput = page.locator('input[type="password"]');
    if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      const emailInput = page.locator('input[type="email"]');
      if (await emailInput.isVisible()) {
        await emailInput.fill('owner@cacharelo.com');
      }
      await passwordInput.fill('owner123');
      await page.locator('button[type="submit"]').click();
    }

    // Wait until admin shell layout is visible
    await expect(page.locator('aside nav')).toBeVisible({ timeout: 15000 });
  });

  test('should login and navigate to all navigation sections without error', async ({ page }) => {
    const sections = [
      { name: 'Administradores', id: 'administrators' },
      { name: 'Personal (PINs)', id: 'personal' },
      { name: 'Sucursales', id: 'branches' },
      { name: 'Ticket Fiscal', id: 'ticket-settings' },
      { name: 'Simulador POS', id: 'pos-simulator' },
      { name: 'Consultas Web', id: 'inquiries' },
      { name: 'Tickets del Día', id: 'tickets' },
      { name: 'Mesas Activas', id: 'mesas' },
      { name: 'Productos', id: 'inventory' },
      { name: 'Categorías', id: 'categories' },
      { name: 'Producción (Recetas)', id: 'assembly' },
      { name: 'Recepción de Insumos', id: 'receipts' },
      { name: 'Bodegas (Almacén)', id: 'warehouses' },
      { name: 'Proveedores', id: 'providers' },
      { name: 'Traspasos y Reportes', id: 'transfers' },
      { name: 'Órdenes de Compra', id: 'purchase-orders' },
      { name: 'Requisiciones', id: 'requisitions' },
      { name: 'Reportes de Venta', id: 'reports' },
      { name: 'Guía y Manual (FAQ)', id: 'help' },
    ];

    for (const section of sections) {
      console.log(`Testing navigation to: ${section.name}`);
      
      const navButton = page.locator('aside nav button', { hasText: section.name });
      await expect(navButton).toBeVisible();
      await navButton.click();

      // Give page time to render its content
      await page.waitForTimeout(300);

      // Verify no global unhandled system error occurred
      const systemError = page.locator('text=[Error de Sistema]');
      await expect(systemError).not.toBeVisible();

      // Verify main content container is not empty
      const mainContent = page.locator('main');
      await expect(mainContent).toBeVisible();
      const contentText = await mainContent.textContent();
      expect(contentText?.trim().length).toBeGreaterThan(0);
    }
  });

  test('should switch businesses and retain navigation functionality', async ({ page }) => {
    // Check business selector in header
    const businessSelect = page.locator('header select');
    await expect(businessSelect).toBeVisible();

    // Select different business option if available
    const options = await businessSelect.locator('option').all();
    if (options.length > 1) {
      const secondBusinessValue = await options[1].getAttribute('value');
      if (secondBusinessValue) {
        await businessSelect.selectOption(secondBusinessValue);
        await page.waitForTimeout(500);

        // Verify products section loads with new business
        const productsButton = page.locator('aside nav button', { hasText: 'Productos' });
        await productsButton.click();
        await expect(page.locator('main')).toBeVisible();
        await expect(page.locator('text=[Error de Sistema]')).not.toBeVisible();
      }
    }
  });
});
