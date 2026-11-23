import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
const BUSINESS_ID =
  process.env.E2E_BUSINESS_ID ?? 'd3b07384-d113-4a0e-a555-e5b12824bf01';
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  'postgres://pos_user:pos_password@localhost:5432/pos_dev';
const BASE_URL = process.env.BASE_URL;
const IS_REMOTE =
  Boolean(BASE_URL) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL!);

interface Seed {
  businessId: string;
  branchId: string;
  branchName: string;
  ownerId: string;
  ownerEmail: string;
  ownerPassword: string;
  supervisorId: string;
  supervisorEmail: string;
  supervisorPassword: string;
  shiftId: string;
  movementId: string;
  movementReason: string;
}

interface ShiftDetail {
  shift: {
    reviewStatus: string;
    operatorReviewedBy: string | null;
    reviewedBy: string | null;
  };
  report: {
    cashMovements: Array<{ id: string; approvalStatus: string }>;
  };
}

function seedSupervision(): Seed {
  const syncApiDir = path.resolve(HERE, '../../sync_api');
  const tsx = path.join(syncApiDir, 'node_modules', '.bin', 'tsx');
  const output = execFileSync(tsx, ['scripts/seed-supervision-e2e.ts'], {
    cwd: syncApiDir,
    env: { ...process.env, DATABASE_URL, E2E_BUSINESS_ID: BUSINESS_ID },
    encoding: 'utf8',
  });
  const json = output
    .trim()
    .split('\n')
    .reverse()
    .find((line) => line.trim().startsWith('{'));
  if (!json) throw new Error(`The supervision seed did not return JSON:\n${output}`);
  return JSON.parse(json) as Seed;
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/');
  const logout = page.getByRole('button', { name: 'Cerrar Sesión' });
  if (await logout.isVisible({ timeout: 1500 }).catch(() => false)) {
    await logout.click();
  }
  const emailInput = page.locator('input[type="email"]');
  await expect(emailInput).toBeVisible({ timeout: 10000 });
  await emailInput.fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('aside nav')).toBeVisible({ timeout: 15000 });
}

async function openApprovals(page: Page) {
  const heading = page.getByRole('heading', { name: 'Aprobaciones de caja' });
  if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) return;

  const navButton = page
    .locator('aside nav')
    .getByRole('button', { name: /Aprobaciones de caja/ });
  await navButton.click({ timeout: 15000 });
  await expect(heading).toBeVisible({ timeout: 15000 });
}

async function approvedShiftDetail(token: string, shiftId: string) {
  const response = await fetch(`${API_URL}/supervision/cash-shifts/${shiftId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`GET shift detail -> ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as ShiftDetail;
}

test.describe('Supervisión de caja (Admin web)', () => {
  let seed: Seed;

  test.beforeAll(() => {
    if (IS_REMOTE) return;
    seed = seedSupervision();
  });

  test('supervisor aprueba el nivel 1 y el owner el nivel 2', async ({ page }) => {
    test.skip(IS_REMOTE, 'Requiere el backend y la base de datos locales.');
    test.setTimeout(120000);

    await page.addInitScript((businessId) => {
      localStorage.setItem('BC-Active-Business', businessId);
    }, seed.businessId);

    await loginAs(page, seed.supervisorEmail, seed.supervisorPassword);
    await openApprovals(page);

    const nav = page.locator('aside nav');
    await expect(nav.getByText('Operaciones y Local')).toHaveCount(0);
    await expect(nav.getByText('Catálogo e Inventario')).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'Reportes de Venta' })).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'Adeudos' })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Bitácora de caja' })).toBeVisible();

    await page.getByRole('button', { name: /Ingresos \/ egresos/ }).click();
    const movementCard = page
      .locator('div.rounded-lg')
      .filter({ hasText: seed.movementReason })
      .filter({ has: page.getByRole('button', { name: 'Aprobar', exact: true }) });
    await expect(movementCard).toBeVisible({ timeout: 15000 });
    await movementCard.getByRole('button', { name: 'Aprobar', exact: true }).click();

    const movementDialog = page.getByRole('dialog', { name: 'Aprobar movimiento' });
    await expect(movementDialog).toBeVisible();
    await movementDialog
      .getByRole('button', { name: 'Aprobar movimiento', exact: true })
      .click();
    await expect(movementDialog).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByText(seed.movementReason)).toHaveCount(0, {
      timeout: 15000,
    });

    await page.getByRole('button', { name: /Cortes Z/ }).click();
    const n1Card = page
      .locator('button')
      .filter({ hasText: seed.branchName })
      .filter({ hasText: 'Pendiente nivel 1' });
    await expect(n1Card).toBeVisible({ timeout: 15000 });
    await n1Card.click();

    const review = page.getByRole('dialog', { name: 'Revisión de Corte Z' });
    await expect(review.getByText('Esperado al cierre')).toBeVisible({
      timeout: 15000,
    });
    await review.getByRole('button', { name: 'Aprobar (nivel 1)' }).click();

    const n1Dialog = page.getByRole('dialog', {
      name: 'Aprobar Corte Z (nivel 1)',
    });
    await expect(n1Dialog).toBeVisible();
    await n1Dialog.getByRole('button', { name: 'Aprobar', exact: true }).click();
    await expect(n1Dialog).not.toBeVisible({ timeout: 15000 });
    await expect(review.getByText('Pendiente nivel 2', { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await review.getByRole('button', { name: 'Cerrar' }).click();

    await page.getByRole('button', { name: 'Cerrar Sesión' }).click();
    await loginAs(page, seed.ownerEmail, seed.ownerPassword);
    await openApprovals(page);

    const n2Card = page
      .locator('button')
      .filter({ hasText: seed.branchName })
      .filter({ hasText: 'Pendiente nivel 2' });
    await expect(n2Card).toBeVisible({ timeout: 15000 });
    await n2Card.click();

    const ownerReview = page.getByRole('dialog', { name: 'Revisión de Corte Z' });
    await expect(ownerReview.getByText('Esperado al cierre')).toBeVisible({
      timeout: 15000,
    });
    await ownerReview.getByRole('button', { name: 'Aprobar (nivel 2)' }).click();

    const n2Dialog = page.getByRole('dialog', {
      name: 'Aprobar Corte Z (nivel 2)',
    });
    await expect(n2Dialog).toBeVisible();
    await n2Dialog.getByRole('button', { name: 'Aprobar', exact: true }).click();
    await expect(n2Dialog).not.toBeVisible({ timeout: 15000 });
    await expect(
      ownerReview.getByText('Aprobado', { exact: true }).first(),
    ).toBeVisible({ timeout: 15000 });

    const token = await page.evaluate(
      () => localStorage.getItem('BC-Access-Token') ?? '',
    );
    const detail = await approvedShiftDetail(token, seed.shiftId);
    expect(detail.shift.reviewStatus).toBe('aprobado');
    expect(detail.shift.operatorReviewedBy).toBe(seed.supervisorId);
    expect(detail.shift.reviewedBy).toBe(seed.ownerId);
    expect(
      detail.report.cashMovements.find((movement) => movement.id === seed.movementId)
        ?.approvalStatus,
    ).toBe('aprobado');
  });
});
