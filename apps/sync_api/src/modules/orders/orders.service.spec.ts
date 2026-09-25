import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './repositories/orders.repository';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SyncGateway } from '../sync/sync.gateway';
import { DRIZZLE_CONNECTION } from '../../database/database.module';

describe('OrdersService', () => {
  let service: OrdersService;
  let repository: OrdersRepository;

  const mockOrdersRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findActiveByBranch: jest.fn(),
    addItems: jest.fn(),
    findExistingOrderItemClientUuids: jest.fn(),
    updateOrderAndTableState: jest.fn(),
    createPayment: jest.fn(),
    cancelOrderWithAudit: jest.fn(),
    getDailyPaymentSummary: jest.fn(),
  };

  const mockSyncGateway = {
    broadcastChange: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: OrdersRepository,
          useValue: mockOrdersRepository,
        },
        {
          provide: SyncGateway,
          useValue: mockSyncGateway,
        },
        {
          provide: DRIZZLE_CONNECTION,
          useValue: { insert: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    repository = module.get<OrdersRepository>(OrdersRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create order and items successfully', async () => {
      const createDto = {
        clientUuid: 'client-order-1',
        branchId: 'branch-1',
        tableId: 'table-1',
        waiterId: 'waiter-1',
        subtotal: '100.00',
        total: '116.00',
        items: [
          { clientUuid: 'client-item-1', productId: 'prod-1', quantity: 2, price: '50.00' },
        ],
      };

      mockOrdersRepository.create.mockResolvedValue({ id: 'order-1', ...createDto, state: 'open' });

      const result = await service.create(createDto);
      expect(result).toBeDefined();
      expect(result.id).toBe('order-1');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ clientUuid: 'client-order-1' }),
        [
          expect.objectContaining({
            clientUuid: 'client-item-1',
            productId: 'prod-1',
          }),
        ],
      );
    });
  });

  describe('addItems', () => {
    it('should add new items and recalculate subtotal and total including 16% tax', async () => {
      const order = {
        id: 'order-1',
        branchId: 'branch-1',
        tableId: 'table-1',
        waiterId: 'waiter-1',
        subtotal: '100.00',
        discount: '0.00',
        tax: '16.00',
        total: '116.00',
        state: 'open',
      };

      mockOrdersRepository.findById.mockResolvedValue(order);
      mockOrdersRepository.findExistingOrderItemClientUuids.mockResolvedValue(new Set());
      mockOrdersRepository.addItems.mockResolvedValue({
        id: 'order-1',
        subtotal: '200.00',
        tax: '32.00',
        total: '232.00',
      });

      const addItemsDto = {
        items: [
          { productId: 'prod-2', quantity: 2, price: '50.00' },
        ],
      };

      const result = await service.addItems('order-1', addItemsDto);
      expect(result.subtotal).toBe('200.00');
      expect(result.total).toBe('232.00');
    });

    it('should return the current order without adding duplicate clientUuid items', async () => {
      const order = {
        id: 'order-1',
        branchId: 'branch-1',
        tableId: 'table-1',
        waiterId: 'waiter-1',
        subtotal: '100.00',
        discount: '0.00',
        tax: '16.00',
        total: '116.00',
        state: 'open',
      };

      mockOrdersRepository.findById.mockResolvedValue(order);
      mockOrdersRepository.findExistingOrderItemClientUuids.mockResolvedValue(
        new Set(['client-item-1']),
      );

      const result = await service.addItems('order-1', {
        items: [
          {
            clientUuid: 'client-item-1',
            productId: 'prod-2',
            quantity: 2,
            price: '50.00',
          },
        ],
      });

      expect(result).toBe(order);
      expect(repository.addItems).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if order is not in open state', async () => {
      mockOrdersRepository.findById.mockResolvedValue({ id: 'order-1', state: 'billing' });
      await expect(
        service.addItems('order-1', {
          items: [{ productId: 'prod-2', quantity: 2, price: '50.00' }],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('requestBilling', () => {
    it('should request billing state update successfully', async () => {
      mockOrdersRepository.findById.mockResolvedValue({ id: 'order-1', state: 'open' });
      mockOrdersRepository.updateOrderAndTableState.mockResolvedValue({ id: 'order-1', state: 'billing' });

      const result = await service.requestBilling('order-1');
      expect(result.state).toBe('billing');
    });
  });

  describe('processPayment', () => {
    it('should process normal payment (no paidOrderItemIds) successfully', async () => {
      mockOrdersRepository.findById.mockResolvedValue({
        id: 'order-1',
        total: '116.00',
        state: 'billing',
        branchId: 'branch-1',
        tableId: 'table-1',
      });
      mockOrdersRepository.createPayment.mockResolvedValue({
        payment: { id: 'pay-1', amount: '116.00', paymentMethod: 'cash' },
        isFullyPaid: true,
        orderState: 'closed',
        tableState: 'cleaning',
        totalPaid: '116.00',
      });

      const result = await service.processPayment('order-1', {
        amount: '116.00',
        paymentMethod: 'cash',
      });

      expect(result.isFullyPaid).toBe(true);
      expect(result.orderState).toBe('closed');
      expect(repository.createPayment).toHaveBeenCalledWith('order-1', {
        orderId: 'order-1',
        amount: '116.00',
        paymentMethod: 'cash',
        referenceCode: null,
        paidOrderItemIds: undefined,
      });
    });

    it('should process partial payment without closing order', async () => {
      mockOrdersRepository.findById.mockResolvedValue({
        id: 'order-1',
        total: '200.00',
        state: 'billing',
        branchId: 'branch-1',
        tableId: 'table-1',
      });
      mockOrdersRepository.createPayment.mockResolvedValue({
        payment: { id: 'pay-1', amount: '100.00', paymentMethod: 'cash' },
        isFullyPaid: false,
        orderState: 'billing',
        tableState: 'billing',
        totalPaid: '100.00',
      });

      const result = await service.processPayment('order-1', {
        amount: '100.00',
        paymentMethod: 'cash',
      });

      expect(result.isFullyPaid).toBe(false);
      expect(result.orderState).toBe('billing');
    });

    it('should process by-items payment with paidOrderItemIds', async () => {
      mockOrdersRepository.findById.mockResolvedValue({
        id: 'order-1',
        total: '200.00',
        state: 'billing',
        branchId: 'branch-1',
        tableId: 'table-1',
      });
      mockOrdersRepository.createPayment.mockResolvedValue({
        payment: { id: 'pay-1', amount: '100.00', paymentMethod: 'cash' },
        isFullyPaid: false,
        orderState: 'billing',
        tableState: 'billing',
        totalPaid: '100.00',
        splitOrder: { id: 'split-order-1', state: 'closed' },
      });

      const result = await service.processPayment('order-1', {
        amount: '100.00',
        paymentMethod: 'cash',
        paidOrderItemIds: ['item-uuid-1'],
      });

      expect(result.isFullyPaid).toBe(false);
      expect(result.splitOrder).toBeDefined();
      expect(repository.createPayment).toHaveBeenCalledWith('order-1', {
        orderId: 'order-1',
        amount: '100.00',
        paymentMethod: 'cash',
        referenceCode: null,
        paidOrderItemIds: ['item-uuid-1'],
      });
    });

    it('should handle by-items payment where items are not found (graceful fallback)', async () => {
      mockOrdersRepository.findById.mockResolvedValue({
        id: 'order-1',
        total: '200.00',
        state: 'billing',
        branchId: 'branch-1',
        tableId: 'table-1',
      });
      // When items are not found, the repository falls back to normal flow
      mockOrdersRepository.createPayment.mockResolvedValue({
        payment: { id: 'pay-1', amount: '100.00', paymentMethod: 'cash' },
        isFullyPaid: false,
        orderState: 'billing',
        tableState: 'billing',
        totalPaid: '100.00',
      });

      const result = await service.processPayment('order-1', {
        amount: '100.00',
        paymentMethod: 'cash',
        paidOrderItemIds: ['nonexistent-uuid'],
      });

      // Should not throw — gracefully falls back to normal flow
      expect(result.isFullyPaid).toBe(false);
      expect(result.orderState).toBe('billing');
    });

    it('should close order on last by-items payment', async () => {
      mockOrdersRepository.findById.mockResolvedValue({
        id: 'order-1',
        total: '200.00',
        state: 'billing',
        branchId: 'branch-1',
        tableId: 'table-1',
      });
      mockOrdersRepository.createPayment.mockResolvedValue({
        payment: { id: 'pay-2', amount: '100.00', paymentMethod: 'cash' },
        isFullyPaid: true,
        orderState: 'closed',
        tableState: 'cleaning',
        totalPaid: '100.00',
      });

      const result = await service.processPayment('order-1', {
        amount: '100.00',
        paymentMethod: 'cash',
        paidOrderItemIds: ['item-uuid-2'],
      });

      expect(result.isFullyPaid).toBe(true);
      expect(result.orderState).toBe('closed');
      expect(result.tableState).toBe('cleaning');
    });

    it('should throw ConflictException for closed orders', async () => {
      mockOrdersRepository.findById.mockResolvedValue({
        id: 'order-1',
        total: '116.00',
        state: 'closed',
        branchId: 'branch-1',
        tableId: 'table-1',
      });

      await expect(
        service.processPayment('order-1', {
          amount: '116.00',
          paymentMethod: 'cash',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException for cancelled orders', async () => {
      mockOrdersRepository.findById.mockResolvedValue({
        id: 'order-1',
        total: '116.00',
        state: 'cancelled',
        branchId: 'branch-1',
        tableId: 'table-1',
      });

      await expect(
        service.processPayment('order-1', {
          amount: '116.00',
          paymentMethod: 'cash',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('audited cancellation and daily report', () => {
    const operator = { sub: 'operator-1', branchId: 'branch-1', roles: ['branch_operator'] };

    it('records the actor and reason and refuses orders with a payment', async () => {
      mockOrdersRepository.findById.mockResolvedValue({
        id: 'order-1', branchId: 'branch-1', tableId: 'table-1', state: 'open', payments: [],
      });
      mockOrdersRepository.cancelOrderWithAudit.mockResolvedValue({ id: 'order-1', state: 'cancelled' });

      await service.cancelOrder('order-1', 'Cliente se retiró', operator);
      expect(repository.cancelOrderWithAudit).toHaveBeenCalledWith('order-1', 'Cliente se retiró', 'operator-1');

      mockOrdersRepository.findById.mockResolvedValue({
        id: 'order-1', branchId: 'branch-1', tableId: 'table-1', state: 'billing', payments: [{ id: 'payment-1' }],
      });
      await expect(service.cancelOrder('order-1', 'No procede', operator)).rejects.toThrow(ConflictException);
    });

    it('obtains daily payment totals only for the actor branch', async () => {
      mockOrdersRepository.getDailyPaymentSummary.mockResolvedValue({ branchId: 'branch-1', totals: { cash: 20, card: 10 } });
      await service.getDailyPaymentSummary(operator, '2026-09-24');
      expect(repository.getDailyPaymentSummary).toHaveBeenCalledWith('branch-1', '2026-09-24');
    });
  });
});
