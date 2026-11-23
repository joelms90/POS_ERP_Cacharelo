import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';

/**
 * Role gates (rejected before touching the database). The full flow — locking, stock,
 * average cost, ledger and audit — is covered against a real database in
 * purchase-orders.integration.spec.ts.
 */
describe('PurchaseOrdersService', () => {
  const repository = { findAll: jest.fn(), findByIdWithItems: jest.fn(), findByStatuses: jest.fn() };
  const db = { transaction: jest.fn() };
  const service = new PurchaseOrdersService(repository as any, {} as any, db as any, {} as any);

  const user = (role: string) => ({ sub: `${role}-1`, roles: [role], businessId: 'bus-1' });
  const owner = user('owner');
  const invAdmin = user('inventory_admin');
  const compras = user('warehouse_purchasing_operator');
  const support = user('support_tech');
  const ois = user('branch_operator');
  const dto = {
    businessId: 'bus-1',
    providerId: 'prov',
    warehouseId: 'wh',
    orderNumber: 'OC-1',
    items: [{ productId: 'p', quantity: 1, estimatedUnitCost: 1 }],
  };

  afterEach(() => jest.clearAllMocks());

  describe('who may do what', () => {
    afterEach(() => expect(db.transaction).not.toHaveBeenCalled());

    it.each([
      ['Almacén y Compras', compras],
      ['Soporte', support],
      ['OIS', ois],
    ])('%s cannot create, edit, authorize, cancel or close OCs', async (_, actor) => {
      await expect(service.create(dto as any, actor)).rejects.toThrow(ForbiddenException);
      await expect(service.update('po', {}, actor)).rejects.toThrow(ForbiddenException);
      await expect(service.remove('po', actor)).rejects.toThrow(ForbiddenException);
      await expect(service.authorize('po', actor)).rejects.toThrow(ForbiddenException);
      await expect(service.cancel('po', { reason: 'x' }, actor)).rejects.toThrow(ForbiddenException);
      await expect(service.closeShort('po', { reason: 'x' }, actor)).rejects.toThrow(ForbiddenException);
    });

    it.each([
      ['Soporte', support],
      ['OIS', ois],
    ])('%s cannot mark purchased or register an entrada', async (_, actor) => {
      await expect(service.markPurchased('po', {}, actor)).rejects.toThrow(ForbiddenException);
      await expect(service.receive('po', { items: [] } as any, actor)).rejects.toThrow(ForbiddenException);
    });

    it.each([
      ['owner', owner],
      ['admin inventario', invAdmin],
    ])('%s acting for Almacén y Compras must give a reason', async (_, actor) => {
      await expect(service.markPurchased('po', {}, actor)).rejects.toThrow(BadRequestException);
      await expect(
        service.receive('po', { items: [{ productId: 'p', quantityReceived: 1, unitCostActual: 1 }] }, actor),
      ).rejects.toThrow(BadRequestException);
    });

    it('cancel and close short require a reason', async () => {
      await expect(service.cancel('po', { reason: ' ' }, owner)).rejects.toThrow(BadRequestException);
      await expect(service.closeShort('po', { reason: '' }, invAdmin)).rejects.toThrow(BadRequestException);
    });
  });

  describe('reads', () => {
    it('hides drafts and cancelled OCs from Almacén y Compras', async () => {
      repository.findAll.mockResolvedValue([
        { id: 'a', status: 'draft' },
        { id: 'b', status: 'authorized' },
        { id: 'c', status: 'cancelled' },
        { id: 'd', status: 'purchased' },
      ]);
      expect((await service.findAll('bus-1', compras)).map((o: any) => o.id)).toEqual(['b', 'd']);
      expect((await service.findAll('bus-1', owner)).map((o: any) => o.id)).toEqual(['a', 'b', 'c', 'd']);
    });

    it('Almacén y Compras cannot open a draft', async () => {
      repository.findByIdWithItems.mockResolvedValue({ id: 'a', businessId: 'bus-1', status: 'draft' });
      await expect(service.findOne('a', compras)).rejects.toThrow(ForbiddenException);
      await expect(service.findOne('a', owner)).resolves.toMatchObject({ id: 'a' });
    });

    it('rejects another business', async () => {
      await expect(service.findAll('bus-2', { ...invAdmin, businessAccess: [{ businessId: 'bus-1' }] })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
