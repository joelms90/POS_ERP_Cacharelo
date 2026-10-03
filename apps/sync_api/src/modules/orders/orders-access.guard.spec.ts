import { OrdersAccessGuard } from './orders-access.guard';
import { ForbiddenException } from '@nestjs/common';

describe('OrdersAccessGuard', () => {
  const actor = { sub: 'user', businessId: 'business', branchId: 'branch', role: 'branch_operator' };
  function probe(overrides: any = {}, rows: any[] = []) {
    const where = jest.fn();
    rows.forEach(row => where.mockResolvedValueOnce(row ? [row] : []));
    const db = { select: () => ({ from: () => ({ where }) }) };
    const guard = new OrdersAccessGuard(db as any);
    const req = { user: actor, query: {}, params: {}, body: {}, ...overrides };
    return { result: guard.canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as any), where };
  }
  it('allows own branch order', async () => {
    await expect(probe({params:{id:'order'}}, [{branchId:'branch'}, {businessId:'business'}]).result).resolves.toBe(true);
  });
  it('rejects missing actor', async () => {
    await expect(probe({user:undefined}).result).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects foreign branch order even with a business query override', async () => {
    await expect(probe({params:{id:'order'},query:{businessId:'business'}}, [{branchId:'foreign'}]).result).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects foreign business even for owner', async () => {
    await expect(probe({user:{...actor, role:'owner'},query:{branchId:'foreign'}}, [{businessId:'other'}]).result).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each(['tableId', 'waiterId'])('rejects foreign %s reference', async key => {
    await expect(probe({body:{[key]:'foreign'}}, [{businessId:'business'}, {businessId:'other', branchId:'other'}]).result).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects foreign product reference', async () => {
    await expect(probe({body:{items:[{productId:'foreign'}]}}, [{businessId:'business'}, {businessId:'other'}]).result).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects unknown branch', async () => {
    await expect(probe({}, [null]).result).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects operator business-wide listing', async () => {
    await expect(probe({route:{path:'/api/orders/active/business'},query:{businessId:'business'}}).result).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('allows owner business-wide listing only for own business', async () => {
    await expect(probe({user:{...actor,role:'owner'},route:{path:'/api/orders/active/business'},query:{businessId:'business'}}).result).resolves.toBe(true);
    await expect(probe({user:{...actor,role:'owner'},route:{path:'/api/orders/active/business'},query:{businessId:'other'}}).result).rejects.toBeInstanceOf(ForbiddenException);
  });
});
