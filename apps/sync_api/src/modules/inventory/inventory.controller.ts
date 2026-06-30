import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { CreateProductionRunDto } from './dto/create-production-run.dto';

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
}
