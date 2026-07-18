import { Test, TestingModule } from '@nestjs/testing';
import { RequisitionsRepository } from './requisitions.repository';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';

describe('RequisitionsRepository', () => {
  let repository: RequisitionsRepository;

  const createMockDb = (rows: any[]) => {
    let count = 0;

    const createQueryBuilder = (methodCalls: string[] = []): any => {
      const recordCall = (method: string) => createQueryBuilder([...methodCalls, method]);

      const qb = {
        select: jest.fn().mockImplementation(() => recordCall('select')),
        from: jest.fn().mockImplementation(() => recordCall('from')),
        where: jest.fn().mockImplementation(() => recordCall('where')),
        update: jest.fn().mockImplementation(() => recordCall('update')),
        set: jest.fn().mockImplementation(() => recordCall('set')),
        insert: jest.fn().mockImplementation(() => recordCall('insert')),
        values: jest.fn().mockImplementation(() => recordCall('values')),
        returning: jest.fn().mockImplementation(() => recordCall('returning')),
        then: function(onFulfilled, onRejected) {
          count++;
          const res = rows[count - 1] || [];
          return Promise.resolve(res).then(onFulfilled, onRejected);
        },
      };
      return qb;
    };

    const db: any = createQueryBuilder();
    db.transaction = jest.fn(async (cb) => cb(db));
    return db;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequisitionsRepository,
        {
          provide: DRIZZLE_CONNECTION,
          useValue: {},
        },
      ],
    }).compile();

    repository = module.get<RequisitionsRepository>(RequisitionsRepository);
  });

  describe('updateStatus', () => {
    const requisitionId = 'req-uuid-1';
    const businessId = 'bus-uuid-1';
    const fromBranchId = 'branch-uuid-1';
    const toWarehouseId = 'wh-uuid-1';
    const productId = 'prod-uuid-1';
    const transferId = 'transfer-uuid-1';

    it('should generate stock transfer and items when status is approved', async () => {
      const dbRows = [
        // 1. Update status
        [{ id: requisitionId, businessId, fromBranchId, toWarehouseId, notes: 'Need baking flour' }],
        // 2. Fetch requisition items
        [{ requisitionId, productId, quantityRequested: '10.000' }],
        // 3. Fetch product costs
        [{ id: productId, cost: '4.50' }],
        // 4. Create stock transfer
        [{ id: transferId, businessId, fromWarehouseId: toWarehouseId, toBranchId: fromBranchId, status: 'pending' }],
        // 5. Create stock transfer items
        [],
      ];

      const mockDb = createMockDb(dbRows);
      // Inject mockDb directly
      (repository as any).db = mockDb;

      const result = await repository.updateStatus(requisitionId, 'approved', 'Approved by manager');

      expect(result).toBeDefined();
      expect(result.id).toBe(requisitionId);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should not create stock transfer when status is rejected', async () => {
      const dbRows = [
        // 1. Update status
        [{ id: requisitionId, businessId, fromBranchId, toWarehouseId, status: 'rejected' }],
      ];

      const mockDb = createMockDb(dbRows);
      (repository as any).db = mockDb;

      const result = await repository.updateStatus(requisitionId, 'rejected', 'Not approved');

      expect(result).toBeDefined();
      expect(result.status).toBe('rejected');
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });
});
