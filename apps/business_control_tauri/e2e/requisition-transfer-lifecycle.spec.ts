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

function stockFor(rows: StockRow[], productId: string, warehouseId?: string, branchId?: string): number {
  return Number(rows.find((row) =>
    row.productId === productId && row.warehouseId === (warehouseId ?? null) && row.branchId === (branchId ?? null),
  )?.quantity ?? 0);
}

async function completeTaggedPendingTransfers(token: string, businessId: string): Promise<void> {
  const transfers = await api<Transfer[]>(token, `/inventory/transfers?businessId=${businessId}`);
  const pending = transfers.filter((transfer) =>
    transfer.status === 'pending' && transfer.notes?.includes('E2E-STAGING-REQ-'),
  );

  for (const transfer of pending) {
    const detail = await api<Transfer>(token, `/inventory/transfers/${transfer.id}`);
    const items = detail.items ?? [];
    await api(token, `/inventory/transfers/${transfer.id}/ship`, {
      method: 'POST',
      body: JSON.stringify({ adjustToAvailable: false }),
    });
    await api(token, `/inventory/transfers/${transfer.id}/receive`, {
      method: 'POST',
      body: JSON.stringify({
        note: 'Recovered by staging E2E retry',
        items: items.map((item) => ({
          productId: item.productId,
          quantityReceived: Number(item.quantity),
        })),
      }),
    });
  }
}

test.describe('Staging requisition → transfer → receipt', () => {
  test('approves a tagged requisition and delivers its stock to a branch', async ({ page }) => {
    const token = await login(page);
    expect(token).not.toBe('');

    const businessId = process.env.E2E_BUSINESS_ID ?? await page.locator('header select').inputValue();
    expect(businessId).not.toBe('');

    // A failed assertion must not strand an earlier tagged transfer in pending.
    await completeTaggedPendingTransfers(token, businessId);

    const [branches, initialStock] = await Promise.all([
      api<Branch[]>(token, `/branches?businessId=${businessId}`),
      api<StockRow[]>(token, `/inventory/stock?businessId=${businessId}`),
    ]);
    expect(branches.length).toBeGreaterThan(0);

    // The transfer is deliberately tiny and uses stock that already exists in a
    // warehouse, so the test never relies on a fixture product or creates stock.
    const source = initialStock.find((row) =>
      row.warehouseId && !row.branchId && Number(row.quantity) >= QUANTITY,
    );
    expect(source, 'staging needs one warehouse stock row with a positive quantity').toBeTruthy();

    const branch = branches[0];
    const tag = `E2E-STAGING-REQ-${Date.now()}`;
    const initialSourceQty = stockFor(initialStock, source!.productId, source!.warehouseId!);
    const initialBranchQty = stockFor(initialStock, source!.productId, undefined, branch.id);

    const requisition = await api<Requisition>(token, '/requisitions', {
      method: 'POST',
      body: JSON.stringify({
        businessId,
        fromBranchId: branch.id,
        toWarehouseId: source!.warehouseId,
        notes: tag,
        items: [{ productId: source!.productId, quantityRequested: QUANTITY }],
      }),
    });
    expect(requisition.status).toMatch(/pending/);

    // Approval is exercised through the deployed admin UI, including the owner
    // justification required when approving a requisition created by that owner.
    await page.getByRole('button', { name: 'Requisiciones', exact: true }).click();
    await page.getByPlaceholder('Buscar por sucursal...').fill(tag);
    const row = page.locator('tr', { hasText: tag });
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByRole('button', { name: 'Revisar' }).click();

    const modal = page.locator('div.fixed').last();
    await modal.locator('select').selectOption(source!.warehouseId!);
    await modal.locator('textarea').fill(`${tag} approved by staging E2E`);
    await modal.getByRole('button', { name: 'Aprobar', exact: true }).click();
    await expect(page.getByText('Requisición aprobada. Se generó el traspaso.')).toBeVisible({ timeout: 10000 });

    const approved = await api<Requisition>(token, `/requisitions/${requisition.id}`);
    expect(approved.status).toBe('approved');

    const transfers = await api<Transfer[]>(token, `/inventory/transfers?businessId=${businessId}`);
    const transfer = transfers.find((entry) => entry.notes?.includes(tag));
    expect(transfer, 'approval should create a tagged pending transfer').toBeTruthy();
    expect(transfer!.status).toBe('pending');

    const transferDetail = await api<Transfer>(token, `/inventory/transfers/${transfer!.id}`);
    const transferredItem = transferDetail.items?.find((item) => item.productId === source!.productId);
    expect(transferredItem).toBeTruthy();
    expect(Number(transferredItem!.quantity)).toBeCloseTo(QUANTITY, 6);

    await api(token, `/inventory/transfers/${transfer!.id}/ship`, {
      method: 'POST',
      body: JSON.stringify({ adjustToAvailable: false }),
    });
    const received = await api<{ status: string }>(token, `/inventory/transfers/${transfer!.id}/receive`, {
      method: 'POST',
      body: JSON.stringify({
        note: `${tag} received by staging E2E`,
        items: [{ productId: source!.productId, quantityReceived: QUANTITY }],
      }),
    });
    expect(received.status).toBe('received');

    const finalStock = await api<StockRow[]>(token, `/inventory/stock?businessId=${businessId}`);
    expect(stockFor(finalStock, source!.productId, source!.warehouseId!)).toBeCloseTo(initialSourceQty - QUANTITY, 6);
    expect(stockFor(finalStock, source!.productId, undefined, branch.id)).toBeCloseTo(initialBranchQty + QUANTITY, 6);
  });
});
