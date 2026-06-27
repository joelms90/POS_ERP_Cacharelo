import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { ProductsRepository } from './repositories/products.repository';
import { CategoriesRepository } from './repositories/categories.repository';
import { ProvidersRepository } from '../providers/repositories/providers.repository';
import { NotFoundException } from '@nestjs/common';

describe('ProductsService', () => {
  let service: ProductsService;
  let productsRepository: ProductsRepository;
  let categoriesRepository: CategoriesRepository;
  let providersRepository: ProvidersRepository;

  const mockProductsRepository = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockCategoriesRepository = {
    findById: jest.fn(),
  };

  const mockProvidersRepository = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: ProductsRepository,
          useValue: mockProductsRepository,
        },
        {
          provide: CategoriesRepository,
          useValue: mockCategoriesRepository,
        },
        {
          provide: ProvidersRepository,
          useValue: mockProvidersRepository,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    productsRepository = module.get<ProductsRepository>(ProductsRepository);
    categoriesRepository = module.get<CategoriesRepository>(CategoriesRepository);
    providersRepository = module.get<ProvidersRepository>(ProvidersRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create and return product when category is valid', async () => {
      const createProductDto = {
        name: 'Refresco',
        categoryId: 'cat-1',
        businessId: 'bus-1',
        price: '25.00',
      };

      mockCategoriesRepository.findById.mockResolvedValue({ id: 'cat-1', name: 'Bebidas' });
      mockProductsRepository.create.mockResolvedValue({ id: 'prod-1', ...createProductDto });

      const result = await service.create(createProductDto);
      expect(result).toBeDefined();
      expect(result.id).toBe('prod-1');
      expect(productsRepository.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if category is invalid', async () => {
      const createProductDto = {
        name: 'Refresco',
        categoryId: 'invalid-cat',
        businessId: 'bus-1',
      };

      mockCategoriesRepository.findById.mockResolvedValue(null);

      await expect(service.create(createProductDto)).rejects.toThrow(NotFoundException);
    });
  });
});
