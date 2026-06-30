import { Injectable, NotFoundException } from '@nestjs/common';
import { SupplierProductsRepository } from './repositories/supplier-products.repository';
import { CreateSupplierProductDto } from './dto/create-supplier-product.dto';
import { UpdateSupplierProductDto } from './dto/update-supplier-product.dto';

@Injectable()
export class SupplierProductsService {
  constructor(
    private readonly supplierProductsRepository: SupplierProductsRepository,
  ) {}

  async findAll(businessId?: string, productId?: string, providerId?: string) {
    return this.supplierProductsRepository.findAll(businessId, productId, providerId);
  }

  async findOne(id: string) {
    const sp = await this.supplierProductsRepository.findById(id);
    if (!sp) {
      throw new NotFoundException(`Supplier product mapping with ID ${id} not found`);
    }
    return sp;
  }

  async create(createDto: CreateSupplierProductDto) {
    return this.supplierProductsRepository.create({
      ...createDto,
      cost: createDto.cost || '0.00',
      conversionFactor: createDto.conversionFactor || '1.0000',
    });
  }

  async update(id: string, updateDto: UpdateSupplierProductDto) {
    await this.findOne(id);
    return this.supplierProductsRepository.update(id, updateDto);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.supplierProductsRepository.softDelete(id);
  }
}
