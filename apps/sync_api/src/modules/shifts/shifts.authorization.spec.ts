import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ShiftsModule } from './shifts.module';
import { ShiftsRepository } from './repositories/shifts.repository';
import { TransactionsRepository } from './repositories/transactions.repository';
import { DatabaseModule, DRIZZLE_CONNECTION } from '../../database/database.module';

// Exercise real routing, JWT/role guards and service, with no database writes.
describe('Cash shift HTTP authorization', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const actor = { sub: 'cashier-a', branchId: 'branch-a', businessId: 'business-a', role: 'branch_operator' };
  const shift = { id: 'shift-a', cashierId: actor.sub, branchId: actor.branchId, status: 'open', initialFloat: '100.00', cashDrawerAmount: '100.00' };
  const repo = { findActiveShift: jest.fn(), findById: jest.fn(), create: jest.fn(), update: jest.fn(), closeAllOpenForBranch: jest.fn() };
  const transactions = { create: jest.fn(), findByShiftId: jest.fn() };
  const token = (claims = actor) => jwt.sign(claims, { secret: process.env.JWT_SECRET || 'dev_jwt_secret_key' });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [ShiftsModule, DatabaseModule] })
      .overrideProvider(DRIZZLE_CONNECTION).useValue({})
      .overrideProvider(ShiftsRepository).useValue(repo)
      .overrideProvider(TransactionsRepository).useValue(transactions)
      .compile();
    app = module.createNestApplication();
    jwt = module.get(JwtService);
    await app.init();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    repo.findById.mockResolvedValue(shift);
    repo.findActiveShift.mockResolvedValue(null);
    repo.create.mockImplementation(async (data) => ({ id: 'new', ...data }));
  });
  afterAll(async () => { await app?.close(); });

  it.each([
    ['post', '/cash-shifts'], ['get', '/cash-shifts/active'], ['get', '/cash-shifts/shift-a'],
    ['post', '/cash-shifts/shift-a/transactions'], ['post', '/cash-shifts/shift-a/close'],
  ])('rejects unauthenticated %s %s', async (method, path) => {
    await (request(app.getHttpServer()) as any)[method](path).send({}).expect(401);
    expect(repo.findById).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('rejects a tampered token', async () => {
    await request(app.getHttpServer()).get('/cash-shifts/active').auth('invalid', { type: 'bearer' }).expect(401);
  });
  it.each(['kitchen', 'waiter', 'warehouse_purchasing_operator'])('rejects role %s', async role => {
    await request(app.getHttpServer()).post('/cash-shifts').auth(token({ ...actor, role }), { type: 'bearer' }).send({ initialFloat: '100.00' }).expect(403);
  });
  it.each(['branch_operator', 'cashier', 'encargado', 'responsable'])('opens own shift for %s without caller IDs', async role => {
    const response = await request(app.getHttpServer()).post('/cash-shifts').auth(token({ ...actor, role }), { type: 'bearer' }).send({ initialFloat: '100.00' }).expect(201);
    expect(response.body).toMatchObject({ cashierId: actor.sub, branchId: actor.branchId });
    expect(repo.closeAllOpenForBranch).not.toHaveBeenCalled();
  });
  it.each([{ branchId: 'other' }, { cashierId: 'other' }])('rejects spoofed IDs %j', async extra => {
    await request(app.getHttpServer()).post('/cash-shifts').auth(token(), { type: 'bearer' }).send({ initialFloat: '100.00', ...extra }).expect(403);
    expect(repo.create).not.toHaveBeenCalled();
  });
  it('rejects unbound login', async () => {
    await request(app.getHttpServer()).get('/cash-shifts/active').auth(token({ ...actor, branchId: '' }), { type: 'bearer' }).expect(403);
  });
  it('looks up only the signed actor and branch', async () => {
    repo.findActiveShift.mockResolvedValue(shift);
    await request(app.getHttpServer()).get('/cash-shifts/active').auth(token(), { type: 'bearer' }).expect(200);
    expect(repo.findActiveShift).toHaveBeenCalledWith(actor.branchId, actor.sub);
  });
  it.each(['branchId', 'cashierId'])('rejects foreign active lookup %s', async key => {
    await request(app.getHttpServer()).get('/cash-shifts/active').query({ [key]: 'other' }).auth(token(), { type: 'bearer' }).expect(403);
    expect(repo.findActiveShift).not.toHaveBeenCalled();
  });
  it.each([
    ['get', '', 'branchId'], ['get', '', 'cashierId'],
    ['post', '/transactions', 'branchId'], ['post', '/transactions', 'cashierId'],
    ['post', '/close', 'branchId'], ['post', '/close', 'cashierId'],
  ])('rejects foreign shift %s %s by %s without writes', async (method, suffix, key) => {
    repo.findById.mockResolvedValue({ ...shift, [key]: 'other' });
    await (request(app.getHttpServer()) as any)[method]('/cash-shifts/shift-a' + suffix).auth(token(), { type: 'bearer' }).send({}).expect(403);
    expect(repo.update).not.toHaveBeenCalled();
    expect(transactions.create).not.toHaveBeenCalled();
  });
  it('does not auto-close another cashier shift on open', async () => {
    repo.findActiveShift.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...shift, cashierId: 'other' });
    await request(app.getHttpServer()).post('/cash-shifts').auth(token(), { type: 'bearer' }).send({ initialFloat: '100.00' }).expect(409);
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.closeAllOpenForBranch).not.toHaveBeenCalled();
  });
});
