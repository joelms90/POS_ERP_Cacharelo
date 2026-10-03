import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE } from '../../auth/roles';
import { assertBusinessAccess } from '../../auth/business-access';
import { IsUUID, IsArray, IsString, IsNumber, ValidateNested, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

class RefreshDto {
  @IsUUID()
  businessId: string;
}

class BulkGeneratePoDto {
  @IsArray()
  @IsString({ each: true })
  alertIds: string[];
}

class PoProductItemDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;
}

class BulkGeneratePoByProductsDto {
  @IsUUID()
  businessId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PoProductItemDto)
  items: PoProductItemDto[];
}

@Controller('inventory/alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('summary')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE)
  async summary(
    @Req() req: any,
    @Query('businessId') businessId: string,
    @Query('branchId') branchId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('locationId') locationId?: string,
  ) {
    assertBusinessAccess(req.user, businessId);
    return this.alertsService.getSummary(businessId, { branchId, warehouseId, locationId });
  }

  @Get()
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE)
  async list(
    @Req() req: any,
    @Query('businessId') businessId: string,
    @Query('branchId') branchId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('locationId') locationId?: string,
    @Query('status') status?: string,
  ) {
    assertBusinessAccess(req.user, businessId);
    return this.alertsService.list(businessId, { branchId, warehouseId, locationId, status });
  }

  @Post('refresh')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE)
  async refresh(@Body() dto: RefreshDto, @Req() req: any) {
    assertBusinessAccess(req.user, dto.businessId);
    return this.alertsService.runAlertEngine(dto.businessId);
  }

  @Post('auto-purchase-orders')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE)
  async autoPurchaseOrders(@Body() dto: RefreshDto, @Req() req: any) {
    assertBusinessAccess(req.user, dto.businessId);
    return this.alertsService.runAutoPoEngine(dto.businessId, req.user?.sub);
  }

  @Post(':id/acknowledge')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE)
  async acknowledge(@Param('id') id: string, @Req() req: any) {
    return this.alertsService.acknowledge(id, req.user?.sub);
  }

  @Post(':id/generate-requisition')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE)
  async generateRequisition(@Param('id') id: string, @Req() req: any) {
    return this.alertsService.generateRequisition(id, req.user?.sub);
  }

  @Post(':id/generate-purchase-order')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE)
  async generatePurchaseOrder(@Param('id') id: string, @Req() req: any) {
    return this.alertsService.generatePurchaseOrder(id, req.user?.sub);
  }

  @Post('generate-purchase-orders')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE)
  async generatePurchaseOrders(@Body() dto: BulkGeneratePoDto, @Req() req: any) {
    return this.alertsService.generatePurchaseOrders(dto.alertIds, req.user?.sub);
  }

  @Post('generate-purchase-orders-by-products')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE)
  async generatePurchaseOrdersByProducts(@Body() dto: BulkGeneratePoByProductsDto, @Req() req: any) {
    assertBusinessAccess(req.user, dto.businessId);
    return this.alertsService.generatePurchaseOrdersByProducts(
      dto.businessId,
      req.user?.sub,
      dto.items,
    );
  }
}
