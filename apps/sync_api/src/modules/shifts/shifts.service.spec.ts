import { Test, TestingModule } from '@nestjs/testing';
import { ShiftsService } from './shifts.service';
import { ShiftsRepository } from './repositories/shifts.repository';
import { TransactionsRepository } from './repositories/transactions.repository';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('ShiftsService', () => {
  let service: ShiftsService;
  let shiftsRepository: ShiftsRepository;
  let transactionsRepository: TransactionsRepository;

  const mockShiftsRepository = {
    findActiveShift: jest.fn(),
    findLastClosedShift: jest.fn().mockResolvedValue(null),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    closeAllOpenForBranch: jest.fn().mockResolvedValue(undefined),
  };

  const mockTransactionsRepository = {
    findByShiftId: jest.fn(),
    create: jest.fn(),
  };

  const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockImplementation(() => {
      const p: any = Promise.resolve([
        { paymentMethod: 'cash', amount: '150.00' },
        { paymentMethod: 'card', amount: '300.00' },
      ]);
      p.orderBy = jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      });
      return p;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShiftsService,
        {
          provide: ShiftsRepository,
          useValue: mockShiftsRepository,
        },
        {
          provide: TransactionsRepository,
          useValue: mockTransactionsRepository,
        },
        {
          provide: DRIZZLE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<ShiftsService>(ShiftsService);
    shiftsRepository = module.get<ShiftsRepository>(ShiftsRepository);
    transactionsRepository = module.get<TransactionsRepository>(TransactionsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Corte X/Z reports', () => {
    const openShift = {
      id: 'shift-1', branchId: 'branch-1', cashierId: 'cashier-1',
      status: 'open', initialFloat: '100.00', cashDrawerAmount: '100.00',
      openedAt: new Date('2026-09-24T08:00:00Z'), closedAt: null,
      denominationCounts: null, closeNotes: null,
    };

    it('returns a live Corte X with cash/card totals for an open shift', async () => {
      mockShiftsRepository.findById.mockResolvedValue(openShift);
      mockTransactionsRepository.findByShiftId.mockResolvedValue([]);

      const report = await service.getCorteReport('shift-1', 'x');
      expect(report.summary).toMatchObject({
        initialFloat: 100,
        cashSales: 150,
        cardSales: 300,
        totalSales: 450,
        actualCash: null,
      });
    });

    it('only permits Corte Z after the shift is closed', async () => {
      mockShiftsRepository.findById.mockResolvedValue(openShift);
      await expect(service.getCorteReport('shift-1', 'z')).rejects.toThrow(ConflictException);
    });
  });

  describe('openShift', () => {
    it('should open shift successfully when no active shift exists', async () => {
      const openDto = {
        cashierId: 'cashier-1',
        branchId: 'branch-1',
        initialFloat: '1000.00',
      };

      mockShiftsRepository.findActiveShift.mockResolvedValue(null);
      mockShiftsRepository.create.mockResolvedValue({ id: 'shift-1', ...openDto, status: 'open' });

      const result = await service.openShift(openDto);
      expect(result).toBeDefined();
      expect(result.id).toBe('shift-1');
      expect(shiftsRepository.findActiveShift).toHaveBeenCalledWith('branch-1', 'cashier-1');
    });

    it('should throw ConflictException if shift is already active for this cashier', async () => {
      const openDto = {
        cashierId: 'cashier-1',
        branchId: 'branch-1',
        initialFloat: '1000.00',
      };

      mockShiftsRepository.findActiveShift.mockResolvedValueOnce({ id: 'shift-active', status: 'open' });

      await expect(service.openShift(openDto)).rejects.toThrow(
        new ConflictException('A cash shift is already active for this cashier and branch.')
      );
    });

    it('should throw ConflictException if another cashier has an active shift within 24 hours', async () => {
      const openDto = {
        cashierId: 'cashier-1',
        branchId: 'branch-1',
        initialFloat: '1000.00',
      };

      // First call (branchId, cashierId): null
      mockShiftsRepository.findActiveShift.mockResolvedValueOnce(null);
      // Second call (branchId): active shift opened 2 hours ago
      mockShiftsRepository.findActiveShift.mockResolvedValueOnce({
        id: 'shift-other',
        branchId: 'branch-1',
        cashierId: 'cashier-2',
        status: 'open',
        openedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      });

      await expect(service.openShift(openDto)).rejects.toThrow(
        new ConflictException('Another cash shift is active for this branch. Close it before opening a new one.')
      );
    });

    it('should auto-close stale active shift (>24h) and open new shift', async () => {
      const openDto = {
        cashierId: 'cashier-1',
        branchId: 'branch-1',
        initialFloat: '1000.00',
      };

      // First call (branchId, cashierId): null
      mockShiftsRepository.findActiveShift.mockResolvedValueOnce(null);
      // Second call (branchId): stale active shift opened 30 hours ago
      mockShiftsRepository.findActiveShift.mockResolvedValueOnce({
        id: 'shift-stale',
        branchId: 'branch-1',
        cashierId: 'cashier-2',
        status: 'open',
        openedAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
      });
      mockShiftsRepository.update.mockResolvedValueOnce({ id: 'shift-stale', status: 'closed' });
      mockShiftsRepository.create.mockResolvedValueOnce({ id: 'shift-new', ...openDto, status: 'open' });

      const result = await service.openShift(openDto);
      expect(result.id).toBe('shift-new');
      expect(mockShiftsRepository.update).toHaveBeenCalledWith('shift-stale', expect.objectContaining({
        status: 'closed',
        closeNotes: expect.stringContaining('>24h'),
      }));
    });
  });

  describe('createTransaction', () => {
    it('should log cash-in transaction and update drawer amount', async () => {
      const shift = {
        id: 'shift-1',
        cashierId: 'cashier-1',
        branchId: 'branch-1',
        initialFloat: '1000.00',
        cashDrawerAmount: '1000.00',
        status: 'open',
      };

      const txDto = {
        type: 'cash-in' as const,
        amount: '200.00',
        reason: 'Refund customer',
      };

      mockShiftsRepository.findById.mockResolvedValue(shift);
      mockTransactionsRepository.create.mockResolvedValue({ id: 'tx-1', ...txDto });
      mockShiftsRepository.update.mockResolvedValue({
        ...shift,
        cashDrawerAmount: '1200.00',
      });

      const result = await service.createTransaction('shift-1', txDto);
      expect(result.transaction).toBeDefined();
      expect(result.shift.cashDrawerAmount).toBe('1200.00');
    });

    it('should log cash-out transaction and update drawer amount', async () => {
      const shift = {
        id: 'shift-1',
        cashierId: 'cashier-1',
        branchId: 'branch-1',
        initialFloat: '1000.00',
        cashDrawerAmount: '1000.00',
        status: 'open',
      };

      const txDto = {
        type: 'cash-out' as const,
        amount: '100.00',
        reason: 'Office supplies',
      };

      mockShiftsRepository.findById.mockResolvedValue(shift);
      mockTransactionsRepository.create.mockResolvedValue({ id: 'tx-2', ...txDto });
      mockShiftsRepository.update.mockResolvedValue({
        ...shift,
        cashDrawerAmount: '900.00',
      });

      const result = await service.createTransaction('shift-1', txDto);
      expect(result.transaction).toBeDefined();
      expect(result.shift.cashDrawerAmount).toBe('900.00');
    });

    it('should throw NotFoundException if shift does not exist', async () => {
      mockShiftsRepository.findById.mockResolvedValue(null);
      await expect(
        service.createTransaction('999', {
          type: 'cash-in',
          amount: '100.00',
          reason: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if shift is closed', async () => {
      mockShiftsRepository.findById.mockResolvedValue({ id: 'shift-1', status: 'closed' });
      await expect(
        service.createTransaction('shift-1', {
          type: 'cash-in',
          amount: '100.00',
          reason: 'Test',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('closeShift', () => {
    it('should successfully close shift and return reconciliation report', async () => {
      const shift = {
        id: 'shift-1',
        cashierId: 'cashier-1',
        branchId: 'branch-1',
        initialFloat: '1000.00',
        cashDrawerAmount: '1000.00',
        status: 'open',
        openedAt: new Date(Date.now() - 3600000),
      };

      const txs = [
        { id: 'tx-1', type: 'cash-in', amount: '200.00' },
        { id: 'tx-2', type: 'cash-out', amount: '100.00' },
      ];

      mockShiftsRepository.findById.mockResolvedValue(shift);
      mockTransactionsRepository.findByShiftId.mockResolvedValue(txs);
      mockShiftsRepository.update.mockResolvedValue({
        ...shift,
        status: 'closed',
        cashDrawerAmount: '1250.00',
      });

      // expected = 1000 + 200 - 100 + 150 (from mocked db return) = 1250
      // actual amount counted is 1250.00
      const result = await service.closeShift('shift-1', { actualAmount: '1250.00' });
      expect(result.shift.status).toBe('closed');
      expect(result.reconciliation).toMatchObject({
        initialFloat: '1000.00',
        totalCashSales: '150.00',
        totalCashIn: '200.00',
        totalCashOut: '100.00',
        expectedAmount: '1250.00',
        actualAmount: '1250.00',
        discrepancy: '0.00',
        cashSales: 150,
        cardSales: 300,
        totalSales: 450,
        expectedCash: 1250,
        actualCash: 1250,
        cashDifference: 0,
      });
      expect(result.report.summary).toMatchObject({
        cashSales: 150,
        cardSales: 300,
        totalSales: 450,
        expectedCash: 1250,
        actualCash: 1250,
        cashDifference: 0,
      });
      expect(shiftsRepository.update).toHaveBeenCalledWith(
        'shift-1',
        expect.objectContaining({
          closeSnapshot: expect.objectContaining({
            summary: expect.objectContaining({ cardSales: 300 }),
          }),
        }),
      );
    });

    it('should report discrepancy if actual amount differs from expected', async () => {
      const shift = {
        id: 'shift-1',
        cashierId: 'cashier-1',
        branchId: 'branch-1',
        initialFloat: '1000.00',
        cashDrawerAmount: '1000.00',
        status: 'open',
        openedAt: new Date(Date.now() - 3600000),
      };

      mockShiftsRepository.findById.mockResolvedValue(shift);
      mockTransactionsRepository.findByShiftId.mockResolvedValue([]);
      mockShiftsRepository.update.mockResolvedValue({
        ...shift,
        status: 'closed',
        cashDrawerAmount: '1100.00',
      });

      // expected = 1000 + 150 = 1150
      // actual counted is 1100
      // discrepancy = 1100 - 1150 = -50
      const result = await service.closeShift('shift-1', { actualAmount: '1100.00' });
      expect(result.reconciliation.discrepancy).toBe('-50.00');
    });

    it('stores denomination counts and close notes in the immutable snapshot', async () => {
      const shift = {
        id: 'shift-1',
        cashierId: 'cashier-1',
        branchId: 'branch-1',
        initialFloat: '1000.00',
        cashDrawerAmount: '1000.00',
        status: 'open',
        openedAt: new Date(Date.now() - 3600000),
      };

      mockShiftsRepository.findById.mockResolvedValue(shift);
      mockTransactionsRepository.findByShiftId.mockResolvedValue([]);
      mockShiftsRepository.update.mockResolvedValue({
        ...shift,
        status: 'closed',
        cashDrawerAmount: '1150.00',
      });

      const denominationCounts = { '500': 2, '100': 1, '50': 1 };
      const result = await service.closeShift('shift-1', {
        actualAmount: '1150.00',
        denominationCounts,
        closeNotes: 'Todo correcto',
      });

      expect(result.report.denominationCounts).toEqual(denominationCounts);
      expect(result.report.closeNotes).toBe('Todo correcto');
      expect(shiftsRepository.update).toHaveBeenCalledWith(
        'shift-1',
        expect.objectContaining({
          denominationCounts,
          closeNotes: 'Todo correcto',
          closeSnapshot: expect.objectContaining({
            denominationCounts,
            closeNotes: 'Todo correcto',
          }),
        }),
      );
    });
  });
});
