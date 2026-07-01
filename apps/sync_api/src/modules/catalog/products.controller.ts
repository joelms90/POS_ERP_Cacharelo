import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Post('bulk/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBulkFile(
    @UploadedFile() file: any,
    @Body('businessId') businessId: string,
  ) {
    return this.productsService.startBulkImport(businessId, file);
  }

  @Get('bulk/history')
  async getBulkHistory(@Query('businessId') businessId: string) {
    return this.productsService.getBulkHistory(businessId);
  }

  @Get('bulk/history/:id')
  async getBulkImportDetails(@Param('id') id: string) {
    return this.productsService.getBulkImportDetails(id);
  }

  @Get('bulk/upload-url')
  async getBulkUploadUrl(
    @Query('businessId') businessId: string,
    @Query('filename') filename: string,
  ) {
    return this.productsService.getBulkUploadUrl(businessId, filename);
  }

  @Post('bulk/process')
  async processBulkImportGcs(
    @Body('businessId') businessId: string,
    @Body('importId') importId: string,
    @Body('gcsFileName') gcsFileName: string,
  ) {
    return this.productsService.processBulkImportGcs(businessId, importId, gcsFileName);
  }
}
