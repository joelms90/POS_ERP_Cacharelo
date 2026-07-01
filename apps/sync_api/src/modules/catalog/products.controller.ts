import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(
    @Query('businessId') businessId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.productsService.findAll(businessId, categoryId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Post('validate-import')
  async validateImport(@Body() body: { businessId: string; rows: any[] }) {
    return this.productsService.validateImport(body.businessId, body.rows);
  }

  @Post('bulk')
  async bulkImport(@Body() body: { businessId: string; rows: any[] }) {
    return this.productsService.bulkImport(body.businessId, body.rows);
  }

  @Post('log-error')
  async logError(@Body() body: { message: string; stack?: string }) {
    console.error('[BROWSER CLIENT ERROR]:', body.message, body.stack);
    return { success: true };
  }
}
