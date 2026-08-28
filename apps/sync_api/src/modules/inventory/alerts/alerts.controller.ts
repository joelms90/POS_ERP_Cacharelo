import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE } from '../../auth/roles';
import { assertBusinessAccess } from '../../auth/business-access';
import { IsUUID } from 'class-validator';

class RefreshDto {
  @IsUUID()
  businessId: string;
}

@Controller('inventory/alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('summary')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async summary(
    @Query('businessId') businessId: string,
    @Query('branchId') branchId: string,
    @Req() req: any,
  ) {
    assertBusinessAccess(req.user, businessId);
    return this.alertsService.getSummary(businessId, branchId);
  }

  @Get()
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async list(
    @Query('businessId') businessId: string,
    @Query('branchId') branchId: string,
    @Query('status') status: string,
    @Req() req: any,
  ) {
    assertBusinessAccess(req.user, businessId);
    return this.alertsService.list(businessId, branchId, status);
  }

  @Post('refresh')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async refresh(@Body() dto: RefreshDto, @Req() req: any) {
    assertBusinessAccess(req.user, dto.businessId);
    return this.alertsService.runAlertEngine(dto.businessId);
  }

  @Post('auto-purchase-orders')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async autoPurchaseOrders(@Body() dto: RefreshDto, @Req() req: any) {
    assertBusinessAccess(req.user, dto.businessId);
    return this.alertsService.runAutoPoEngine(dto.businessId, req.user?.sub);
  }

  @Post(':id/acknowledge')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async acknowledge(@Param('id') id: string, @Req() req: any) {
    return this.alertsService.acknowledge(id, req.user?.sub);
  }

  @Post(':id/generate-requisition')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async generateRequisition(@Param('id') id: string, @Req() req: any) {
    return this.alertsService.generateRequisition(id, req.user?.sub);
  }

  @Post(':id/generate-purchase-order')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async generatePurchaseOrder(@Param('id') id: string, @Req() req: any) {
    return this.alertsService.generatePurchaseOrder(id, req.user?.sub);
  }
}
