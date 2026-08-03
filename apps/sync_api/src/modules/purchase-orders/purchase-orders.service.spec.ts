import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersRepository } from './repositories/purchase-orders.repository';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  let repository: PurchaseOrdersRepository;

  const mockPurchaseOrdersRepository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByIdWithItems: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockInventoryService = {
    processPurchaseOrderReception: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        {
          provide: PurchaseOrdersRepository,
          useValue: mockPurchaseOrdersRepository,
        },
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
    repository = module.get<PurchaseOrdersRepository>(PurchaseOrdersRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return a list of purchase orders', async () => {
      const orders = [
        { id: '1', poNumber: 'PO-001', businessId: 'bus-1', status: 'draft' },
      ];
      mockPurchaseOrdersRepository.findAll.mockResolvedValue(orders);

      const result = await service.findAll('bus-1');
      expect(result).toEqual(orders);
      expect(repository.findAll).toHaveBeenCalledWith('bus-1');
    });
  });

  describe('findOne', () => {
    it('should return a single purchase order', async () => {
      const order = { id: '1', poNumber: 'PO-001', businessId: 'bus-1', status: 'draft' };
      mockPurchaseOrdersRepository.findById.mockResolvedValue(order);

      const result = await service.findOne('1');
      expect(result).toEqual(order);
      expect(repository.findById).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException if not found', async () => {
      mockPurchaseOrdersRepository.findById.mockResolvedValue(null);
      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and return a purchase order', async () => {
      const dto = {
        businessId: 'bus-1',
        providerId: 'prov-1',
        warehouseId: 'wh-1',
        orderNumber: 'PO-001',
        createdBy: 'user-1',
        items: [{ productId: 'prod-1', quantity: 10, estimatedUnitCost: 5.5 }],
      };
      const createdOrder = { id: '1', ...dto, status: 'draft' };
      mockPurchaseOrdersRepository.create.mockResolvedValue(createdOrder);

      const result = await service.create(dto);
      expect(result).toEqual(createdOrder);
      expect(repository.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should update and return a purchase order', async () => {
      const existing = { id: '1', poNumber: 'PO-001', businessId: 'bus-1', status: 'draft' };
      const dto = { notes: 'Updated notes' };
      const updated = { ...existing, ...dto };

      mockPurchaseOrdersRepository.findById.mockResolvedValue(existing);
      mockPurchaseOrdersRepository.update.mockResolvedValue(updated);

      const result = await service.update('1', dto);
      expect(result).toEqual(updated);
      expect(repository.update).toHaveBeenCalledWith('1', dto);
    });

    it('should throw NotFoundException if trying to update non-existing PO', async () => {
      mockPurchaseOrdersRepository.findById.mockResolvedValue(null);
      await expect(service.update('999', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a purchase order', async () => {
      const existing = { id: '1', poNumber: 'PO-001', businessId: 'bus-1', status: 'draft' };
      mockPurchaseOrdersRepository.findById.mockResolvedValue(existing);
      mockPurchaseOrdersRepository.softDelete.mockResolvedValue(existing);

      const result = await service.remove('1');
      expect(result).toEqual({ success: true, message: 'Purchase order deleted successfully' });
      expect(repository.softDelete).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundException if trying to delete non-existing PO', async () => {
      mockPurchaseOrdersRepository.findById.mockResolvedValue(null);
      await expect(service.remove('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsSent', () => {
    it('should update status to sent', async () => {
      const existing = { id: '1', poNumber: 'PO-001', businessId: 'bus-1', status: 'draft' };
      const updated = { ...existing, status: 'sent' };

      mockPurchaseOrdersRepository.findById.mockResolvedValue(existing);
      mockPurchaseOrdersRepository.updateStatus.mockResolvedValue(updated);

      const result = await service.markAsSent('1');
      expect(result).toEqual(updated);
      expect(repository.updateStatus).toHaveBeenCalledWith('1', 'sent');
    });
  });

  describe('receiveOrder', () => {
    it('should call processPurchaseOrderReception if status is sent', async () => {
      const existing = { id: '1', poNumber: 'PO-001', businessId: 'bus-1', status: 'sent' };
      const receiptData = {
        items: [{ productId: 'prod-1', quantityReceived: 10, unitCostActual: 6.0 }],
        notes: 'Delivered',
      };

      mockPurchaseOrdersRepository.findById.mockResolvedValue(existing);
      mockInventoryService.processPurchaseOrderReception.mockResolvedValue({ success: true, status: 'received' });

      const result = await service.receiveOrder('1', receiptData);
      expect(result).toEqual({ success: true, status: 'received' });
      expect(mockInventoryService.processPurchaseOrderReception).toHaveBeenCalledWith('1', receiptData.items, receiptData.notes);
    });

    it('should throw BadRequestException if status is draft', async () => {
      const existing = { id: '1', poNumber: 'PO-001', businessId: 'bus-1', status: 'draft' };
      mockPurchaseOrdersRepository.findById.mockResolvedValue(existing);

      await expect(service.receiveOrder('1', { items: [] })).rejects.toThrow(BadRequestException);
    });
  });
});
