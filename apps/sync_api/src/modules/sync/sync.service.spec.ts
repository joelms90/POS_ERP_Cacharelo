import { OrdersRepository } from '../orders/repositories/orders.repository';
import { SyncAccessService } from './sync-access.service';
const actor = { sub: 'user', businessId: 'business', branchId: '11111111-1111-4111-8111-111111111111' };
import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from './sync.service';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import { SyncGateway } from './sync.gateway';

describe('SyncService', () => {
  let service: SyncService;
  let selectRows: Array<{ id: string }>;

  const mockDb = {
    transaction: jest.fn(async (cb) => cb(mockDb)),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    onConflictDoUpdate: jest.fn().mockResolvedValue({}),
    onConflictDoNothing: jest.fn().mockResolvedValue({}),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn(() => Object.assign(Promise.resolve(selectRows), { for: () => Promise.resolve(selectRows) })),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
  };

  const mockSyncGateway = {
    broadcastChange: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: OrdersRepository, useValue: { deductInventoryForItems: jest.fn() } },
        { provide: SyncAccessService, useValue: { push: jest.fn(), branch: jest.fn().mockResolvedValue(actor.branchId), device: jest.fn() } },
        {
          provide: DRIZZLE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: SyncGateway,
          useValue: mockSyncGateway,
        },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    selectRows = [];
  });

  describe('push', () => {
    it('should run push transaction successfully', async () => {
      const timestamp = '2026-07-02T23:42:20.439816Z';
      selectRows = [
        { id: '11111111-1111-4111-8111-111111111111' },
        { id: '22222222-2222-4222-8222-222222222222' },
        { id: '33333333-3333-4333-8333-333333333333' },
        { id: '44444444-4444-4444-8444-444444444444' },
      ];
      const pushDto = {
        orders: [
          {
            id: '55555555-5555-4555-8555-555555555555',
            branchId: '11111111-1111-4111-8111-111111111111',
            tableId: '22222222-2222-4222-8222-222222222222',
            waiterId: '33333333-3333-4333-8333-333333333333',
            state: 'open',
            subtotal: '150.00',
            discount: '0.00',
            tax: '0.00',
            total: '150.00',
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
        orderItems: [
          {
            id: '66666666-6666-4666-8666-666666666666',
            orderId: '55555555-5555-4555-8555-555555555555',
            productId: '44444444-4444-4444-8444-444444444444',
            quantity: 1,
            price: '150.00',
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
        payments: [
          {
            id: '77777777-7777-4777-8777-777777777777',
            orderId: '55555555-5555-4555-8555-555555555555',
            amount: '150.00',
            paymentMethod: 'cash',
            createdAt: timestamp,
          },
        ],
      };

      const result = await service.push(pushDto, actor);
      expect(result).toEqual({ success: true });
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenNthCalledWith(
        1,
        expect.arrayContaining([
          expect.objectContaining({
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          }),
        ]),
      );
      expect(mockDb.values).toHaveBeenNthCalledWith(
        3,
        expect.arrayContaining([
          expect.objectContaining({
            createdAt: expect.any(Date),
          }),
        ]),
      );
    });

    it('should reject missing cloud references before the push transaction', async () => {
      selectRows = [];

      await expect(
        service.push({
          orders: [
            {
              id: '55555555-5555-4555-8555-555555555555',
              branchId: '11111111-1111-4111-8111-111111111111',
              tableId: '22222222-2222-4222-8222-222222222222',
              waiterId: '33333333-3333-4333-8333-333333333333',
              state: 'open',
              subtotal: '150.00',
              discount: '0.00',
              tax: '0.00',
              total: '150.00',
            },
          ],
          orderItems: [
            {
              id: '66666666-6666-4666-8666-666666666666',
              orderId: '55555555-5555-4555-8555-555555555555',
              productId: '44444444-4444-4444-8444-444444444444',
              quantity: 1,
              price: '150.00',
            },
          ],
        }, actor),
      ).rejects.toThrow('Sync push references do not exist');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });

  describe('pull', () => {
    it('should pull changes successfully', async () => {
      const result = await service.pull({
        branchId: '11111111-1111-4111-8111-111111111111',
        lastSyncedAt: '2026-06-25T00:00:00.000Z',
      }, actor);
      expect(result).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.changes).toBeDefined();
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });

    it('should throttle takeaway self-healing during frequent pulls', async () => {
      await service.pull({
        branchId: '11111111-1111-4111-8111-111111111111',
        lastSyncedAt: '2026-06-25T00:00:00.000Z',
      }, actor);
      await service.pull({
        branchId: '11111111-1111-4111-8111-111111111111',
        lastSyncedAt: '2026-06-25T00:00:00.000Z',
      }, actor);

      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('ack', () => {
    it('should save device sync checkpoint', async () => {
      mockDb.where.mockResolvedValue([]); // Device not found, will insert

      const result = await service.ack({
        deviceId: 'device-1',
        lastSyncedAt: '2026-06-25T00:00:00.000Z',
      }, actor);

      expect(result).toEqual({ success: true });
    });
  });
});
