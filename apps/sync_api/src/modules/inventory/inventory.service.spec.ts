import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './repositories/inventory.repository';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import { NotFoundException } from '@nestjs/common';

describe('InventoryService - Average Cost Recalculation', () => {
  let service: InventoryService;

  const createMockDb = (rows: any[]) => {
    let count = 0;
    let product: any = null;

    const createQueryBuilder = (methodCalls: string[] = []): any => {
      const recordCall = (method: string) => createQueryBuilder([...methodCalls, method]);

      const qb = {
        select: jest.fn().mockImplementation(() => recordCall('select')),
        from: jest.fn().mockImplementation(() => recordCall('from')),
        leftJoin: jest.fn().mockImplementation(() => recordCall('leftJoin')),
        where: jest.fn().mockImplementation(() => recordCall('where')),
        limit: jest.fn().mockImplementation(() => recordCall('limit')),
        update: jest.fn().mockImplementation(() => recordCall('update')),
        set: jest.fn(function(data) {
          if (data && data.cost) {
            product = data;
          }
          return recordCall('set');
        }),
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
    db.getUpdatedProduct = () => product;
    return db;
  };

  const mockInventoryRepository = {
    getDb: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: InventoryRepository,
          useValue: mockInventoryRepository,
        },
        {
          provide: DRIZZLE_CONNECTION,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processPurchaseOrderReception', () => {
    const poId = 'po-uuid-1';
    const businessId = 'bus-uuid-1';
    const warehouseId = 'wh-uuid-1';
    const productId = 'prod-uuid-1';

    it('should calculate weighted average cost under normal stock conditions', async () => {
      const dbRows = [
        [{ id: poId, businessId, warehouseId, poNumber: 'OC-0001', status: 'sent' }], // 1. PO lookup
        [], // 2. Update PO item
        [{ id: productId, cost: '5.00', businessId }], // 3. Product info lookup
        [{ quantity: '10.000' }], // 4. Stock levels sum
        [], // 5. Product cost update
        [{ id: 'stock-level-id', quantity: '10.000' }], // 6. Destination stock lookup
        [], // 7. Update stock levels
        [], // 8. Log stock movement
        [{ productId, quantityOrdered: '15.000', quantityReceived: '15.000' }], // 9. PO items status check
        [{ id: poId, status: 'received' }], // 10. Update PO status
      ];

      const mockDb = createMockDb(dbRows);
      mockInventoryRepository.getDb.mockReturnValue(mockDb);

      const receiptItems = [
        { productId, quantityReceived: 5, unitCostActual: 8.0 },
      ];

      const result = await service.processPurchaseOrderReception(poId, receiptItems, 'Normal reception');

      expect(result.success).toBe(true);
      expect(result.status).toBe('received');
      // Formula: (10 stock * 5.00 cost + 5 received * 8.00 cost) / (10 + 5) = (50 + 40) / 15 = 90 / 15 = 6.00
      const updatedProduct = mockDb.getUpdatedProduct();
      expect(updatedProduct).toBeDefined();
      expect(updatedProduct.cost).toBe('6'); // 6.00
    });

    it('should default to actual cost under zero stock conditions', async () => {
      const dbRows = [
        [{ id: poId, businessId, warehouseId, poNumber: 'OC-0001', status: 'sent' }], // 1. PO lookup
        [], // 2. Update PO item
        [{ id: productId, cost: '5.00', businessId }], // 3. Product info lookup
        [{ quantity: '0.000' }], // 4. Stock levels sum
        [], // 5. Product cost update
        [], // 6. Destination stock lookup (empty)
        [], // 7. Insert stock levels
        [], // 8. Log stock movement
        [{ productId, quantityOrdered: '15.000', quantityReceived: '10.000' }], // 9. PO items status check
        [{ id: poId, status: 'partially_received' }], // 10. Update PO status
      ];

      const mockDb = createMockDb(dbRows);
      mockInventoryRepository.getDb.mockReturnValue(mockDb);

      const receiptItems = [
        { productId, quantityReceived: 10, unitCostActual: 8.5 },
      ];

      const result = await service.processPurchaseOrderReception(poId, receiptItems, 'Zero stock reception');

      expect(result.success).toBe(true);
      expect(result.status).toBe('partially_received');
      const updatedProduct = mockDb.getUpdatedProduct();
      expect(updatedProduct).toBeDefined();
      expect(updatedProduct.cost).toBe('8.5'); // Default to actual cost
    });

    it('should default to actual cost under negative stock conditions', async () => {
      const dbRows = [
        [{ id: poId, businessId, warehouseId, poNumber: 'OC-0001', status: 'sent' }], // 1. PO lookup
        [], // 2. Update PO item
        [{ id: productId, cost: '5.00', businessId }], // 3. Product info lookup
        [{ quantity: '-5.000' }], // 4. Stock levels sum
        [], // 5. Product cost update
        [{ id: 'stock-level-id', quantity: '-5.000' }], // 6. Destination stock lookup
        [], // 7. Update stock levels
        [], // 8. Log stock movement
        [{ productId, quantityOrdered: '15.000', quantityReceived: '15.000' }], // 9. PO items status check
        [{ id: poId, status: 'received' }], // 10. Update PO status
      ];

      const mockDb = createMockDb(dbRows);
      mockInventoryRepository.getDb.mockReturnValue(mockDb);

      const receiptItems = [
        { productId, quantityReceived: 15, unitCostActual: 9.00 },
      ];

      const result = await service.processPurchaseOrderReception(poId, receiptItems, 'Negative stock reception');

      expect(result.success).toBe(true);
      expect(result.status).toBe('received');
      const updatedProduct = mockDb.getUpdatedProduct();
      expect(updatedProduct).toBeDefined();
      expect(updatedProduct.cost).toBe('9'); // Default to actual cost
    });
  });
});
