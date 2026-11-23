/**
 * Spec 019 — end-to-end HTTP test of the cash approval chain against a real
 * PostgreSQL (guards, validation, services, SQL, CAS, ledger reversals, triggers).
 *
 * Runs only when SUPERVISION_IT_DATABASE_URL is set, e.g. the local docker DB:
 *   SUPERVISION_IT_DATABASE_URL=postgres://pos_user:pos_password@localhost:5432/pos_dev \
 *     npx jest src/modules/supervision/supervision.integration.spec.ts
 * It creates an isolated business and removes its rows afterwards.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';

const DATABASE_URL = process.env.SUPERVISION_IT_DATABASE_URL;
const describeIt = DATABASE_URL ? describe : describe.skip;

describeIt('Spec 019 supervision chain (integration, real DB)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let pool: any;
  const businessId = randomUUID();
  const branchA = randomUUID();
  const branchB = randomUUID();
  const ids = {
    cashier: randomUUID(),
    ois: randomUUID(),
    ois2: randomUUID(),
    supervisor: randomUUID(),
    supervisor2: randomUUID(),
    foreignSupervisor: randomUUID(),
    owner: randomUUID(),
  };
  const state: Record<string, any> = {};
  const originalFlag = process.env.CASH_APPROVALS_ENFORCE_OPEN_BLOCK;

  const token = (userId: string, role: string, branchId: string | null) =>
    jwt.sign(
      {
        sub: userId,
        role,
        roles: [role],
        branchId,
        businessId,
        businessAccess: [{ businessId, role }],
      },
      { secret: process.env.JWT_SECRET || 'dev_jwt_secret_key' },
    );
  const as = {
    cashier: () => token(ids.cashier, 'cashier', branchA),
    ois: () => token(ids.ois, 'branch_operator', branchA),
    ois2: () => token(ids.ois2, 'branch_operator', branchA),
    supervisor: () => token(ids.supervisor, 'branch_supervisor', null),
    supervisor2: () => token(ids.supervisor2, 'branch_supervisor', null),
    foreignSupervisor: () =>
      token(ids.foreignSupervisor, 'branch_supervisor', null),
    owner: () => token(ids.owner, 'owner', null),
  };
  const http = () => request(app.getHttpServer());
  const query = async (text: string, params: unknown[] = []) =>
    (await pool.query(text, params)).rows;
  const shiftRow = async (id: string) =>
    (await query('SELECT * FROM cash_shifts WHERE id = $1', [id]))[0];

  beforeAll(async () => {
    process.env.DATABASE_URL = DATABASE_URL;
    // Deferred require so the connection pool picks up DATABASE_URL set above.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { DatabaseModule } = require('../../database/database.module');
    const { AuditModule } = require('../audit/audit.module');
    const { SupervisionModule } = require('./supervision.module');
    const { ShiftsModule } = require('../shifts/shifts.module');
    const { ReportsModule } = require('../reports/reports.module');
    ({ pool } = require('../../database/connection'));
    /* eslint-enable @typescript-eslint/no-require-imports */

    await query('INSERT INTO businesses (id, name) VALUES ($1, $2)', [
      businessId,
      `IT-019 ${businessId.slice(0, 8)}`,
    ]);
    await query(
      'INSERT INTO branches (id, business_id, name) VALUES ($1, $3, $4), ($2, $3, $5)',
      [branchA, branchB, businessId, 'IT Sucursal A', 'IT Sucursal B'],
    );
    const users: Array<[string, string, string | null, string]> = [
      [ids.cashier, 'cashier', branchA, 'IT Cajero'],
      [ids.ois, 'branch_operator', branchA, 'IT OIS'],
      [ids.ois2, 'branch_operator', branchA, 'IT OIS 2'],
      [ids.supervisor, 'branch_supervisor', null, 'IT Supervisor'],
      [ids.supervisor2, 'branch_supervisor', null, 'IT Supervisor 2'],
      [ids.foreignSupervisor, 'branch_supervisor', null, 'IT Supervisor B'],
      [ids.owner, 'owner', null, 'IT Owner'],
    ];
    for (const [id, role, branchId, name] of users) {
      await query(
        `INSERT INTO users (id, business_id, branch_id, name, pin, role, roles) VALUES ($1, $2, $3, $4, 'x', $5, $6::jsonb)`,
        [id, businessId, branchId, name, role, JSON.stringify([role])],
      );
    }
    await query(
      `INSERT INTO supervisor_branch_assignments (business_id, user_id, branch_id, assigned_by)
       VALUES ($1, $2, $4, $5), ($1, $3, $4, $5), ($1, $6, $7, $5)`,
      [
        businessId,
        ids.supervisor,
        ids.supervisor2,
        branchA,
        ids.owner,
        ids.foreignSupervisor,
        branchB,
      ],
    );

    const moduleRef = await Test.createTestingModule({
      imports: [
        DatabaseModule,
        AuditModule,
        ShiftsModule,
        SupervisionModule,
        ReportsModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    // Listen on IPv4 loopback explicitly: an implicit listen(0) binds '::' while the
    // client dials 127.0.0.1, which can reach another jest worker's server.
    await app.listen(0, '127.0.0.1');
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    process.env.CASH_APPROVALS_ENFORCE_OPEN_BLOCK = originalFlag;
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL session_replication_role = replica');
        const branches = [branchA, branchB];
        await client.query('DELETE FROM notifications WHERE business_id = $1', [
          businessId,
        ]);
        await client.query('DELETE FROM audit_log WHERE business_id = $1', [
          businessId,
        ]);
        await client.query('DELETE FROM cashier_debts WHERE business_id = $1', [
          businessId,
        ]);
        await client.query(
          'DELETE FROM cash_transactions WHERE shift_id IN (SELECT id FROM cash_shifts WHERE branch_id = ANY($1::uuid[]))',
          [branches],
        );
        await client.query(
          'DELETE FROM cash_shifts WHERE branch_id = ANY($1::uuid[])',
          [branches],
        );
        await client.query(
          'DELETE FROM supervisor_branch_assignments WHERE business_id = $1',
          [businessId],
        );
        await client.query('DELETE FROM users WHERE business_id = $1', [
          businessId,
        ]);
        await client.query('DELETE FROM branches WHERE business_id = $1', [
          businessId,
        ]);
        await client.query('DELETE FROM businesses WHERE id = $1', [
          businessId,
        ]);
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    }
    await app?.close();
    await pool?.end();
  });

  // --- Cashier corte with a pending movement -------------------------------------------------

  it('cashier opens a shift, records a pending movement and closes the Corte Z into N1', async () => {
    const opened = await http()
      .post('/cash-shifts')
      .auth(as.cashier(), { type: 'bearer' })
      .send({ initialFloat: '1000.00' })
      .expect(201);
    state.shiftA = opened.body.id;

    const movement = await http()
      .post(`/cash-shifts/${state.shiftA}/transactions`)
      .auth(as.cashier(), { type: 'bearer' })
      .send({
        type: 'cash-out',
        amount: '800.00',
        reason: 'Gasto operativo: proveedor',
        category: 'gasto_operativo',
        clientUuid: `it-${randomUUID()}`,
      })
      .expect(201);
    state.expense = movement.body.transaction;
    expect(state.expense).toMatchObject({
      approvalStatus: 'pendiente_n1',
      entryKind: 'movimiento',
      createdBy: ids.cashier,
    });

    // MV-05: a cash-out that would leave expected cash negative is rejected.
    await http()
      .post(`/cash-shifts/${state.shiftA}/transactions`)
      .auth(as.cashier(), { type: 'bearer' })
      .send({ type: 'cash-out', amount: '5000.00', reason: 'Retiro excesivo' })
      .expect(422);

    // Counted 200 = 1000 − 800 → balanced at close.
    const closed = await http()
      .post(`/cash-shifts/${state.shiftA}/close`)
      .auth(as.cashier(), { type: 'bearer' })
      .send({ actualAmount: '200.00', clientUuid: `close-${state.shiftA}` })
      .expect(200);
    expect(closed.body.report.summary.cashDifference).toBe(0);

    const row = await shiftRow(state.shiftA);
    expect(row).toMatchObject({
      review_status: 'pendiente_n1',
      n1_resolver_role: 'branch_operator',
      closed_by: ids.cashier,
    });

    // Retrying the same close is idempotent.
    const retry = await http()
      .post(`/cash-shifts/${state.shiftA}/close`)
      .auth(as.cashier(), { type: 'bearer' })
      .send({ actualAmount: '200.00', clientUuid: `close-${state.shiftA}` })
      .expect(200);
    expect(retry.body.duplicate).toBe(true);
  });

  it('notifies the OIS that the corte and the movement await N1', async () => {
    const res = await http()
      .get('/notifications')
      .auth(as.ois(), { type: 'bearer' })
      .expect(200);
    const entityIds = res.body.map((n: any) => n.entityId);
    expect(entityIds).toEqual(
      expect.arrayContaining([state.shiftA, state.expense.id]),
    );
    const count = await http()
      .get('/notifications/unread-count')
      .auth(as.ois(), { type: 'bearer' })
      .expect(200);
    expect(count.body.requiresAction).toBeGreaterThanOrEqual(2);
  });

  it('N1 rules: no self-approval, no supervisor/owner substitution (S-6), stale version → 409, pending movements → 422', async () => {
    const shift = await shiftRow(state.shiftA);
    const approve = (tok: string, version = shift.version) =>
      http()
        .post(`/supervision/cash-shifts/${state.shiftA}/approve`)
        .auth(tok, { type: 'bearer' })
        .send({ version });
    await approve(as.cashier()).expect(403);
    await approve(as.supervisor()).expect(403);
    await approve(as.owner()).expect(403);
    await approve(as.ois(), shift.version + 7).expect(422); // pending movement checked before version
    // OIS approves the cashier's movement (S-1: final at N1).
    const mv = await http()
      .post(`/supervision/cash-movements/${state.expense.id}/approve`)
      .auth(as.ois(), { type: 'bearer' })
      .send({ version: 1 })
      .expect(200);
    expect(mv.body.movement.approvalStatus).toBe('aprobado');
    await approve(as.ois(), shift.version + 7).expect(409);
  });

  it('OIS approves N1 → pendiente_n2; the OIS cannot act at N2', async () => {
    const shift = await shiftRow(state.shiftA);
    const res = await http()
      .post(`/supervision/cash-shifts/${state.shiftA}/approve`)
      .auth(as.ois(), { type: 'bearer' })
      .send({ version: shift.version, reason: 'Conteo verificado' })
      .expect(200);
    expect(res.body.reviewStatus).toBe('pendiente_n2');
    await http()
      .post(`/supervision/cash-shifts/${state.shiftA}/approve`)
      .auth(as.ois2(), { type: 'bearer' })
      .send({ version: res.body.version })
      .expect(403);
  });

  it('inbox: the assigned supervisor sees the corte as actionable; a foreign supervisor sees nothing and cannot open it', async () => {
    const mine = await http()
      .get('/supervision/approvals?type=corte_z')
      .auth(as.supervisor(), { type: 'bearer' })
      .expect(200);
    const item = mine.body.cortes.find((c: any) => c.id === state.shiftA);
    expect(item).toMatchObject({
      reviewStatus: 'pendiente_n2',
      canAct: true,
      level: 'n2',
    });
    const foreign = await http()
      .get('/supervision/approvals')
      .auth(as.foreignSupervisor(), { type: 'bearer' })
      .expect(200);
    expect(
      foreign.body.cortes.find((c: any) => c.id === state.shiftA),
    ).toBeUndefined();
    await http()
      .get(`/supervision/cash-shifts/${state.shiftA}`)
      .auth(as.foreignSupervisor(), { type: 'bearer' })
      .expect(403);
  });

  it('S-4: impact preview, then the supervisor cancels the approved expense with a ledger reversal → $800 shortage', async () => {
    const impact = await http()
      .get(
        `/supervision/cash-movements/${state.expense.id}/impact?action=cancel`,
      )
      .auth(as.supervisor(), { type: 'bearer' })
      .expect(200);
    expect(impact.body).toMatchObject({
      currentDifference: 0,
      resultingDifference: -800,
    });

    await http()
      .post(`/supervision/cash-movements/${state.expense.id}/cancel`)
      .auth(as.supervisor(), { type: 'bearer' })
      .send({ version: 2, reason: 'Sin comprobante' })
      .expect(200);
    const reversals = await query(
      'SELECT * FROM cash_transactions WHERE reverses_transaction_id = $1',
      [state.expense.id],
    );
    expect(reversals).toHaveLength(1);
    expect(Number(reversals[0].cash_effect)).toBe(800);

    const detail = await http()
      .get(`/supervision/cash-shifts/${state.shiftA}`)
      .auth(as.supervisor(), { type: 'bearer' })
      .expect(200);
    expect(detail.body.figures).toMatchObject({
      expectedAtClose: 200,
      postCloseAdjustment: 800,
      adjustedExpected: 1000,
      counted: 200,
      originalDifference: 0,
      adjustedDifference: -800,
      reconciliationStatus: 'SHORTAGE',
    });
    // The close snapshot is never rewritten.
    const row = await shiftRow(state.shiftA);
    expect(row.close_snapshot.summary.expectedCash).toBe(200);
  });

  it('reports expose the close snapshot intact plus post-close adjustments and a server reconciliation status', async () => {
    const audit = await http()
      .get(`/reports/cash-shifts/${state.shiftA}/audit`)
      .auth(as.owner(), { type: 'bearer' })
      .expect(200);
    expect(audit.body.summary.expectedCash).toBe(200);
    expect(audit.body.review).toMatchObject({
      reviewStatus: 'pendiente_n2',
      expectedAtClose: 200,
      postCloseAdjustment: 800,
      adjustedExpected: 1000,
      adjustedDifference: -800,
      reconciliationStatus: 'SHORTAGE',
      isOfficial: false,
    });
    const list = await http()
      .get(`/reports/cash-shifts?businessId=${businessId}`)
      .auth(as.supervisor(), { type: 'bearer' })
      .expect(200);
    expect(list.body.find((r: any) => r.id === state.shiftA)).toMatchObject({
      adjustedDifference: -800,
      reconciliationStatus: 'SHORTAGE',
    });
    await http()
      .get(`/reports/cash-shifts/${state.shiftA}/audit`)
      .auth(as.foreignSupervisor(), { type: 'bearer' })
      .expect(403);
  });

  it('the ledger rejects in-place edits of financial columns', async () => {
    await expect(
      query('UPDATE cash_transactions SET amount = 1 WHERE id = $1', [
        state.expense.id,
      ]),
    ).rejects.toThrow(/immutable/);
    await expect(
      query('DELETE FROM cash_transactions WHERE id = $1', [state.expense.id]),
    ).rejects.toThrow(/append-only/);
  });

  it('N2 rejection → recount by the OIS goes straight back to N2 (S-5)', async () => {
    let row = await shiftRow(state.shiftA);
    await http()
      .post(`/supervision/cash-shifts/${state.shiftA}/reject`)
      .auth(as.supervisor(), { type: 'bearer' })
      .send({ version: row.version })
      .expect(400); // reason is mandatory
    await http()
      .post(`/supervision/cash-shifts/${state.shiftA}/reject`)
      .auth(as.supervisor(), { type: 'bearer' })
      .send({ version: row.version, reason: 'Recontar el sobre de gastos' })
      .expect(200);
    const recount = await http()
      .post(`/cash-shifts/${state.shiftA}/recount`)
      .auth(as.ois(), { type: 'bearer' })
      .send({ actualAmount: '250.00', notes: 'Se encontraron $50 en el sobre' })
      .expect(200);
    expect(recount.body).toMatchObject({
      reviewStatus: 'pendiente_n2',
      recountCount: 1,
    });
    row = await shiftRow(state.shiftA);
    expect(Number(row.cash_drawer_amount)).toBe(250);
  });

  it('N2 approval freezes the official figures and creates the cashier debt (D-8)', async () => {
    const row = await shiftRow(state.shiftA);
    const res = await http()
      .post(`/supervision/cash-shifts/${state.shiftA}/approve`)
      .auth(as.supervisor(), { type: 'bearer' })
      .send({ version: row.version })
      .expect(200);
    expect(res.body.reviewStatus).toBe('aprobado');
    expect(Number(res.body.approvedDifference)).toBe(-750);
    expect(res.body.approvalSnapshot.adjustedExpected).toBe(1000);
    const debts = await query(
      'SELECT * FROM cashier_debts WHERE shift_id = $1',
      [state.shiftA],
    );
    expect(debts).toHaveLength(1);
    expect(debts[0]).toMatchObject({
      cashier_id: ids.cashier,
      status: 'vigente',
    });
    expect(Number(debts[0].amount)).toBe(750);
    const mine = await http()
      .get('/supervision/debts?mine=true')
      .auth(as.cashier(), { type: 'bearer' })
      .expect(200);
    expect(mine.body.map((d: any) => d.shiftId)).toContain(state.shiftA);
  });

  it('MV-04: no more reversals once the corte has final approval', async () => {
    const adjust = await query(
      `SELECT id, version FROM cash_transactions WHERE shift_id = $1 AND entry_kind = 'movimiento'`,
      [state.shiftA],
    );
    await http()
      .post(`/supervision/cash-movements/${adjust[0].id}/adjust`)
      .auth(as.owner(), { type: 'bearer' })
      .send({
        version: adjust[0].version,
        amount: '100.00',
        reason: 'Corrección tardía',
      })
      .expect(409);
  });

  it('owner reopens: corte back to N2 and the debt is voided; the supervisor cannot reopen', async () => {
    await http()
      .post(`/supervision/cash-shifts/${state.shiftA}/reopen`)
      .auth(as.supervisor(), { type: 'bearer' })
      .send({ reason: 'Revisión' })
      .expect(403);
    const res = await http()
      .post(`/supervision/cash-shifts/${state.shiftA}/reopen`)
      .auth(as.owner(), { type: 'bearer' })
      .send({ reason: 'Apareció el comprobante del gasto' })
      .expect(200);
    expect(res.body.reviewStatus).toBe('pendiente_n2');
    const debts = await query(
      'SELECT status FROM cashier_debts WHERE shift_id = $1',
      [state.shiftA],
    );
    expect(debts.map((d: any) => d.status)).toEqual(['anulado']);
  });

  it('audit log records every step with level, actor and before/after', async () => {
    const res = await http()
      .get(
        `/supervision/audit-log?entityType=cash_shift&entityId=${state.shiftA}`,
      )
      .auth(as.owner(), { type: 'bearer' })
      .expect(200);
    const actions = res.body.map((e: any) => e.action).reverse();
    expect(actions).toEqual([
      'corte_z_cerrado',
      'corte_z_aprobado',
      'corte_z_rechazado',
      'corte_z_reconteo',
      'corte_z_aprobado',
      'corte_z_reabierto',
    ]);
    expect(
      res.body.find((e: any) => e.action === 'corte_z_rechazado'),
    ).toMatchObject({
      approvalLevel: 'n2',
      actorId: ids.supervisor,
      reason: 'Recontar el sobre de gastos',
    });
    await expect(
      query('DELETE FROM audit_log WHERE business_id = $1', [businessId]),
    ).rejects.toThrow(/append-only/);
  });

  // --- OIS-authored corte: S-3, C-1 and the opening block (D-4, C-2, P-2) ----------------------

  it('S-3: a corte closed by the OIS is resolved at N1 by the supervisor; C-1: the same supervisor cannot do N2', async () => {
    process.env.CASH_APPROVALS_ENFORCE_OPEN_BLOCK = 'true';
    const opened = await http()
      .post('/cash-shifts')
      .auth(as.ois(), { type: 'bearer' })
      .send({ initialFloat: '500.00' })
      .expect(201);
    state.shiftB = opened.body.id;
    await http()
      .post(`/cash-shifts/${state.shiftB}/close`)
      .auth(as.ois(), { type: 'bearer' })
      .send({ actualAmount: '500.00' })
      .expect(200);
    let row = await shiftRow(state.shiftB);
    expect(row).toMatchObject({
      review_status: 'pendiente_n1',
      n1_resolver_role: 'branch_supervisor',
    });

    // D-4 + C-2: the branch cannot open a new shift until N1.
    const blocked = await http()
      .post('/cash-shifts')
      .auth(as.cashier(), { type: 'bearer' })
      .send({ initialFloat: '100.00' })
      .expect(409);
    expect(blocked.body.code).toBe('OPENING_BLOCKED_PENDING_CORTE');

    // Another OIS cannot resolve N1 of an OIS corte; the owner cannot either (S-6).
    await http()
      .post(`/supervision/cash-shifts/${state.shiftB}/approve`)
      .auth(as.ois2(), { type: 'bearer' })
      .send({ version: row.version })
      .expect(403);
    await http()
      .post(`/supervision/cash-shifts/${state.shiftB}/approve`)
      .auth(as.owner(), { type: 'bearer' })
      .send({ version: row.version })
      .expect(403);
    const n1 = await http()
      .post(`/supervision/cash-shifts/${state.shiftB}/approve`)
      .auth(as.supervisor(), { type: 'bearer' })
      .send({ version: row.version })
      .expect(200);
    expect(n1.body.reviewStatus).toBe('pendiente_n2');
    await http()
      .post(`/supervision/cash-shifts/${state.shiftB}/approve`)
      .auth(as.supervisor(), { type: 'bearer' })
      .send({ version: n1.body.version })
      .expect(403);
    const n2 = await http()
      .post(`/supervision/cash-shifts/${state.shiftB}/approve`)
      .auth(as.supervisor2(), { type: 'bearer' })
      .send({ version: n1.body.version })
      .expect(200);
    expect(n2.body.reviewStatus).toBe('aprobado');
    row = await shiftRow(state.shiftB);
    expect(row.operator_reviewed_by).toBe(ids.supervisor);
    expect(row.reviewed_by).toBe(ids.supervisor2);
  });

  it('P-2: the owner unblocks the opening without approving the pending corte', async () => {
    const opened = await http()
      .post('/cash-shifts')
      .auth(as.cashier(), { type: 'bearer' })
      .send({ initialFloat: '100.00' })
      .expect(201);
    state.shiftC = opened.body.id;
    await http()
      .post(`/cash-shifts/${state.shiftC}/close`)
      .auth(as.cashier(), { type: 'bearer' })
      .send({ actualAmount: '100.00' })
      .expect(200);
    await http()
      .post('/cash-shifts')
      .auth(as.ois(), { type: 'bearer' })
      .send({ initialFloat: '100.00' })
      .expect(409);
    await http()
      .post(`/supervision/cash-shifts/${state.shiftC}/override-open-block`)
      .auth(as.supervisor(), { type: 'bearer' })
      .send({ reason: 'El OIS no vino' })
      .expect(403);
    await http()
      .post(`/supervision/cash-shifts/${state.shiftC}/override-open-block`)
      .auth(as.owner(), { type: 'bearer' })
      .send({ reason: 'El OIS no vino hoy' })
      .expect(200);
    const row = await shiftRow(state.shiftC);
    expect(row.review_status).toBe('pendiente_n1');
    await http()
      .post('/cash-shifts')
      .auth(as.ois(), { type: 'bearer' })
      .send({ initialFloat: '100.00' })
      .expect(201);
  });

  it('lists only the branches a supervisor can see', async () => {
    const res = await http()
      .get('/supervision/branches')
      .auth(as.supervisor(), { type: 'bearer' })
      .expect(200);
    expect(res.body.map((b: any) => b.id)).toEqual([branchA]);
  });

  it('D-5: an offline queue syncs movements with their real time and an idempotent offline close', async () => {
    // Fresh cashier in branch B: branch A still has an open shift from the P-2 test.
    const cashierB = randomUUID();
    await query(
      `INSERT INTO users (id, business_id, branch_id, name, pin, role, roles) VALUES ($1, $2, $3, 'IT Cajero B', 'x', 'cashier', '["cashier"]'::jsonb)`,
      [cashierB, businessId, branchB],
    );
    const asCashierB = () => token(cashierB, 'cashier', branchB);
    const pause = () => new Promise((resolve) => setTimeout(resolve, 30));
    const opened = await http().post('/cash-shifts').auth(asCashierB(), { type: 'bearer' }).send({ initialFloat: '300.00' }).expect(201);
    const shiftId = opened.body.id;
    await pause();
    const occurredAt = new Date().toISOString();
    await pause();
    const closedAt = new Date().toISOString();
    await pause();
    const movementUuid = `it-offline-${randomUUID()}`;
    const send = () =>
      http()
        .post(`/cash-shifts/${shiftId}/transactions`)
        .auth(asCashierB(), { type: 'bearer' })
        .send({ type: 'cash-out', amount: '50.00', reason: 'Gasto offline', category: 'gasto_operativo', clientUuid: movementUuid, occurredAt });
    await send().expect(201);
    const dup = await send().expect(201);
    expect(dup.body.duplicate).toBe(true);
    const closeBody = { actualAmount: '250.00', clientUuid: `close-${movementUuid}`, closedAt, closedOffline: true, localExpectedCash: '250.00' };
    await http().post(`/cash-shifts/${shiftId}/close`).auth(asCashierB(), { type: 'bearer' }).send(closeBody).expect(200);
    const retry = await http().post(`/cash-shifts/${shiftId}/close`).auth(asCashierB(), { type: 'bearer' }).send(closeBody).expect(200);
    expect(retry.body.duplicate).toBe(true);
    const detail = await http().get(`/supervision/cash-shifts/${shiftId}`).auth(as.owner(), { type: 'bearer' }).expect(200);
    expect(detail.body.shift).toMatchObject({ closedOffline: true, localExpectedCash: 250 });
    expect(detail.body.figures).toMatchObject({ expectedAtClose: 250, postCloseAdjustment: 0, adjustedDifference: 0 });
    const rows = await query('SELECT created_at FROM cash_transactions WHERE client_uuid = $1', [movementUuid]);
    expect(new Date(rows[0].created_at).toISOString()).toBe(occurredAt);
  });

  it('assignments are owner-only and audited', async () => {
    await http()
      .put(`/supervision/assignments/${ids.foreignSupervisor}`)
      .auth(as.supervisor(), { type: 'bearer' })
      .send({ businessId, branchIds: [branchA] })
      .expect(403);
    const res = await http()
      .put(`/supervision/assignments/${ids.foreignSupervisor}`)
      .auth(as.owner(), { type: 'bearer' })
      .send({ businessId, branchIds: [branchA, branchB] })
      .expect(200);
    expect(res.body.added).toEqual([branchA]);
    const list = await http()
      .get(`/supervision/assignments?businessId=${businessId}`)
      .auth(as.owner(), { type: 'bearer' })
      .expect(200);
    const foreign = list.body.find((s: any) => s.id === ids.foreignSupervisor);
    expect(foreign.branches.map((b: any) => b.branchId).sort()).toEqual(
      [branchA, branchB].sort(),
    );
  });

  it('notifications can be marked read', async () => {
    const list = await http()
      .get('/notifications?unread=true')
      .auth(as.cashier(), { type: 'bearer' })
      .expect(200);
    expect(list.body.length).toBeGreaterThan(0);
    await http()
      .post(`/notifications/${list.body[0].id}/read`)
      .auth(as.cashier(), { type: 'bearer' })
      .expect(200);
    await http()
      .post(`/notifications/${list.body[0].id}/read`)
      .auth(as.ois(), { type: 'bearer' })
      .expect(404);
    const all = await http()
      .post('/notifications/read-all')
      .auth(as.cashier(), { type: 'bearer' })
      .expect(200);
    expect(all.body.updated).toBe(list.body.length - 1);
  });

  it('rejects unauthenticated and unrelated roles', async () => {
    await http().get('/supervision/approvals').expect(401);
    await http().get('/notifications').expect(401);
    await http()
      .get('/supervision/approvals')
      .auth(token(randomUUID(), 'kitchen', branchA), { type: 'bearer' })
      .expect(403);
  });
});
