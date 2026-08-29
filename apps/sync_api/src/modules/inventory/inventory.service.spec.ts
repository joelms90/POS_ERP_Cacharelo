import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './repositories/inventory.repository';
import { LedgerService } from './ledger.service';
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
        innerJoin: jest.fn().mockImplementation(() => recordCall('innerJoin')),
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

  const mockLedgerService = {
    applyMovement: jest.fn().mockResolvedValue(undefined),
    getStockLevel: jest.fn().mockResolvedValue(0),
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
          provide: LedgerService,
          useValue: mockLedgerService,
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
        [{ productId, quantityOrdered: '15.000', quantityReceived: '15.000' }], // 6. PO items status check
        [{ id: poId, status: 'received' }], // 7. Update PO status
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
        [{ productId, quantityOrdered: '15.000', quantityReceived: '10.000' }], // 6. PO items status check
        [{ id: poId, status: 'partially_received' }], // 7. Update PO status
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
        [{ productId, quantityOrdered: '15.000', quantityReceived: '15.000' }], // 6. PO items status check
        [{ id: poId, status: 'received' }], // 7. Update PO status
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

  describe('Production Order (OP) Lifecycle', () => {
    const warehouseId = 'wh-origin-1';
    const destWarehouseId = 'wh-dest-2';
    const productId = 'prod-finished-1';
    const ingredientId = 'prod-raw-1';
    const businessId = 'bus-uuid-1';
    const runId = 'op-uuid-1';

    it('should create a planned OP with pending status without deducting stock', async () => {
      const dbRows = [
        [{ id: 'rec-1', parentProductId: productId, ingredientProductId: ingredientId, quantityNeeded: '2' }], // 1. Recipe
        [{ id: productId, businessId, name: 'Pizza Margherita' }], // 2. Product
        [{ id: runId, status: 'pending' }], // 3. Insert productionRun returning
      ];

      const mockDb = createMockDb(dbRows);
      mockInventoryRepository.getDb.mockReturnValue(mockDb);

      const result = await service.assembleProduct({
        warehouseId,
        destinationWarehouseId: destWarehouseId,
        productId,
        quantityProduced: 5,
        status: 'pending',
        notes: 'Producción programada',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('pending');
      expect(result.productionRunId).toBe(runId);
      expect(mockLedgerService.applyMovement).not.toHaveBeenCalled();
    });

    it('should start a pending OP and transition to in_progress', async () => {
      const dbRows = [
        [{ id: runId, status: 'pending' }], // 1. Find run
        [], // 2. Update status
      ];

      const mockDb = createMockDb(dbRows);
      mockInventoryRepository.getDb.mockReturnValue(mockDb);

      const result = await service.startProductionRun(runId);

      expect(result.success).toBe(true);
      expect(result.status).toBe('in_progress');
      expect(result.productionRunId).toBe(runId);
    });

    it('should complete an OP, updating status and applying ledger movements to origin and destination warehouses', async () => {
      const dbRows = [
        [{ id: runId, productId, warehouseId, destinationWarehouseId: destWarehouseId, quantityProduced: '5', status: 'in_progress' }], // 1. Find run
        [{ id: 'rec-1', parentProductId: productId, ingredientProductId: ingredientId, quantityNeeded: '2', ingredientName: 'Harina' }], // 2. Recipe
        [{ quantity: '20.000' }], // 3. Stock check for ingredient
        [{ id: productId, businessId, name: 'Pizza Margherita' }], // 4. Product
        [], // 5. Update OP record
      ];

      const mockDb = createMockDb(dbRows);
      mockInventoryRepository.getDb.mockReturnValue(mockDb);

      const result = await service.completeProductionRun(runId, {
        actualQuantityProduced: 5,
        destinationWarehouseId: destWarehouseId,
        notes: 'Producción finalizada exitosamente',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      // Should have 2 movements: 1 production_output (destination) + 1 production_input (origin)
      expect(mockLedgerService.applyMovement).toHaveBeenCalledTimes(2);
    });

    it('should cancel a pending OP', async () => {
      const dbRows = [
        [{ id: runId, status: 'pending' }], // 1. Find run
        [], // 2. Update status
      ];

      const mockDb = createMockDb(dbRows);
      mockInventoryRepository.getDb.mockReturnValue(mockDb);

      const result = await service.cancelProductionRun(runId);

      expect(result.success).toBe(true);
      expect(result.status).toBe('cancelled');
    });
  });
});
