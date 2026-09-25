import { Controller, Get, Post, Body, Query, Param, UseGuards, Req } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { CreateProductionRunDto } from './dto/create-production-run.dto';
import { CompleteProductionRunDto } from './dto/complete-production-run.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { ReceiveTransferDto } from './dto/receive-transfer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE, BRANCH_OPERATOR_ROLE } from '../auth/roles';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE)
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

  @Post('production/:id/start')
  async startProductionRun(@Param('id') id: string) {
    return this.inventoryService.startProductionRun(id);
  }

  @Post('production/:id/complete')
  async completeProductionRun(
    @Param('id') id: string,
    @Body() completeDto: CompleteProductionRunDto,
  ) {
    return this.inventoryService.completeProductionRun(id, completeDto);
  }

  @Post('production/:id/cancel')
  async cancelProductionRun(@Param('id') id: string) {
    return this.inventoryService.cancelProductionRun(id);
  }

  @Get('transfers')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE, BRANCH_OPERATOR_ROLE)
  async getTransfers(@Query('businessId') businessId: string, @Req() req: any) {
    return this.inventoryService.getTransfers(businessId, req.user);
  }

  @Get('transfers/:id')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE, BRANCH_OPERATOR_ROLE)
  async getTransfer(@Param('id') id: string, @Req() req: any) {
    return this.inventoryService.getTransfer(id, req.user);
  }

  @Post('transfers')
  async recordTransfer(@Body() createTransferDto: CreateTransferDto) {
    return this.inventoryService.recordTransfer(createTransferDto);
  }

  @Post('transfers/:id/receive')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE, BRANCH_OPERATOR_ROLE)
  async receiveTransfer(@Param('id') id: string, @Body() receipt: ReceiveTransferDto, @Req() req: any) {
    return this.inventoryService.receiveTransfer(id, receipt, req.user);
  }

  @Post('transfers/:id/ship')
  async shipTransfer(@Param('id') id: string, @Body() body: any) {
    return this.inventoryService.shipTransfer(id, body);
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
