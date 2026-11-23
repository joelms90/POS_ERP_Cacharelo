/**
 * Requisition flow end to end over HTTP against a real PostgreSQL:
 * OIS requests → Owner authorizes → Almacén y Bodega dispatches and delivers →
 * OIS confirms, with role gates, stock movements, ledger and audit rows.
 *
 * Runs only when REQUISITIONS_IT_DATABASE_URL is set, e.g. the local docker DB:
 *   REQUISITIONS_IT_DATABASE_URL=postgres://pos_user:pos_password@localhost:5432/pos_dev \
 *     npx jest src/modules/requisitions/requisitions.integration.spec.ts
 * It creates an isolated business and removes its rows afterwards.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';

const DATABASE_URL = process.env.REQUISITIONS_IT_DATABASE_URL;
const describeIt = DATABASE_URL ? describe : describe.skip;

describeIt('Requisition dispatch flow (integration, real DB)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let pool: any;
  const businessId = randomUUID();
  const branchA = randomUUID();
  const branchB = randomUUID();
  const warehouseId = randomUUID();
  const categoryId = randomUUID();
  const p1 = randomUUID();
  const p2 = randomUUID();
  const ids = {
    ois: randomUUID(),
    oisB: randomUUID(),
    bodega: randomUUID(),
    owner: randomUUID(),
    invAdmin: randomUUID(),
    support: randomUUID(),
  };

  const token = (userId: string, role: string, branchId: string | null) =>
    jwt.sign(
      { sub: userId, role, roles: [role], branchId, businessId, businessAccess: [{ businessId, role }] },
      { secret: process.env.JWT_SECRET || 'dev_jwt_secret_key' },
    );
  const as = {
    ois: () => token(ids.ois, 'branch_operator', branchA),
    oisB: () => token(ids.oisB, 'branch_operator', branchB),
    bodega: () => token(ids.bodega, 'warehouse_purchasing_operator', null),
    owner: () => token(ids.owner, 'owner', null),
    invAdmin: () => token(ids.invAdmin, 'inventory_admin', null),
    support: () => token(ids.support, 'support_tech', null),
  };
  const http = () => request(app.getHttpServer());
  const post = (path: string, who: string, body: object = {}) =>
    http().post(path).set('Authorization', `Bearer ${who}`).send(body);
  const get = (path: string, who: string) => http().get(path).set('Authorization', `Bearer ${who}`);
  const query = async (text: string, params: unknown[] = []) => (await pool.query(text, params)).rows;
  const stockAt = async (productId: string, where: string, id: string) =>
    Number((await query(`SELECT quantity FROM stock_levels WHERE product_id = $1 AND ${where} = $2`, [productId, id]))[0]?.quantity ?? 0);

  beforeAll(async () => {
    process.env.DATABASE_URL = DATABASE_URL;
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { DatabaseModule } = require('../../database/database.module');
    const { AuditModule } = require('../audit/audit.module');
    const { RequisitionsModule } = require('./requisitions.module');
    const { InventoryModule } = require('../inventory/inventory.module');
    ({ pool } = require('../../database/connection'));
    /* eslint-enable @typescript-eslint/no-require-imports */

    await query('INSERT INTO businesses (id, name) VALUES ($1, $2)', [businessId, `IT-REQ ${businessId.slice(0, 8)}`]);
    await query('INSERT INTO branches (id, business_id, name) VALUES ($1, $3, $4), ($2, $3, $5)', [
      branchA, branchB, businessId, 'IT Sucursal A', 'IT Sucursal B',
    ]);
    await query('INSERT INTO warehouses (id, business_id, name) VALUES ($1, $2, $3)', [warehouseId, businessId, 'IT Bodega Central']);
    await query('INSERT INTO categories (id, business_id, name) VALUES ($1, $2, $3)', [categoryId, businessId, 'IT Insumos']);
    await query(
      `INSERT INTO products (id, business_id, category_id, name, cost) VALUES ($1, $3, $4, 'IT Harina', 10), ($2, $3, $4, 'IT Queso', 50)`,
      [p1, p2, businessId, categoryId],
    );
    await query(
      `INSERT INTO stock_levels (product_id, warehouse_id, quantity) VALUES ($1, $3, 10), ($2, $3, 5)`,
      [p1, p2, warehouseId],
    );
    const users: Array<[string, string, string | null, string]> = [
      [ids.ois, 'branch_operator', branchA, 'IT OIS'],
      [ids.oisB, 'branch_operator', branchB, 'IT OIS B'],
      [ids.bodega, 'warehouse_purchasing_operator', null, 'IT Bodega'],
      [ids.owner, 'owner', null, 'IT Owner'],
      [ids.invAdmin, 'inventory_admin', null, 'IT Admin Inventario'],
      [ids.support, 'support_tech', null, 'IT Soporte'],
    ];
    for (const [id, role, branchId, name] of users) {
      await query(
        `INSERT INTO users (id, business_id, branch_id, name, pin, role, roles) VALUES ($1, $2, $3, $4, 'x', $5, $6::jsonb)`,
        [id, businessId, branchId, name, role, JSON.stringify([role])],
      );
    }

    const moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule, AuditModule, InventoryModule, RequisitionsModule],
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
        const byBusiness = [
          'requisition_item_ledger', 'audit_log', 'stock_ledger',
        ];
        for (const table of byBusiness) {
          await client.query(`DELETE FROM ${table} WHERE business_id = $1`, [businessId]);
        }
        await client.query(
          'DELETE FROM stock_transfer_items WHERE transfer_id IN (SELECT id FROM stock_transfers WHERE business_id = $1)',
          [businessId],
        );
        await client.query('DELETE FROM stock_transfers WHERE business_id = $1', [businessId]);
        await client.query(
          'DELETE FROM branch_requisition_items WHERE requisition_id IN (SELECT id FROM branch_requisitions WHERE business_id = $1)',
          [businessId],
        );
        await client.query('DELETE FROM branch_requisitions WHERE business_id = $1', [businessId]);
        await client.query('DELETE FROM stock_levels WHERE product_id = ANY($1::uuid[])', [[p1, p2]]);
        await client.query('DELETE FROM products WHERE business_id = $1', [businessId]);
        await client.query('DELETE FROM categories WHERE business_id = $1', [businessId]);
        await client.query('DELETE FROM warehouses WHERE business_id = $1', [businessId]);
        await client.query('DELETE FROM users WHERE business_id = $1', [businessId]);
        await client.query('DELETE FROM branches WHERE business_id = $1', [businessId]);
        await client.query('DELETE FROM businesses WHERE id = $1', [businessId]);
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    }
    await app?.close();
    await pool?.end?.();
  });

  it('runs OIS → owner → bodega → OIS with adjustments at every step, audited', async () => {
    // 1. OIS requests 8 harina + 4 queso. Bodega cannot create requisitions.
    await post('/requisitions', as.bodega(), { items: [{ productId: p1, quantityRequested: 1 }] }).expect(403);
    const created = await post('/requisitions', as.ois(), {
      notes: 'Fin de semana',
      items: [{ productId: p1, quantityRequested: 8 }, { productId: p2, quantityRequested: 4 }],
    }).expect(201);
    const id = created.body.id;
    expect(created.body.status).toBe('pending_approval');

    // 2. Not authorized yet → invisible to Bodega, and Bodega cannot approve it.
    const outboundBefore = await get(`/requisitions/outbound?businessId=${businessId}`, as.bodega()).expect(200);
    expect(outboundBefore.body.map((r: any) => r.id)).not.toContain(id);
    const allForBodega = await get(`/requisitions?businessId=${businessId}`, as.bodega()).expect(200);
    expect(allForBodega.body.map((r: any) => r.id)).not.toContain(id);
    await get(`/requisitions/${id}`, as.bodega()).expect(403);
    await post(`/requisitions/${id}/approve`, as.bodega()).expect(403);
    await post(`/requisitions/${id}/approve`, as.support()).expect(403);
    await post(`/requisitions/${id}/dispatch`, as.bodega(), { warehouseId }).expect(400);

    // 3. Owner authorizes 3 queso instead of 4: a note is required.
    const approveBody = { items: [{ productId: p2, quantityApproved: 3 }] };
    await post(`/requisitions/${id}/approve`, as.owner(), approveBody).expect(400);
    const approved = await post(`/requisitions/${id}/approve`, as.owner(), { ...approveBody, notes: 'Queso limitado' }).expect(201);
    expect(approved.body.status).toBe('approved');
    expect(approved.body.transfer).toBeNull();
    expect(await query('SELECT 1 FROM stock_transfers WHERE requisition_id = $1', [id])).toHaveLength(0);

    // 4. Bodega now sees it; can hold it and still dispatch afterwards.
    const outbound = await get(`/requisitions/outbound?businessId=${businessId}`, as.bodega()).expect(200);
    expect(outbound.body.map((r: any) => r.id)).toContain(id);
    await post(`/requisitions/${id}/hold`, as.bodega(), {}).expect(400);
    const held = await post(`/requisitions/${id}/hold`, as.bodega(), { reason: 'Esperando camioneta' }).expect(201);
    expect(held.body.status).toBe('standby');

    // 5. Dispatch: owner cannot do the warehouse step; stock is checked; differences need a note.
    await post(`/requisitions/${id}/dispatch`, as.owner(), { warehouseId }).expect(403);
    const tooMuch = await post(`/requisitions/${id}/dispatch`, as.bodega(), {
      warehouseId, items: [{ productId: p1, quantity: 12 }], notes: 'x',
    }).expect(400);
    expect(tooMuch.body.message).toContain('Stock insuficiente');
    await post(`/requisitions/${id}/dispatch`, as.bodega(), { warehouseId, items: [{ productId: p2, quantity: 2 }] }).expect(400);
    const dispatched = await post(`/requisitions/${id}/dispatch`, as.bodega(), {
      warehouseId, items: [{ productId: p2, quantity: 2 }], notes: 'Un queso dañado en bodega',
    }).expect(201);
    expect(dispatched.body.status).toBe('in_transit');
    expect(dispatched.body.transfer.status).toBe('in_transit');
    const transferId = dispatched.body.transfer.id;
    expect(await stockAt(p1, 'warehouse_id', warehouseId)).toBe(2);
    expect(await stockAt(p2, 'warehouse_id', warehouseId)).toBe(3);
    const [transit] = await query(`SELECT id FROM warehouses WHERE business_id = $1 AND location_type = 'transit'`, [businessId]);
    expect(await stockAt(p1, 'warehouse_id', transit.id)).toBe(8);
    expect(await stockAt(p2, 'warehouse_id', transit.id)).toBe(2);

    // 6. OIS cannot confirm before Bodega marks it delivered.
    const receipt = { items: [{ productId: p1, quantityReceived: 7 }, { productId: p2, quantityReceived: 2 }] };
    await post(`/inventory/transfers/${transferId}/receive`, as.ois(), { ...receipt, note: 'x' }).expect(400);
    const delivered = await post(`/requisitions/${id}/deliver`, as.bodega(), {}).expect(201);
    expect(delivered.body.status).toBe('delivered');

    // 7. Only the destination OIS (or owner / admin inventario on its behalf) confirms.
    await post(`/inventory/transfers/${transferId}/receive`, as.oisB(), { ...receipt, note: 'x' }).expect(403);
    await post(`/inventory/transfers/${transferId}/receive`, as.bodega(), { ...receipt, note: 'x' }).expect(403);
    await post(`/inventory/transfers/${transferId}/receive`, as.ois(), receipt).expect(400); // shortage needs a note
    await post(`/inventory/transfers/${transferId}/receive`, as.ois(), { ...receipt, note: 'Llegó un costal roto' }).expect(201);

    const [req] = await query('SELECT status FROM branch_requisitions WHERE id = $1', [id]);
    expect(req.status).toBe('completed');
    expect(await stockAt(p1, 'branch_id', branchA)).toBe(7);
    expect(await stockAt(p2, 'branch_id', branchA)).toBe(2);
    expect(await stockAt(p1, 'warehouse_id', transit.id)).toBe(0);

    // 8. Ledger keeps every quantity and the difference against the previous step.
    const history = await get(`/requisitions/${id}/history`, as.ois()).expect(200);
    const harina = history.body.ledger
      .filter((row: any) => row.productId === p1)
      .map((row: any) => [row.stage, Number(row.quantity), Number(row.difference)]);
    expect(harina).toEqual([['requested', 8, 0], ['approved', 8, 0], ['dispatched', 8, 0], ['received', 7, -1]]);
    const queso = history.body.ledger
      .filter((row: any) => row.productId === p2)
      .map((row: any) => [row.stage, Number(row.quantity), Number(row.difference)]);
    expect(queso).toEqual([['requested', 4, 0], ['approved', 3, -1], ['dispatched', 2, -1], ['received', 2, 0]]);
    expect(history.body.events.map((e: any) => e.action)).toEqual([
      'created', 'approved', 'held', 'dispatched', 'delivered', 'received',
    ]);
    expect(history.body.events.find((e: any) => e.action === 'received').reason).toBe('Llegó un costal roto');

    // The ledger is append-only.
    await expect(query('UPDATE requisition_item_ledger SET quantity = 0 WHERE requisition_id = $1', [id])).rejects.toThrow(
      /append-only/,
    );
  });

  it('requisitions created by admin inventario are born approved; owner can act on behalf with a reason', async () => {
    await post('/requisitions', as.support(), { businessId, fromBranchId: branchA, items: [{ productId: p1, quantityRequested: 1 }] }).expect(403);
    const created = await post('/requisitions', as.invAdmin(), {
      businessId, fromBranchId: branchA, items: [{ productId: p1, quantityRequested: 1 }],
    }).expect(201);
    expect(created.body.status).toBe('approved');
    const id = created.body.id;

    const outbound = await get(`/requisitions/outbound?businessId=${businessId}`, as.bodega()).expect(200);
    expect(outbound.body.map((r: any) => r.id)).toContain(id);

    const dispatched = await post(`/requisitions/${id}/dispatch`, as.bodega(), { warehouseId }).expect(201);
    await post(`/requisitions/${id}/deliver`, as.owner(), {}).expect(400);
    await post(`/requisitions/${id}/deliver`, as.owner(), { notes: 'Chofer confirmó por teléfono' }).expect(201);

    const transferId = dispatched.body.transfer.id;
    const receipt = { items: [{ productId: p1, quantityReceived: 1 }] };
    await post(`/inventory/transfers/${transferId}/receive`, as.invAdmin(), receipt).expect(400);
    await post(`/inventory/transfers/${transferId}/receive`, as.invAdmin(), { ...receipt, note: 'OIS sin tablet' }).expect(201);

    const history = await get(`/requisitions/${id}/history`, as.owner()).expect(200);
    expect(history.body.events.map((e: any) => e.action)).toEqual([
      'created_approved', 'dispatched', 'delivered_on_behalf', 'received_on_behalf',
    ]);
  });

  it('rejecting needs a reason and hides the requisition from Bodega', async () => {
    const created = await post('/requisitions', as.ois(), { items: [{ productId: p1, quantityRequested: 2 }] }).expect(201);
    const id = created.body.id;
    await post(`/requisitions/${id}/reject`, as.owner(), {}).expect(400);
    await post(`/requisitions/${id}/reject`, as.bodega(), { reason: 'x' }).expect(403);
    const rejected = await post(`/requisitions/${id}/reject`, as.owner(), { reason: 'Ya se surtió ayer' }).expect(201);
    expect(rejected.body.status).toBe('rejected');
    await get(`/requisitions/${id}`, as.bodega()).expect(403);
  });

  it('an offline retry with the same id returns the stored requisition without duplicating it', async () => {
    const clientId = randomUUID();
    const body = { id: clientId, items: [{ productId: p1, quantityRequested: 1 }] };
    await post('/requisitions', as.ois(), body).expect(201);
    const retry = await post('/requisitions', as.ois(), body).expect(201);
    expect(retry.body.id).toBe(clientId);
    expect(await query('SELECT 1 FROM requisition_item_ledger WHERE requisition_id = $1', [clientId])).toHaveLength(1);
  });
});
