import { Controller, Get, Query, BadRequestException, Param, UseGuards, Req, ForbiddenException, Optional } from '@nestjs/common';
import { SupervisorScopeService } from '../audit/supervisor-scope.service';
import { ReportsService } from './reports.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtOrAdminTokenGuard } from '../auth/guards/jwt-or-admin-token.guard';
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
  BRANCH_SUPERVISOR_ROLE,
  WAREHOUSE_PURCHASING_OPERATOR_ROLE,
  normalizeOperationalRole,
} from '../auth/roles';

type ReportRequest = { user?: { sub?: string; branchId?: string; businessId?: string; businessAccess?: Array<{ businessId?: string; role?: string }>; role?: string; roles?: string[]; legacyAdmin?: boolean } };
const REPORT_ADMIN_ROLES = [OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE];
// Supervisors work from the supervision inbox; sales reports stay with admins.
const SALES_REPORT_ROLES = [...REPORT_ADMIN_ROLES];
const INVENTORY_REPORT_ROLES = [...REPORT_ADMIN_ROLES, WAREHOUSE_PURCHASING_OPERATOR_ROLE];

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    @Optional() private readonly supervisorScope?: SupervisorScopeService,
  ) {}

  @Get('sales-dashboard')
  @UseGuards(JwtOrAdminTokenGuard, RolesGuard)
  @Roles(...SALES_REPORT_ROLES)
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
    await this.assertSupervisorBranch(req, branchId);
    return this.reportsService.getSalesDashboard(businessId, startDate, endDate, branchId);
  }

  @Get('sales/products')
  @UseGuards(JwtOrAdminTokenGuard, RolesGuard)
  @Roles(...SALES_REPORT_ROLES)
  async getProductSalesReport(
    @Req() req: ReportRequest,
    @Query('businessId') businessId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') branchId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('El parámetro businessId es obligatorio.');
    }
    this.assertScope(req, businessId, branchId);
    await this.assertSupervisorBranch(req, branchId);
    return this.reportsService.getProductSalesReport({
      businessId,
      startDate,
      endDate,
      branchId,
      categoryId,
    });
  }

  @Get('inventory/existence')
  @UseGuards(JwtOrAdminTokenGuard, RolesGuard)
  @Roles(...INVENTORY_REPORT_ROLES)
  async getInventoryExistence(
    @Req() req: ReportRequest,
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
    this.assertScope(req, businessId, branchId);
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
  @UseGuards(JwtOrAdminTokenGuard, RolesGuard)
  @Roles(...INVENTORY_REPORT_ROLES)
  async getInventoryKardex(
    @Req() req: ReportRequest,
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
    this.assertScope(req, businessId, branchId);
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
  @UseGuards(JwtOrAdminTokenGuard, RolesGuard)
  @Roles(...SALES_REPORT_ROLES)
  async getPaymentMethodsSalesReport(
    @Req() req: ReportRequest,
    @Query('businessId') businessId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') branchId?: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('El parámetro businessId es obligatorio.');
    }
    this.assertScope(req, businessId, branchId);
    await this.assertSupervisorBranch(req, branchId);
    return this.reportsService.getPaymentMethodsSalesReport({
      businessId,
      startDate,
      endDate,
      branchId,
    });
  }

  @Get('cash-shifts')
  @UseGuards(JwtOrAdminTokenGuard, RolesGuard)
  @Roles(...SALES_REPORT_ROLES)
  async getCashShiftsList(
    @Req() req: ReportRequest,
    @Query('businessId') businessId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') branchId?: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('El parámetro businessId es obligatorio.');
    }
    this.assertScope(req, businessId, branchId);
    const branchIds = await this.supervisorBranchIds(req, branchId);
    return this.reportsService.getCashShiftsList({
      businessId,
      startDate,
      endDate,
      branchId,
      branchIds,
    });
  }

  @Get('cash-shifts/:id/audit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    ...REPORT_ADMIN_ROLES,
    BRANCH_SUPERVISOR_ROLE,
    CASHIER_ROLE,
    BRANCH_OPERATOR_ROLE,
    ENCARGADO_ROLE,
    RESPONSABLE_ROLE,
  )
  async getCashShiftAuditReport(
    @Param('id') id: string,
    @Req() req: ReportRequest,
  ) {
    const assignedBranchIds = this.isSupervisorOnly(req)
      ? await this.supervisorScope?.assignedBranchIds(req.user!.sub!) ?? []
      : undefined;
    return this.reportsService.getCashShiftAuditReport(id, req.user, assignedBranchIds);
  }

  /** True when the caller is a supervisor without owner/admin roles. */
  private isSupervisorOnly(req: ReportRequest) {
    const roles = (req.user?.roles?.length ? req.user.roles : [req.user?.role]).map((r) => normalizeOperationalRole(r ?? ''));
    return roles.includes(BRANCH_SUPERVISOR_ROLE) && !roles.some((r) => REPORT_ADMIN_ROLES.includes(r as any));
  }

  /** Supervisors must pick one of their assigned branches for sales reports (D-9/P-3). */
  private async assertSupervisorBranch(req: ReportRequest, branchId?: string) {
    if (!this.isSupervisorOnly(req)) return;
    if (!branchId) throw new ForbiddenException('Selecciona una de tus sucursales asignadas.');
    const assigned = (await this.supervisorScope?.assignedBranchIds(req.user!.sub!)) ?? [];
    if (!assigned.includes(branchId)) throw new ForbiddenException('Esta sucursal no está asignada a tu supervisión.');
  }

  /** Branch filter for list reports: a supervisor only ever sees assigned branches. */
  private async supervisorBranchIds(req: ReportRequest, branchId?: string): Promise<string[] | undefined> {
    if (!this.isSupervisorOnly(req)) return undefined;
    const assigned = (await this.supervisorScope?.assignedBranchIds(req.user!.sub!)) ?? [];
    if (branchId && !assigned.includes(branchId)) throw new ForbiddenException('Esta sucursal no está asignada a tu supervisión.');
    return branchId ? [branchId] : assigned;
  }

  private assertScope(req: ReportRequest, businessId: string, branchId?: string) {
    const actor = req.user;
    // Legacy admin-password sessions act as a global owner (same as AdminGuard).
    if (actor?.legacyAdmin) return;
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
