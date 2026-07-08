import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales-dashboard')
  async getSalesDashboard(
    @Query('businessId') businessId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('El parámetro businessId es obligatorio.');
    }
    return this.reportsService.getSalesDashboard(businessId, startDate, endDate);
  }

  @Get('sales/products')
  async getProductSalesReport(
    @Query('businessId') businessId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') branchId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('El parámetro businessId es obligatorio.');
    }
    return this.reportsService.getProductSalesReport({
      businessId,
      startDate,
      endDate,
      branchId,
      categoryId,
    });
  }

  @Get('inventory/existence')
  async getInventoryExistence(
    @Query('businessId') businessId: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('branchId') branchId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('productId') productId?: string,
    @Query('status') status?: string,
    @Query('stockFilter') stockFilter?: string,
    @Query('consolidated') consolidated?: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('El parámetro businessId es obligatorio.');
    }
    return this.reportsService.getInventoryExistence({
      businessId,
      warehouseId,
      branchId,
      categoryId,
      productId,
      status,
      stockFilter,
      consolidated,
    });
  }

  @Get('inventory/kardex')
  async getInventoryKardex(
    @Query('businessId') businessId: string,
    @Query('productId') productId: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('El parámetro businessId es obligatorio.');
    }
    if (!productId) {
      throw new BadRequestException('El parámetro productId es obligatorio.');
    }
    return this.reportsService.getInventoryKardex({
      businessId,
      productId,
      warehouseId,
      branchId,
      startDate,
      endDate,
    });
  }
}
