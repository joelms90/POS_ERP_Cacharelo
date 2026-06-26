import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { CategoriesRepository } from './repositories/categories.repository';
import { NotFoundException } from '@nestjs/common';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repository: CategoriesRepository;

  const mockCategoriesRepository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: CategoriesRepository,
          useValue: mockCategoriesRepository,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    repository = module.get<CategoriesRepository>(CategoriesRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return categories list', async () => {
      const dbCategories = [{ id: 'cat-1', name: 'Bebidas', businessId: 'bus-1' }];
      mockCategoriesRepository.findAll.mockResolvedValue(dbCategories);

      const result = await service.findAll('bus-1');
      expect(result).toEqual(dbCategories);
      expect(repository.findAll).toHaveBeenCalledWith('bus-1');
    });
  });

  describe('findOne', () => {
    it('should return category by ID', async () => {
      const dbCategory = { id: 'cat-1', name: 'Bebidas', businessId: 'bus-1' };
      mockCategoriesRepository.findById.mockResolvedValue(dbCategory);

      const result = await service.findOne('cat-1');
      expect(result).toEqual(dbCategory);
    });

    it('should throw NotFoundException if category not found', async () => {
      mockCategoriesRepository.findById.mockResolvedValue(null);
      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });
});
