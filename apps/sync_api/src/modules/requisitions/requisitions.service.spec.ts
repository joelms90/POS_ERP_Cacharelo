import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RequisitionsService } from './requisitions.service';
import { mergeRequestedItems, primaryRole, qty, sameQty } from './requisition-flow';

/**
 * Role gates and pure helpers. The full flow (SQL, stock, ledger, audit) is covered
 * against a real database in requisitions.integration.spec.ts.
 */
describe('RequisitionsService', () => {
  const repository = {
    findByRequester: jest.fn(),
    findByIdWithItems: jest.fn(),
    findByStatuses: jest.fn(),
    findAll: jest.fn(),
  };
  const db = { transaction: jest.fn() };
  const service = new RequisitionsService(repository as any, db as any, {} as any, {} as any, {} as any);

  const user = (role: string, extra: object = {}) => ({ sub: `${role}-1`, roles: [role], businessId: 'bus-1', ...extra });
  const ois = user('branch_operator', { branchId: 'branch-1' });
  const bodega = user('warehouse_purchasing_operator');
  const owner = user('owner');
  const invAdmin = user('inventory_admin');
  const support = user('support_tech');

  afterEach(() => jest.clearAllMocks());

  describe('who may do what (rejected before touching the database)', () => {
    afterEach(() => expect(db.transaction).not.toHaveBeenCalled());

    it.each([
      ['bodega', bodega],
      ['soporte', support],
    ])('%s cannot create requisitions', async (_, actor) => {
      await expect(service.createForOperator({ items: [{ productId: 'p', quantityRequested: 1 }] } as any, actor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it.each([
      ['bodega', bodega],
      ['soporte', support],
      ['OIS', ois],
    ])('%s cannot approve or reject', async (_, actor) => {
      await expect(service.approve('r', {}, actor)).rejects.toThrow(ForbiddenException);
      await expect(service.reject('r', { reason: 'x' }, actor)).rejects.toThrow(ForbiddenException);
    });

    it.each([
      ['owner', owner],
      ['admin inventario', invAdmin],
      ['OIS', ois],
    ])('%s cannot do the warehouse step (hold / dispatch)', async (_, actor) => {
      await expect(service.hold('r', { reason: 'x' }, actor)).rejects.toThrow(ForbiddenException);
      await expect(service.dispatch('r', {}, actor)).rejects.toThrow(ForbiddenException);
    });

    it('owner may mark delivered on behalf of bodega only with a reason', async () => {
      await expect(service.deliver('r', {}, owner)).rejects.toThrow(BadRequestException);
      await expect(service.deliver('r', {}, ois)).rejects.toThrow(ForbiddenException);
    });

    it('requires a reason to reject or hold', async () => {
      await expect(service.reject('r', { reason: '  ' }, owner)).rejects.toThrow(BadRequestException);
      await expect(service.hold('r', { reason: '' }, bodega)).rejects.toThrow(BadRequestException);
    });
  });

  describe('reads', () => {
    it('returns only the current operator requisitions, scoped by the signed login', async () => {
      repository.findByRequester.mockResolvedValue([{ id: 'req-1' }]);
      await service.findMine(ois, 'approved');
      expect(repository.findByRequester).toHaveBeenCalledWith('bus-1', 'branch-1', 'branch_operator-1', 'approved');
    });

    it('hides unapproved and rejected requisitions from bodega', async () => {
      repository.findAll.mockResolvedValue([
        { id: 'a', status: 'pending_approval' },
        { id: 'b', status: 'approved' },
        { id: 'c', status: 'rejected' },
        { id: 'd', status: 'in_transit' },
      ]);
      expect((await service.findAll('bus-1', bodega)).map((r: any) => r.id)).toEqual(['b', 'd']);
      expect((await service.findAll('bus-1', owner)).map((r: any) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    });

    it('bodega cannot open a requisition that is not authorized yet', () => {
      expect(() => service.assertMayRead(bodega, { businessId: 'bus-1', status: 'pending_approval' })).toThrow(ForbiddenException);
      expect(() => service.assertMayRead(bodega, { businessId: 'bus-1', status: 'approved' })).not.toThrow();
    });

    it('an OIS reads only its own branch requisitions', () => {
      expect(() => service.assertMayRead(ois, { businessId: 'bus-1', fromBranchId: 'branch-2', status: 'approved' })).toThrow(
        ForbiddenException,
      );
      expect(() => service.assertMayRead(ois, { businessId: 'bus-1', fromBranchId: 'branch-1', status: 'approved' })).not.toThrow();
    });
  });

  describe('helpers', () => {
    it('merges repeated products into one line', () => {
      expect(
        mergeRequestedItems([
          { productId: 'p1', quantityRequested: 1.5 },
          { productId: 'p2', quantityRequested: 2 },
          { productId: 'p1', quantityRequested: 0.25 },
        ]),
      ).toEqual([
        { productId: 'p1', quantityRequested: 1.75 },
        { productId: 'p2', quantityRequested: 2 },
      ]);
    });

    it('compares quantities at the stored 3-decimal precision', () => {
      expect(qty('2.0004')).toBe(2);
      expect(sameQty(1.0001, 1)).toBe(true);
      expect(sameQty(1.001, 1)).toBe(false);
    });

    it('records the most specific role of the actor', () => {
      expect(primaryRole({ roles: ['branch_operator', 'owner'] })).toBe('owner');
      expect(primaryRole({ roles: ['encargado'] })).toBe('branch_operator');
    });
  });
});
