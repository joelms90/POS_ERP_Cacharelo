import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './repositories/orders.repository';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;
  let repository: OrdersRepository;

  const mockOrdersRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findActiveByBranch: jest.fn(),
    addItems: jest.fn(),
    updateOrderAndTableState: jest.fn(),
    createPayment: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: OrdersRepository,
          useValue: mockOrdersRepository,
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
        branchId: 'branch-1',
        tableId: 'table-1',
        waiterId: 'waiter-1',
        subtotal: '100.00',
        total: '116.00',
        items: [
          { productId: 'prod-1', quantity: 2, price: '50.00' },
        ],
      };

      mockOrdersRepository.create.mockResolvedValue({ id: 'order-1', ...createDto, state: 'open' });

      const result = await service.create(createDto);
      expect(result).toBeDefined();
      expect(result.id).toBe('order-1');
      expect(repository.create).toHaveBeenCalled();
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
    it('should process payment successfully', async () => {
      mockOrdersRepository.findById.mockResolvedValue({ id: 'order-1', total: '116.00', state: 'billing' });
      mockOrdersRepository.createPayment.mockResolvedValue({
        payment: { id: 'pay-1', amount: '116.00', paymentMethod: 'cash' },
        isFullyPaid: true,
      });

      const result = await service.processPayment('order-1', {
        amount: '116.00',
        paymentMethod: 'cash',
      });

      expect(result.isFullyPaid).toBe(true);
      expect(repository.createPayment).toHaveBeenCalled();
    });
  });
});
