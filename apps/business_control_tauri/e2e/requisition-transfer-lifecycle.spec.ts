import { expect, Page, test } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
// The requisition API validates a minimum requested quantity of 0.01.
const QUANTITY = 0.01;

interface Branch {
  id: string;
}

interface StockRow {
  productId: string;
  warehouseId: string | null;
  branchId: string | null;
  quantity: string;
}

interface Requisition {
  id: string;
  status: string;
}

interface Transfer {
  id: string;
  status: string;
  notes?: string | null;
  items?: Array<{ productId: string; quantity: string }>;
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
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} -> ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

test.describe('Staging requisition created by the owner', () => {
  // Dispatch, delivery and receipt need the POS roles (Almacén y Bodega, OIS); that chain
  // is covered end to end by apps/sync_api/src/modules/requisitions/requisitions.integration.spec.ts.
  test('is born authorized, is visible to Bodega and shows its audit timeline', async ({ page }) => {
    const token = await login(page);
    expect(token).not.toBe('');

    const businessId = process.env.E2E_BUSINESS_ID ?? await page.locator('header select').inputValue();
    expect(businessId).not.toBe('');

    const [branches, stock] = await Promise.all([
      api<Branch[]>(token, `/branches?businessId=${businessId}`),
      api<StockRow[]>(token, `/inventory/stock?businessId=${businessId}`),
    ]);
    expect(branches.length).toBeGreaterThan(0);
    const source = stock.find((row) => row.warehouseId && !row.branchId && Number(row.quantity) >= QUANTITY);
    expect(source, 'staging needs one warehouse stock row with a positive quantity').toBeTruthy();

    const tag = `E2E-STAGING-REQ-${Date.now()}`;
    const requisition = await api<Requisition>(token, '/requisitions', {
      method: 'POST',
      body: JSON.stringify({
        businessId,
        fromBranchId: branches[0].id,
        toWarehouseId: source!.warehouseId,
        notes: tag,
        items: [{ productId: source!.productId, quantityRequested: QUANTITY }],
      }),
    });
    expect(requisition.status).toBe('approved');

    // Approval no longer creates a transfer: Almacén y Bodega creates it when dispatching.
    const transfers = await api<Transfer[]>(token, `/inventory/transfers?businessId=${businessId}`);
    expect(transfers.some((transfer) => transfer.notes?.includes(tag))).toBe(false);

    const outbound = await api<Requisition[]>(token, `/requisitions/outbound?businessId=${businessId}`);
    expect(outbound.map((r) => r.id)).toContain(requisition.id);

    await page.getByRole('button', { name: 'Requisiciones', exact: true }).click();
    await page.getByPlaceholder('Buscar por sucursal...').fill(tag);
    const row = page.locator('tr', { hasText: tag });
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row.getByText('Autorizada', { exact: true })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Revisar' })).toHaveCount(0);

    await row.getByTitle('Ver detalle').click();
    const modal = page.locator('div.fixed').last();
    await expect(modal.getByText('Creada y autorizada')).toBeVisible({ timeout: 10000 });

    // Leave staging clean: cancelling an authorized requisition requires a reason.
    await modal.getByRole('button', { name: 'Cancelar requisición' }).click();
    await expect(page.getByText('Indica el motivo; queda registrado en la auditoría.')).toBeVisible();
    await modal.locator('textarea').fill(`${tag} cancelled by staging E2E`);
    await modal.getByRole('button', { name: 'Cancelar requisición' }).click();
    await expect(page.getByText('Requisición cancelada.')).toBeVisible({ timeout: 10000 });

    const cancelled = await api<Requisition>(token, `/requisitions/${requisition.id}`);
    expect(cancelled.status).toBe('rejected');
  });
});
