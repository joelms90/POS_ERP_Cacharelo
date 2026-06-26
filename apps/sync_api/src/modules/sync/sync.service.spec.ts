import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from './sync.service';
import { DRIZZLE_CONNECTION } from '../../database/database.module';

describe('SyncService', () => {
  let service: SyncService;

  const mockDb = {
    transaction: jest.fn(async (cb) => cb(mockDb)),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    onConflictDoUpdate: jest.fn().mockResolvedValue({}),
    onConflictDoNothing: jest.fn().mockResolvedValue({}),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        {
          provide: DRIZZLE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('push', () => {
    it('should run push transaction successfully', async () => {
      const pushDto = {
        orders: [{ id: 'order-1', state: 'closed', total: '150.00' }],
        payments: [{ id: 'pay-1', amount: '150.00', paymentMethod: 'cash' }],
      };

      const result = await service.push(pushDto);
      expect(result).toEqual({ success: true });
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  describe('pull', () => {
    it('should pull changes successfully', async () => {
      const result = await service.pull({ lastSyncedAt: '2026-06-25T00:00:00.000Z' });
      expect(result).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.changes).toBeDefined();
    });
  });

  describe('ack', () => {
    it('should save device sync checkpoint', async () => {
      mockDb.where.mockResolvedValue([]); // Device not found, will insert

      const result = await service.ack({
        deviceId: 'device-1',
        lastSyncedAt: '2026-06-25T00:00:00.000Z',
      });

      expect(result).toEqual({ success: true });
    });
  });
});
