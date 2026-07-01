import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { CreateProductionRunDto } from './dto/create-production-run.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stock')
  async getStockLevels(
    @Query('businessId') businessId: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.inventoryService.getStockLevels(businessId, warehouseId, branchId);
  }

  @Get('receipts')
  async getReceipts(@Query('businessId') businessId: string) {
    return this.inventoryService.getReceipts(businessId);
  }

  @Post('receipts')
  async recordReceipt(@Body() createReceiptDto: CreateReceiptDto) {
    return this.inventoryService.recordReceipt(createReceiptDto);
  }

  @Get('production')
  async getProductionRuns(@Query('businessId') businessId: string) {
    return this.inventoryService.getProductionRuns(businessId);
  }

  @Post('production')
  async assembleProduct(@Body() createProductionRunDto: CreateProductionRunDto) {
    return this.inventoryService.assembleProduct(createProductionRunDto);
  }

  @Get('transfers')
  async getTransfers(@Query('businessId') businessId: string) {
    return this.inventoryService.getTransfers(businessId);
  }

  @Post('transfers')
  async recordTransfer(@Body() createTransferDto: CreateTransferDto) {
    return this.inventoryService.recordTransfer(createTransferDto);
  }

  @Get('reports/transfers-summary')
  async getTransfersSummaryReport(
    @Query('businessId') businessId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.inventoryService.getTransfersSummaryReport(businessId, startDate, endDate);
  }

  @Get('reports/transfers-detailed')
  async getTransfersDetailedReport(
    @Query('businessId') businessId: string,
    @Query('branchId') branchId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.inventoryService.getTransfersDetailedReport(businessId, branchId, startDate, endDate);
  }

  @Post('stock/adjust')
  async adjustStock(@Body() body: { productId: string; warehouseId?: string; branchId?: string; quantity: number }) {
    return this.inventoryService.adjustStock(body);
  }
}
