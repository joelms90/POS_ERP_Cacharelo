import { Injectable, NotFoundException } from '@nestjs/common';
import { WarehousesRepository } from './repositories/warehouses.repository';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(private readonly warehousesRepository: WarehousesRepository) {}

  async findAll(businessId?: string) {
    return this.warehousesRepository.findAll(businessId);
  }

  async findOne(id: string) {
    const warehouse = await this.warehousesRepository.findById(id);
    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }
    return warehouse;
  }

  async create(createWarehouseDto: CreateWarehouseDto) {
    return this.warehousesRepository.create({
      ...createWarehouseDto,
      code: createWarehouseDto.code || null,
      address: createWarehouseDto.address || null,
      isActive: true,
      version: 1,
    });
  }

  async update(id: string, updateWarehouseDto: UpdateWarehouseDto) {
    const warehouse = await this.warehousesRepository.findById(id);
    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }
    return this.warehousesRepository.update(id, updateWarehouseDto);
  }

  async remove(id: string) {
    const warehouse = await this.warehousesRepository.findById(id);
    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }
    await this.warehousesRepository.softDelete(id);
    return { success: true, message: 'Warehouse deleted successfully' };
  }
}
