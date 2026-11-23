import { Test } from '@nestjs/testing';
import { Global, INestApplication, Module } from '@nestjs/common';
import { SupervisorScopeService } from '../audit/supervisor-scope.service';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ReportsModule } from './reports.module';
import { ReportsService } from './reports.service';
import { DRIZZLE_CONNECTION } from '../../database/database.module';

const scopeMock = { assignedBranchIds: jest.fn() };
@Global()
@Module({ providers: [{ provide: SupervisorScopeService, useValue: scopeMock }], exports: [SupervisorScopeService] })
class ScopeTestModule {}

describe('Cash-shift audit authorization', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const reports = {
    getCashShiftAuditReport: jest.fn().mockResolvedValue({ ok: true }),
    getSalesDashboard: jest.fn().mockResolvedValue({}),
    getProductSalesReport: jest.fn().mockResolvedValue([]),
    getPaymentMethodsSalesReport: jest.fn().mockResolvedValue([]),
    getCashShiftsList: jest.fn().mockResolvedValue([]),
    getInventoryExistence: jest.fn().mockResolvedValue([]),
    getInventoryKardex: jest.fn().mockResolvedValue([]),
  };
  const actor = { sub: 'cashier-1', branchId: 'branch-1', businessId: 'business-1', role: 'cashier' };
  const token = (claims = actor) => jwt.sign(claims, { secret: process.env.JWT_SECRET || 'dev_jwt_secret_key' });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [ScopeTestModule, ReportsModule] })
      .overrideProvider(DRIZZLE_CONNECTION).useValue({})
      .overrideProvider(ReportsService).useValue(reports)
      .compile();
    app = module.createNestApplication();
    jwt = module.get(JwtService);
    // Listen on IPv4 loopback explicitly: an implicit listen(0) binds '::' while the
    // client dials 127.0.0.1, which can reach another jest worker's server.
    await app.listen(0, '127.0.0.1');
  });
  beforeEach(() => {
    jest.clearAllMocks();
    scopeMock.assignedBranchIds.mockResolvedValue(['branch-1', 'branch-2']);
  });
  afterAll(async () => app?.close());

  it('requires a bearer JWT', async () => {
    await request(app.getHttpServer()).get('/reports/cash-shifts/shift-1/audit').expect(401);
    expect(reports.getCashShiftAuditReport).not.toHaveBeenCalled();
  });

  it.each(['waiter', 'kitchen'])('rejects role %s', async role => {
    await request(app.getHttpServer()).get('/reports/cash-shifts/shift-1/audit')
      .auth(token({ ...actor, role }), { type: 'bearer' }).expect(403);
    expect(reports.getCashShiftAuditReport).not.toHaveBeenCalled();
  });

  it.each(['cashier', 'branch_operator', 'owner', 'inventory_admin', 'support_tech'])(
    'allows authenticated %s through to ownership service check',
    async (role) => {
      await request(app.getHttpServer())
        .get('/reports/cash-shifts/shift-1/audit')
        .auth(token({ ...actor, role }), { type: 'bearer' })
        .expect(200);
      expect(reports.getCashShiftAuditReport).toHaveBeenCalledWith(
        'shift-1',
        expect.objectContaining({ sub: actor.sub }),
        undefined,
      );
    },
  );

  it('passes assigned branches so a supervisor audits only those shifts (spec 019)', async () => {
    await request(app.getHttpServer())
      .get('/reports/cash-shifts/shift-1/audit')
      .auth(token({ ...actor, sub: 'sup-1', role: 'branch_supervisor', branchId: '' } as any), { type: 'bearer' })
      .expect(200);
    expect(reports.getCashShiftAuditReport).toHaveBeenCalledWith('shift-1', expect.objectContaining({ sub: 'sup-1' }), ['branch-1', 'branch-2']);
  });
});

