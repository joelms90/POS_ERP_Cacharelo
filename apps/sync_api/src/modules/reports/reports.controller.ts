import { Controller, Get, Query, BadRequestException, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { assertBusinessAccess } from '../auth/business-access';
import {
  CASHIER_ROLE,
  BRANCH_OPERATOR_ROLE,
  OWNER_ROLE,
  INVENTORY_ADMIN_ROLE,
  SUPPORT_TECH_ROLE,
  ENCARGADO_ROLE,
  RESPONSABLE_ROLE,
} from '../auth/roles';

type ReportRequest = { user?: { sub?: string; branchId?: string; businessId?: string; businessAccess?: Array<{ businessId?: string; role?: string }>; role?: string; roles?: string[] } };
const REPORT_ADMIN_ROLES = [OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE];

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales-dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...REPORT_ADMIN_ROLES)
  async getSalesDashboard(
    @Req() req: ReportRequest,
    @Query('businessId') businessId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') branchId?: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('El parámetro businessId es obligatorio.');
    }
    this.assertScope(req, businessId, branchId);
    return this.reportsService.getSalesDashboard(businessId, startDate, endDate, branchId);
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

  @Get('sales/payment-methods')
  async getPaymentMethodsSalesReport(
    @Query('businessId') businessId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') branchId?: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('El parámetro businessId es obligatorio.');
    }
    return this.reportsService.getPaymentMethodsSalesReport({
      businessId,
      startDate,
      endDate,
      branchId,
    });
  }

  @Get('cash-shifts')
  async getCashShiftsList(
    @Query('businessId') businessId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') branchId?: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('El parámetro businessId es obligatorio.');
    }
    return this.reportsService.getCashShiftsList({
      businessId,
      startDate,
      endDate,
      branchId,
    });
  }

  @Get('cash-shifts/:id/audit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    ...REPORT_ADMIN_ROLES,
    CASHIER_ROLE,
    BRANCH_OPERATOR_ROLE,
    ENCARGADO_ROLE,
    RESPONSABLE_ROLE,
  )
  async getCashShiftAuditReport(
    @Param('id') id: string,
    @Req() req: ReportRequest,
  ) {
    return this.reportsService.getCashShiftAuditReport(id, req.user);
  }

  private assertScope(req: ReportRequest, businessId: string, branchId?: string) {
    const actor = req.user;
    assertBusinessAccess(actor, businessId);
    if (!actor?.businessId && !actor?.businessAccess?.length) {
      throw new ForbiddenException('Se requiere un negocio asociado.');
    }
    if (branchId && actor.branchId && actor.branchId !== branchId) {
      throw new ForbiddenException('Solo puedes acceder a los reportes de tu sucursal.');
    }
  }

  @Get('tickets/today')
  @UseGuards(AdminGuard)
  async getTicketsToday(
    @Query('businessId') businessId: string,
    @Query('branchId') branchId?: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('El parámetro businessId es obligatorio.');
    }
    return this.reportsService.getTicketsToday(businessId, branchId);
  }
}
