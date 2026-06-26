import { Test, TestingModule } from '@nestjs/testing';
import { KitchenService } from './kitchen.service';
import { KitchenRepository } from './repositories/kitchen.repository';
import { NotFoundException } from '@nestjs/common';

describe('KitchenService', () => {
  let service: KitchenService;
  let repository: KitchenRepository;

  const mockKitchenRepository = {
    findTicketById: jest.fn(),
    findActiveTicketsByBranch: jest.fn(),
    createTicketsForOrder: jest.fn(),
    updateTicketStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KitchenService,
        {
          provide: KitchenRepository,
          useValue: mockKitchenRepository,
        },
      ],
    }).compile();

    service = module.get<KitchenService>(KitchenService);
    repository = module.get<KitchenRepository>(KitchenRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findActiveTickets', () => {
    it('should return active tickets list', async () => {
      const activeTickets = [
        { id: 't-1', orderId: 'order-1', status: 'pending', station: 'cocina', items: [] },
      ];
      mockKitchenRepository.findActiveTicketsByBranch.mockResolvedValue(activeTickets);

      const result = await service.findActiveTickets('branch-1');
      expect(result).toEqual(activeTickets);
      expect(repository.findActiveTicketsByBranch).toHaveBeenCalledWith('branch-1');
    });
  });

  describe('sendOrderToKitchen', () => {
    it('should create tickets successfully', async () => {
      mockKitchenRepository.createTicketsForOrder.mockResolvedValue({ tickets: [{ id: 't-1' }], itemsUpdated: 2 });

      const result = await service.sendOrderToKitchen('order-1');
      expect(result).toBeDefined();
      expect(result.itemsUpdated).toBe(2);
    });
  });

  describe('updateTicketStatus', () => {
    it('should update ticket status successfully', async () => {
      mockKitchenRepository.findTicketById.mockResolvedValue({ id: 't-1', status: 'pending' });
      mockKitchenRepository.updateTicketStatus.mockResolvedValue({ id: 't-1', status: 'preparing' });

      const result = await service.updateTicketStatus('t-1', 'preparing');
      expect(result.status).toBe('preparing');
    });

    it('should throw NotFoundException if ticket does not exist', async () => {
      mockKitchenRepository.findTicketById.mockResolvedValue(null);
      await expect(service.updateTicketStatus('999', 'preparing')).rejects.toThrow(NotFoundException);
    });
  });
});
