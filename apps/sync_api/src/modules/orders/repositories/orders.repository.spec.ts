import { OrdersRepository } from './orders.repository';
import { LedgerService } from '../../inventory/ledger.service';
import * as schema from '../../../database/schema';

// A tx mock where each `.select().from(TABLE)...` resolves to a predefined result.
function createTxMock(results: Map<any, any[]>) {
  const createBuilder = () => {
    let table: any = null;
    const builder: any = {};
    builder.from = jest.fn((t: any) => {
      table = t;
      return builder;
    });
    builder.where = jest.fn(() => builder);
    builder.limit = jest.fn(() => builder);
    builder.then = (resolve: any) =>
      Promise.resolve(results.get(table) ?? []).then(resolve);
    return builder;
  };

  return {
    select: jest.fn(() => createBuilder()),
  };
}

describe('OrdersRepository.deductInventoryForItems — per-sucursal sale deduction', () => {
  it('deducts a plain product from the branch (branchId), not the warehouse', async () => {
    const branchId = 'branch-1';
    const businessId = 'biz-1';
    const productId = 'prod-1';

    const applyMovement = jest.fn().mockResolvedValue(undefined);
    const ledgerService = { applyMovement } as unknown as LedgerService;

    const tx = createTxMock(
      new Map<any, any[]>([
        [schema.branches, [{ id: branchId, businessId }]],
        [schema.recipes, []],
      ]),
    );

    const repo = new OrdersRepository(null as any, ledgerService);
    await repo.deductInventoryForItems(tx, [{ productId, quantity: 3 }], branchId);

    expect(applyMovement).toHaveBeenCalledTimes(1);
    expect(applyMovement).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        businessId,
        productId,
        quantityDelta: -3,
        eventType: 'sale',
        branchId,
      }),
    );

    const movement = applyMovement.mock.calls[0][1];
    expect(movement.warehouseId).toBeUndefined();
  });

  it('deducts a recipe product and its components from the branch, not the warehouse', async () => {
    const branchId = 'branch-1';
    const businessId = 'biz-1';
    const productId = 'prod-1';
    const ingredientId = 'ing-1';

    const applyMovement = jest.fn().mockResolvedValue(undefined);
    const ledgerService = { applyMovement } as unknown as LedgerService;

    const tx = createTxMock(
      new Map<any, any[]>([
        [schema.branches, [{ id: branchId, businessId }]],
        [schema.recipes, [{ ingredientProductId: ingredientId, quantityNeeded: '0.5' }]],
        [schema.stockLevels, [{ id: 'stock-1', productId, quantity: '10' }]],
      ]),
    );

    const repo = new OrdersRepository(null as any, ledgerService);
    await repo.deductInventoryForItems(tx, [{ productId, quantity: 4 }], branchId);

    // Finished product deducted from the branch (covered entirely by finished stock)
    expect(applyMovement).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ productId, branchId, quantityDelta: -4, eventType: 'sale' }),
    );

    for (const call of applyMovement.mock.calls) {
      expect(call[1].warehouseId).toBeUndefined();
      expect(call[1].branchId).toBe(branchId);
    }
  });
});
