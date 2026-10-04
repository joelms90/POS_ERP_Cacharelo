import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ReportsModule } from './reports.module';
import { ReportsService } from './reports.service';
import { DRIZZLE_CONNECTION } from '../../database/database.module';

describe('Cash-shift audit authorization', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const reports = { getCashShiftAuditReport: jest.fn().mockResolvedValue({ ok: true }) };
  const actor = { sub: 'cashier-1', branchId: 'branch-1', businessId: 'business-1', role: 'cashier' };
  const token = (claims = actor) => jwt.sign(claims, { secret: process.env.JWT_SECRET || 'dev_jwt_secret_key' });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [ReportsModule] })
      .overrideProvider(DRIZZLE_CONNECTION).useValue({})
      .overrideProvider(ReportsService).useValue(reports)
      .compile();
    app = module.createNestApplication();
    jwt = module.get(JwtService);
    await app.init();
  });
  beforeEach(() => jest.clearAllMocks());
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

  it.each(['cashier', 'branch_operator'])('allows authenticated %s through to ownership service check', async role => {
    await request(app.getHttpServer()).get('/reports/cash-shifts/shift-1/audit')
      .auth(token({ ...actor, role }), { type: 'bearer' }).expect(200);
    expect(reports.getCashShiftAuditReport).toHaveBeenCalledWith('shift-1', expect.objectContaining({ sub: actor.sub }));
  });
});
