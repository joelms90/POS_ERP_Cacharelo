import { Test, TestingModule } from '@nestjs/testing';
import { RequisitionsService } from './requisitions.service';
import { RequisitionsRepository } from './repositories/requisitions.repository';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('RequisitionsService', () => {
  let service: RequisitionsService;
  let repository: RequisitionsRepository;

  const mockRequisitionsRepository = {
    create: jest.fn(),
    createForBranch: jest.fn(),
    findByRequester: jest.fn(),
    findByBranch: jest.fn(),
    findPendingForBusiness: jest.fn(),
    findById: jest.fn(),
    findByIdWithItems: jest.fn(),
    updateStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequisitionsService,
        {
          provide: RequisitionsRepository,
          useValue: mockRequisitionsRepository,
        },
      ],
    }).compile();

    service = module.get<RequisitionsService>(RequisitionsService);
    repository = module.get<RequisitionsRepository>(RequisitionsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create and return a requisition', async () => {
      const dto = {
        businessId: 'bus-1',
        fromBranchId: 'branch-1',
        toWarehouseId: 'wh-1',
        createdBy: 'user-1',
        notes: 'Req notes',
        items: [{ productId: 'prod-1', quantityRequested: 15.5 }],
      };
      const created = { id: 'req-1', ...dto, status: 'pending' };
      mockRequisitionsRepository.create.mockResolvedValue(created);

      const result = await service.create(dto);
      expect(result).toEqual(created);
      expect(repository.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('branch operator scope', () => {
    const actor = { sub: 'user-1', businessId: 'bus-1', branchId: 'branch-1' };

    it('derives the requester and branch instead of accepting them from the POS', async () => {
      const dto = { notes: 'Faltan insumos', items: [{ productId: 'prod-1', quantityRequested: 2 }] } as any;
      mockRequisitionsRepository.createForBranch.mockResolvedValue({ id: 'req-1' });

      await service.createForOperator(dto, actor);

      expect(repository.create).toHaveBeenCalledWith({
        id: undefined,
        businessId: 'bus-1',
        fromBranchId: 'branch-1',
        toWarehouseId: null,
        createdBy: 'user-1',
        notes: 'Faltan insumos',
        items: dto.items,
      });
    });

    it('returns only the current operator requisitions and applies the optional status filter', async () => {
      mockRequisitionsRepository.findByRequester.mockResolvedValue([{ id: 'req-1', createdBy: 'user-1' }]);

      await expect(service.findMine(actor, 'pending')).resolves.toEqual([{ id: 'req-1', createdBy: 'user-1' }]);
      expect(repository.findByRequester).toHaveBeenCalledWith('bus-1', 'branch-1', 'user-1', 'pending');
    });

    it('allows owner or admin to create requisition with explicit fromBranchId and toWarehouseId', async () => {
      const ownerActor = { sub: 'owner-1', roles: ['owner'], businessId: 'bus-1', branchId: null };
      const dto = {
        businessId: 'bus-1',
        fromBranchId: 'branch-99',
        toWarehouseId: 'wh-88',
        createdBy: 'owner-1',
        items: [{ productId: 'prod-1', quantityRequested: 5 }],
      };
      mockRequisitionsRepository.create.mockResolvedValue({ id: 'req-99', ...dto });

      const res = await service.createForOperator(dto, ownerActor);
      expect(res).toEqual({ id: 'req-99', ...dto });
      expect(repository.create).toHaveBeenCalledWith({
        id: undefined,
        businessId: 'bus-1',
        fromBranchId: 'branch-99',
        toWarehouseId: 'wh-88',
        createdBy: 'owner-1',
        notes: undefined,
        items: dto.items,
      });
    });
  });

  describe('findByBranch', () => {
    it('should return branch requisitions', async () => {
      const list = [{ id: 'req-1', fromBranchId: 'branch-1', status: 'pending' }];
      mockRequisitionsRepository.findByBranch.mockResolvedValue(list);

      const result = await service.findByBranch('branch-1');
      expect(result).toEqual(list);
      expect(repository.findByBranch).toHaveBeenCalledWith('branch-1', undefined);
    });
  });

  describe('findPendingForBusiness', () => {
    it('should return pending requisitions', async () => {
      const list = [{ id: 'req-1', businessId: 'bus-1', status: 'pending' }];
      mockRequisitionsRepository.findPendingForBusiness.mockResolvedValue(list);

      const result = await service.findPendingForBusiness('bus-1');
      expect(result).toEqual(list);
      expect(repository.findPendingForBusiness).toHaveBeenCalledWith('bus-1');
    });
  });

  describe('findOne', () => {
    it('should return a requisition with its items', async () => {
      const requisition = {
        id: 'req-1',
        businessId: 'bus-1',
        items: [{ productId: 'prod-1', quantityRequested: '10' }],
      };
      mockRequisitionsRepository.findByIdWithItems.mockResolvedValue(requisition);

      const result = await service.findOne('req-1');
      expect(result).toEqual(requisition);
      expect(repository.findByIdWithItems).toHaveBeenCalledWith('req-1');
    });

    it('should throw NotFoundException if requisition does not exist', async () => {
      mockRequisitionsRepository.findByIdWithItems.mockResolvedValue(null);
      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update status and return the requisition', async () => {
      const existing = { id: 'req-1', status: 'pending', businessId: 'bus-1' };
      const updated = { ...existing, status: 'approved' };
      mockRequisitionsRepository.findById.mockResolvedValue(existing);
      mockRequisitionsRepository.updateStatus.mockResolvedValue(updated);

      const result = await service.updateStatus('req-1', {
        status: 'approved',
        notes: 'Approved notes',
      });

      expect(result).toEqual(updated);
      expect(repository.updateStatus).toHaveBeenCalledWith('req-1', 'approved', 'Approved notes', undefined);
    });

    it('should throw NotFoundException if requisition not found', async () => {
      mockRequisitionsRepository.findById.mockResolvedValue(null);
      await expect(
        service.updateStatus('999', { status: 'approved', notes: 'Notes' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if already approved', async () => {
      const existing = { id: 'req-1', status: 'approved', businessId: 'bus-1' };
      mockRequisitionsRepository.findById.mockResolvedValue(existing);

      await expect(
        service.updateStatus('req-1', { status: 'approved', notes: 'Notes' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if already rejected', async () => {
      const existing = { id: 'req-1', status: 'rejected', businessId: 'bus-1' };
      mockRequisitionsRepository.findById.mockResolvedValue(existing);

      await expect(
        service.updateStatus('req-1', { status: 'approved', notes: 'Notes' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
