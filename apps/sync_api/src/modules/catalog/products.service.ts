import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductsRepository } from './repositories/products.repository';
import { CategoriesRepository } from './repositories/categories.repository';
import { ProvidersRepository } from '../providers/repositories/providers.repository';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly providersRepository: ProvidersRepository,
  ) {}

  async findAll(businessId?: string, categoryId?: string) {
    return this.productsRepository.findAll(businessId, categoryId);
  }

  async findOne(id: string) {
    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async create(createProductDto: CreateProductDto) {
    const category = await this.categoriesRepository.findById(createProductDto.categoryId);
    if (!category) {
      throw new NotFoundException(`Category with ID ${createProductDto.categoryId} not found`);
    }

    if (createProductDto.providerId) {
      const provider = await this.providersRepository.findById(createProductDto.providerId);
      if (!provider) {
        throw new NotFoundException(`Provider with ID ${createProductDto.providerId} not found`);
      }
    }

    return this.productsRepository.create({
      ...createProductDto,
      sku: createProductDto.sku || null,
      barcode: createProductDto.barcode || null,
      internalCode: createProductDto.internalCode || null,
      providerId: createProductDto.providerId || null,
      cost: createProductDto.cost || '0.00',
      price: createProductDto.price || '0.00',
      priceWholesale: createProductDto.priceWholesale || '0.00',
      minStock: createProductDto.minStock || '0.000',
      maxStock: createProductDto.maxStock || '0.000',
      saleType: createProductDto.saleType || 'pieza',
      isSellable: createProductDto.isSellable ?? true,
      isIngredient: createProductDto.isIngredient ?? false,
    });
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    if (updateProductDto.categoryId) {
      const category = await this.categoriesRepository.findById(updateProductDto.categoryId);
      if (!category) {
        throw new NotFoundException(`Category with ID ${updateProductDto.categoryId} not found`);
      }
    }

    if (updateProductDto.providerId) {
      const provider = await this.providersRepository.findById(updateProductDto.providerId);
      if (!provider) {
        throw new NotFoundException(`Provider with ID ${updateProductDto.providerId} not found`);
      }
    }

    return this.productsRepository.update(id, updateProductDto);
  }

  async remove(id: string) {
    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    await this.productsRepository.softDelete(id);
    return { success: true, message: 'Product deleted successfully' };
  }
}