describe('Report endpoints authorization (spec 019 R-1, D-9/P-3)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const reports = {
    getCashShiftAuditReport: jest.fn(),
    getSalesDashboard: jest.fn().mockResolvedValue({}),
    getProductSalesReport: jest.fn().mockResolvedValue([]),
    getPaymentMethodsSalesReport: jest.fn().mockResolvedValue([]),
    getCashShiftsList: jest.fn().mockResolvedValue([]),
    getInventoryExistence: jest.fn().mockResolvedValue([]),
    getInventoryKardex: jest.fn().mockResolvedValue([]),
  };
  const base = { sub: 'u-1', businessId: 'business-1', businessAccess: [{ businessId: 'business-1', role: 'owner' }] };
  const token = (claims: Record<string, unknown>) => jwt.sign({ ...base, ...claims }, { secret: process.env.JWT_SECRET || 'dev_jwt_secret_key' });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [ScopeTestModule, ReportsModule] })
      .overrideProvider(DRIZZLE_CONNECTION).useValue({})
      .overrideProvider(ReportsService).useValue(reports)
      .compile();
    app = module.createNestApplication();
    jwt = module.get(JwtService);
    // Listen on IPv4 loopback explicitly: an implicit listen(0) binds '::' while the
    // client dials 127.0.0.1, which can reach another jest worker's server.
    await app.listen(0, '127.0.0.1');
  });
  beforeEach(() => {
    jest.clearAllMocks();
    scopeMock.assignedBranchIds.mockResolvedValue(['branch-1']);
  });
  afterAll(async () => app?.close());

  const salesPaths = [
    '/reports/sales/products?businessId=business-1',
    '/reports/sales/payment-methods?businessId=business-1',
    '/reports/cash-shifts?businessId=business-1',
    '/reports/sales-dashboard?businessId=business-1',
  ];
  const inventoryPaths = [
    '/reports/inventory/existence?businessId=business-1',
    '/reports/inventory/kardex?businessId=business-1&productId=p-1',
  ];

  it.each([...salesPaths, ...inventoryPaths])('requires a JWT on %s (was unguarded)', async (path) => {
    await request(app.getHttpServer()).get(path).expect(401);
  });

  it.each([...salesPaths, ...inventoryPaths])('lets the owner read %s', async (path) => {
    await request(app.getHttpServer()).get(path).auth(token({ role: 'owner' }), { type: 'bearer' }).expect(200);
  });

  it.each(salesPaths)('rejects cashiers on %s', async (path) => {
    await request(app.getHttpServer()).get(path).auth(token({ role: 'cashier', branchId: 'branch-1' }), { type: 'bearer' }).expect(403);
  });

  it('a supervisor must pick an assigned branch for sales reports', async () => {
    const sup = token({ role: 'branch_supervisor', businessAccess: [{ businessId: 'business-1', role: 'branch_supervisor' }] });
    await request(app.getHttpServer()).get('/reports/sales/products?businessId=business-1').auth(sup, { type: 'bearer' }).expect(403);
    await request(app.getHttpServer()).get('/reports/sales/products?businessId=business-1&branchId=branch-9').auth(sup, { type: 'bearer' }).expect(403);
    await request(app.getHttpServer()).get('/reports/sales/products?businessId=business-1&branchId=branch-1').auth(sup, { type: 'bearer' }).expect(200);
    expect(reports.getProductSalesReport).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'branch-1' }));
  });

  it('the cash-shift list of a supervisor is limited to assigned branches', async () => {
    const sup = token({ role: 'branch_supervisor' });
    await request(app.getHttpServer()).get('/reports/cash-shifts?businessId=business-1').auth(sup, { type: 'bearer' }).expect(200);
    expect(reports.getCashShiftsList).toHaveBeenCalledWith(expect.objectContaining({ branchIds: ['branch-1'] }));
    await request(app.getHttpServer()).get('/reports/cash-shifts?businessId=business-1&branchId=branch-9').auth(sup, { type: 'bearer' }).expect(403);
  });

  it('inventory reports stay closed to supervisors in phase 1', async () => {
    await request(app.getHttpServer())
      .get('/reports/inventory/existence?businessId=business-1')
      .auth(token({ role: 'branch_supervisor' }), { type: 'bearer' })
      .expect(403);
  });
});
