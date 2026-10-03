import { SyncAccessService } from './sync-access.service';
import { getTableName } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

const actor = { sub: 'user-a', businessId: 'business-a', branchId: 'branch-a' };
describe('Sync isolation', () => {
  let access: SyncAccessService;
  let rows: Record<string, any[]>;
  beforeEach(() => {
    rows = {
      branches: [{ id: 'branch-a', businessId: 'business-a' }],
      users: [{ id: 'user-a', businessId: 'business-a', branchId: 'branch-a' }],
      orders: [{ id: 'own-order', branchId: 'branch-a' }, { id: 'foreign-order', branchId: 'branch-b' }],
      order_items: [{ id: 'foreign-item', orderId: 'foreign-order' }],
      products: [{ id: 'own-product', businessId: 'business-a' }, { id: 'foreign-product', businessId: 'business-b' }],
      branch_tables: [{ id: 'foreign-table', branchId: 'branch-b' }],
      cash_shifts: [{ id: 'foreign-shift', branchId: 'branch-b', cashierId: 'user-b' }],
      devices: [{ id: 'device', deviceUuid: 'device', branchId: 'branch-a', businessId: 'business-a', isActive: true }],
    };
    const db = { select: () => ({ from: (table: any) => ({ where: (query: any) => {
      const id = new PgDialect().sqlToQuery(query).params[0];
      return Promise.resolve((rows[getTableName(table)] ?? []).filter(row => row.id === id));
    } }) }) };
    access = new SyncAccessService(db as any);
  });
  it('allows own branch and rejects anonymous, expired and foreign scope', async () => {
    await expect(access.branch(actor)).resolves.toBe('branch-a');
    await expect(access.branch(undefined as any)).rejects.toThrow();
    await expect(access.branch({ ...actor, exp: 1 })).rejects.toThrow();
    await expect(access.branch(actor, 'branch-b')).rejects.toThrow();
    await expect(access.branch({ ...actor, businessId: 'business-b' })).rejects.toThrow();
  });
  it('accepts local offline order and item references', async () => {
    await expect(access.push(actor, { orders: [{ id: 'new-order', branchId: 'branch-a', waiterId: 'user-a' }], orderItems: [{ id: 'new-item', orderId: 'new-order', productId: 'own-product' }] })).resolves.toBeUndefined();
  });
  it.each([
    { orders: [{ id: 'foreign-order', branchId: 'branch-a' }] },
    { orders: [{ id: 'new-order', branchId: 'branch-b' }] },
    { orders: [{ id: 'new-order', branchId: 'branch-a', tableId: 'foreign-table' }] },
    { orderItems: [{ id: 'new-item', orderId: 'own-order', productId: 'foreign-product' }] },
    { orderItems: [{ id: 'foreign-item', orderId: 'own-order', productId: 'own-product' }] },
    { payments: [{ id: 'new-payment', orderId: 'foreign-order' }] },
    { cashShifts: [{ id: 'foreign-shift', branchId: 'branch-a', cashierId: 'user-a' }] },
    { cashTransactions: [{ id: 'new-cash', shiftId: 'foreign-shift' }] },
  ])('rejects foreign references and ID hijacking %j', async dto => {
    await expect(access.push(actor, dto)).rejects.toThrow();
  });
  it('requires active same-business, same-branch device for ack', async () => {
    await expect(access.device(actor, 'device')).resolves.toBeUndefined();
    rows.devices[0].branchId = 'branch-b';
    await expect(access.device(actor, 'device')).rejects.toThrow();
    rows.devices[0].branchId = 'branch-a'; rows.devices[0].isActive = false;
    await expect(access.device(actor, 'device')).rejects.toThrow();
  });
});
