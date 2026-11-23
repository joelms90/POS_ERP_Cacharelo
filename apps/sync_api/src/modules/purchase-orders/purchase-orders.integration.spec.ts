/**
 * Purchase order (OC) flow end to end over HTTP against a real PostgreSQL:
 * owner creates and authorizes → Almacén y Compras marks it purchased → two entradas
 * (short, over and different price) → stock, average cost, ledger and audit.
 *
 * Runs only when PURCHASE_ORDERS_IT_DATABASE_URL is set, e.g. the local docker DB:
 *   PURCHASE_ORDERS_IT_DATABASE_URL=postgres://pos_user:pos_password@localhost:5432/pos_dev \
 *     npx jest src/modules/purchase-orders/purchase-orders.integration.spec.ts
 * It creates an isolated business and removes its rows afterwards.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';

const DATABASE_URL = process.env.PURCHASE_ORDERS_IT_DATABASE_URL;
const describeIt = DATABASE_URL ? describe : describe.skip;

describeIt('Purchase order flow (integration, real DB)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let pool: any;
  const businessId = randomUUID();
  const otherBusinessId = randomUUID();
  const warehouseId = randomUUID();
  const providerId = randomUUID();
  const categoryId = randomUUID();
  const p1 = randomUUID();
  const p2 = randomUUID();
  const ids = { owner: randomUUID(), invAdmin: randomUUID(), compras: randomUUID(), support: randomUUID() };
  const tag = businessId.slice(0, 8);

  const token = (userId: string, role: string) =>
    jwt.sign(
      { sub: userId, role, roles: [role], branchId: null, businessId, businessAccess: [{ businessId, role }] },
      { secret: process.env.JWT_SECRET || 'dev_jwt_secret_key' },
    );
  const as = {
    owner: () => token(ids.owner, 'owner'),
    invAdmin: () => token(ids.invAdmin, 'inventory_admin'),
    compras: () => token(ids.compras, 'warehouse_purchasing_operator'),
    support: () => token(ids.support, 'support_tech'),
  };
  const http = () => request(app.getHttpServer());
  const post = (path: string, who: string, body: object = {}) =>
    http().post(path).set('Authorization', `Bearer ${who}`).send(body);
  const patch = (path: string, who: string, body: object = {}) =>
    http().patch(path).set('Authorization', `Bearer ${who}`).send(body);
  const get = (path: string, who: string) => http().get(path).set('Authorization', `Bearer ${who}`);
  const query = async (text: string, params: unknown[] = []) => (await pool.query(text, params)).rows;
  const stock = async (productId: string) =>
    Number((await query('SELECT quantity FROM stock_levels WHERE product_id = $1 AND warehouse_id = $2', [productId, warehouseId]))[0]?.quantity ?? 0);
  const cost = async (productId: string) => Number((await query('SELECT cost FROM products WHERE id = $1', [productId]))[0].cost);
  const newOrder = (orderNumber: string) => ({
    businessId,
    providerId,
    warehouseId,
    orderNumber,
    items: [
      { productId: p1, quantity: 10, estimatedUnitCost: 10 },
      { productId: p2, quantity: 5, estimatedUnitCost: 50 },
    ],
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = DATABASE_URL;
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { DatabaseModule } = require('../../database/database.module');
    const { AuditModule } = require('../audit/audit.module');
    const { PurchaseOrdersModule } = require('./purchase-orders.module');
    ({ pool } = require('../../database/connection'));
    /* eslint-enable @typescript-eslint/no-require-imports */

    await query('INSERT INTO businesses (id, name) VALUES ($1, $2), ($3, $4)', [
      businessId, `IT-OC ${tag}`, otherBusinessId, `IT-OC other ${tag}`,
    ]);
    await query('INSERT INTO warehouses (id, business_id, name) VALUES ($1, $2, $3)', [warehouseId, businessId, 'IT Bodega Central']);
    await query('INSERT INTO providers (id, business_id, name) VALUES ($1, $2, $3)', [providerId, businessId, 'IT Proveedor']);
    await query('INSERT INTO categories (id, business_id, name) VALUES ($1, $2, $3)', [categoryId, businessId, 'IT Insumos']);
    await query(
      `INSERT INTO products (id, business_id, category_id, name, cost) VALUES ($1, $3, $4, 'IT Harina', 8), ($2, $3, $4, 'IT Queso', 50)`,
      [p1, p2, businessId, categoryId],
    );
    // 10 kg of harina already in stock at cost 8, to check the weighted average.
    await query('INSERT INTO stock_levels (product_id, warehouse_id, quantity) VALUES ($1, $2, 10)', [p1, warehouseId]);
    const users: Array<[string, string, string]> = [
      [ids.owner, 'owner', 'IT Owner'],
      [ids.invAdmin, 'inventory_admin', 'IT Admin Inventario'],
      [ids.compras, 'warehouse_purchasing_operator', 'IT Almacén y Compras'],
      [ids.support, 'support_tech', 'IT Soporte'],
    ];
    for (const [id, role, name] of users) {
      await query(
        `INSERT INTO users (id, business_id, name, pin, role, roles) VALUES ($1, $2, $3, 'x', $4, $5::jsonb)`,
        [id, businessId, name, role, JSON.stringify([role])],
      );
    }

    const moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule, AuditModule, PurchaseOrdersModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.listen(0, '127.0.0.1');
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL session_replication_role = replica');
        await client.query('DELETE FROM purchase_order_receipt_ledger WHERE business_id = $1', [businessId]);
        await client.query('DELETE FROM audit_log WHERE business_id = $1', [businessId]);
        await client.query('DELETE FROM stock_ledger WHERE business_id = $1', [businessId]);
        await client.query(
          'DELETE FROM purchase_order_items WHERE po_id IN (SELECT id FROM purchase_orders WHERE business_id = $1)',
          [businessId],
        );
        await client.query('DELETE FROM purchase_orders WHERE business_id = $1', [businessId]);
        await client.query('DELETE FROM stock_levels WHERE product_id = ANY($1::uuid[])', [[p1, p2]]);
        await client.query('DELETE FROM products WHERE business_id = $1', [businessId]);
        await client.query('DELETE FROM categories WHERE business_id = $1', [businessId]);
        await client.query('DELETE FROM providers WHERE business_id = $1', [businessId]);
        await client.query('DELETE FROM warehouses WHERE business_id = $1', [businessId]);
        await client.query('DELETE FROM users WHERE business_id = $1', [businessId]);
        await client.query('DELETE FROM businesses WHERE id = ANY($1::uuid[])', [[businessId, otherBusinessId]]);
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    }
    await app?.close();
    await pool?.end?.();
  });

  it('owner creates and authorizes; compras buys and enters it in two counts; everything is audited', async () => {
    // 1. Only owner / admin inventario create. Totals are calculated by the server.
    await post('/purchase-orders', as.compras(), newOrder(`IT-${tag}-X`)).expect(403);
    const created = await post('/purchase-orders', as.owner(), newOrder(`IT-${tag}-1`)).expect(201);
    const id = created.body.id;
    expect(created.body.status).toBe('draft');
    expect(Number(created.body.subtotal)).toBe(350);
    expect(Number(created.body.total)).toBe(350);

    // 2. Drafts are invisible to Almacén y Compras; edits replace the lines.
    await get(`/purchase-orders/${id}`, as.compras()).expect(403);
    const edited = await patch(`/purchase-orders/${id}`, as.invAdmin(), {
      items: [
        { productId: p1, quantity: 10, estimatedUnitCost: 10 },
        { productId: p2, quantity: 4, estimatedUnitCost: 50 },
      ],
    }).expect(200);
    expect(Number(edited.body.total)).toBe(300);
    expect(edited.body.items).toHaveLength(2);

    // 3. Authorize → "por comprar". Authorized OCs can no longer be edited or deleted.
    await post(`/purchase-orders/${id}/authorize`, as.compras()).expect(403);
    await post(`/purchase-orders/${id}/authorize`, as.owner()).expect(201);
    await post(`/purchase-orders/${id}/authorize`, as.owner()).expect(400);
    await patch(`/purchase-orders/${id}`, as.owner(), { notes: 'x' }).expect(400);
    await http().delete(`/purchase-orders/${id}`).set('Authorization', `Bearer ${as.owner()}`).expect(400);
    const purchasing = await get(`/purchase-orders/purchasing?businessId=${businessId}`, as.compras()).expect(200);
    expect(purchasing.body.map((o: any) => o.id)).toContain(id);

    // 4. An entrada needs the purchase to be marked first.
    const fullCount = {
      items: [
        { productId: p1, quantityReceived: 10, unitCostActual: 10 },
        { productId: p2, quantityReceived: 4, unitCostActual: 50 },
      ],
    };
    const notBought = await post(`/purchase-orders/${id}/receive`, as.compras(), fullCount).expect(400);
    expect(notBought.body.message).toContain('comprada');
    const bought = await post(`/purchase-orders/${id}/purchase`, as.compras(), { documentNumber: 'TK-881' }).expect(201);
    expect(bought.body.status).toBe('purchased');

    // Nothing entered yet, so it can still be cancelled (with a reason).
    const cancelled = await post(`/purchase-orders/${id}/cancel`, as.owner(), { reason: 'Se compró a otro proveedor' }).expect(201);
    expect(cancelled.body.status).toBe('cancelled');
    const purchasingAfter = await get(`/purchase-orders/purchasing?businessId=${businessId}`, as.compras()).expect(200);
    expect(purchasingAfter.body.map((o: any) => o.id)).not.toContain(id);
  });

  it('runs two entradas with short, over and price differences and keeps every one', async () => {
    const created = await post('/purchase-orders', as.owner(), newOrder(`IT-${tag}-2`)).expect(201);
    const id = created.body.id;
    await post(`/purchase-orders/${id}/authorize`, as.owner()).expect(201);
    await post(`/purchase-orders/${id}/purchase`, as.compras(), { documentNumber: 'FAC-1' }).expect(201);

    // Entrada 1: 6 of 10 harina paid at 12 (estimated 10), 0 queso. Differences need a note.
    const first = {
      documentNumber: 'FAC-1',
      items: [
        { productId: p1, quantityReceived: 6, unitCostActual: 12 },
        { productId: p2, quantityReceived: 0, unitCostActual: 50 },
      ],
    };
    await post(`/purchase-orders/${id}/receive`, as.compras(), first).expect(400);
    const r1 = await post(`/purchase-orders/${id}/receive`, as.compras(), { ...first, notes: 'Llegó la mitad; subió el precio' }).expect(201);
    expect(r1.body.status).toBe('partially_received');
    expect(await stock(p1)).toBe(16);
    // Weighted average: (10 × 8 + 6 × 12) / 16 = 9.5
    expect(await cost(p1)).toBe(9.5);

    // Partly received: Almacén y Compras marks the rest as bought again, then enters it.
    await post(`/purchase-orders/${id}/purchase`, as.compras(), { notes: 'Resto pedido' }).expect(201);
    // Entrada 2: 5 harina (1 over, merma allowance) at 10, 5 queso at 50.
    const r2 = await post(`/purchase-orders/${id}/receive`, as.compras(), {
      notes: 'Proveedor mandó 1 kg extra',
      items: [
        { productId: p1, quantityReceived: 5, unitCostActual: 10 },
        { productId: p2, quantityReceived: 5, unitCostActual: 50 },
      ],
    }).expect(201);
    expect(r2.body.status).toBe('received');
    expect(await stock(p1)).toBe(21);
    expect(await stock(p2)).toBe(5);

    const harina = r2.body.purchaseOrder.items.find((i: any) => i.productId === p1);
    expect(Number(harina.quantityReceived)).toBe(11);
    // Average paid on the line across both entradas: (6 × 12 + 5 × 10) / 11 = 11.09
    expect(Number(harina.unitCostActual)).toBe(11.09);

    // A received OC can no longer take entradas, be cancelled or be closed.
    await post(`/purchase-orders/${id}/receive`, as.compras(), {
      notes: 'x', items: [{ productId: p1, quantityReceived: 1, unitCostActual: 10 }],
    }).expect(400);
    await post(`/purchase-orders/${id}/cancel`, as.owner(), { reason: 'x' }).expect(400);

    // Ledger: one row per line per entrada, nothing overwritten.
    const history = await get(`/purchase-orders/${id}/history`, as.invAdmin()).expect(200);
    const rows = history.body.receipts
      .filter((r: any) => r.productId === p1)
      .map((r: any) => [Number(r.previouslyReceived), Number(r.quantityReceived), Number(r.quantityDifference), Number(r.unitCostActual), Number(r.costDifference)]);
    expect(rows).toEqual([
      [0, 6, -4, 12, 2],
      [6, 5, 1, 10, 0],
    ]);
    expect(new Set(history.body.receipts.map((r: any) => r.receiptId)).size).toBe(2);
    expect(history.body.receipts[0].documentNumber).toBe('FAC-1');
    expect(history.body.events.map((e: any) => e.action)).toEqual([
      'created', 'authorized', 'purchased', 'received', 'purchased', 'received',
    ]);

    await expect(query('UPDATE purchase_order_receipt_ledger SET quantity_received = 0 WHERE purchase_order_id = $1', [id])).rejects.toThrow(
      /append-only/,
    );
  });

  it('cancel before receiving, close short after a partial entrada, and act on behalf with a reason', async () => {
    const a = (await post('/purchase-orders', as.owner(), newOrder(`IT-${tag}-3`)).expect(201)).body.id;
    await post(`/purchase-orders/${a}/authorize`, as.owner()).expect(201);
    await post(`/purchase-orders/${a}/cancel`, as.owner(), {}).expect(400);
    const cancelled = await post(`/purchase-orders/${a}/cancel`, as.owner(), { reason: 'Proveedor sin existencia' }).expect(201);
    expect(cancelled.body.status).toBe('cancelled');
    await get(`/purchase-orders/${a}`, as.compras()).expect(403);

    const b = (await post('/purchase-orders', as.invAdmin(), newOrder(`IT-${tag}-4`)).expect(201)).body.id;
    await post(`/purchase-orders/${b}/authorize`, as.invAdmin()).expect(201);
    // Owner marks purchased and receives on behalf of Almacén y Compras: reason required.
    await post(`/purchase-orders/${b}/purchase`, as.owner(), {}).expect(400);
    await post(`/purchase-orders/${b}/purchase`, as.owner(), { notes: 'Compré yo en la central' }).expect(201);
    const partial = { items: [{ productId: p2, quantityReceived: 2, unitCostActual: 50 }] };
    await post(`/purchase-orders/${b}/receive`, as.owner(), partial).expect(400);
    const r = await post(`/purchase-orders/${b}/receive`, as.owner(), { ...partial, notes: 'Lo dejé yo en bodega' }).expect(201);
    expect(r.body.status).toBe('partially_received');
    await post(`/purchase-orders/${b}/cancel`, as.owner(), { reason: 'x' }).expect(400);
    const closed = await post(`/purchase-orders/${b}/close`, as.owner(), { reason: 'El resto ya no llegará' }).expect(201);
    expect(closed.body.status).toBe('closed_short');

    const history = await get(`/purchase-orders/${b}/history`, as.support()).expect(200);
    expect(history.body.events.map((e: any) => e.action)).toEqual([
      'created', 'authorized', 'purchased_on_behalf', 'received_on_behalf', 'closed_short',
    ]);
  });

  it('does not accept a provider or warehouse from another business', async () => {
    const foreignWarehouse = randomUUID();
    await query('INSERT INTO warehouses (id, business_id, name) VALUES ($1, $2, $3)', [foreignWarehouse, otherBusinessId, 'Ajena']);
    try {
      await post('/purchase-orders', as.owner(), { ...newOrder(`IT-${tag}-5`), warehouseId: foreignWarehouse }).expect(400);
    } finally {
      await query('DELETE FROM warehouses WHERE id = $1', [foreignWarehouse]);
    }
  });
});
