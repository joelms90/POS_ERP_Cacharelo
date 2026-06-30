import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { SupplierProductsService } from './supplier-products.service';
import { CreateSupplierProductDto } from './dto/create-supplier-product.dto';
import { UpdateSupplierProductDto } from './dto/update-supplier-product.dto';

@Controller('supplier-products')
export class SupplierProductsController {
  constructor(private readonly supplierProductsService: SupplierProductsService) {}

  @Get()
  async findAll(
    @Query('businessId') businessId?: string,
    @Query('productId') productId?: string,
    @Query('providerId') providerId?: string,
  ) {
    return this.supplierProductsService.findAll(businessId, productId, providerId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.supplierProductsService.findOne(id);
  }

  @Post()
  async create(@Body() createDto: CreateSupplierProductDto) {
    return this.supplierProductsService.create(createDto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateDto: UpdateSupplierProductDto) {
    return this.supplierProductsService.update(id, updateDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.supplierProductsService.remove(id);
  }
}
