import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { RequisitionsService } from './requisitions.service';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import {
  ApproveRequisitionDto,
  DeliverRequisitionDto,
  DispatchRequisitionDto,
  ReasonDto,
} from './dto/requisition-flow.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  BRANCH_OPERATOR_ROLE,
  INVENTORY_ADMIN_ROLE,
  OWNER_ROLE,
  SUPPORT_TECH_ROLE,
  WAREHOUSE_PURCHASING_OPERATOR_ROLE,
} from '../auth/roles';

/**
 * Branch requisitions. Who does what:
 * - OIS (POS): creates for its branch → pending_approval; confirms receipt (inventory/transfers/:id/receive).
 * - Owner / Admin. Inventario (web): create (born approved), approve, reject.
 * - Almacén y Bodega (POS): sees approved ones only; holds, dispatches, marks delivered.
 * - Soporte Técnico: read-only.
 */
@Controller('requisitions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RequisitionsController {
  constructor(private readonly requisitionsService: RequisitionsService) {}

  @Post()
  @Roles(BRANCH_OPERATOR_ROLE, OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async create(@Body() dto: CreateRequisitionDto, @Req() req: any) {
    return this.requisitionsService.createForOperator(dto, req.user);
  }

  /** The POS never supplies a user or branch: both are determined from its signed login. */
  @Get('mine')
  @Roles(BRANCH_OPERATOR_ROLE)
  async findMine(@Query('status') status: string | undefined, @Req() req: any) {
    return this.requisitionsService.findMine(req.user, status);
  }

  @Get('pending')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async findPending(@Query('businessId') businessId: string, @Req() req: any) {
    return this.requisitionsService.findPendingForBusiness(businessId, req.user);
  }

  @Get('outbound')
  @Roles(WAREHOUSE_PURCHASING_OPERATOR_ROLE, OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async findOutbound(@Query('businessId') businessId: string, @Req() req: any) {
    return this.requisitionsService.findOutbound(businessId, req.user);
  }

  @Get('branch/:branchId')
  @Roles(BRANCH_OPERATOR_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE, OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async findByBranch(@Param('branchId') branchId: string, @Query('businessId') businessId: string, @Req() req: any) {
    return this.requisitionsService.findByBranch(branchId, businessId, req.user);
  }

  @Get()
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE)
  async findAll(@Query('businessId') businessId: string, @Req() req: any) {
    return this.requisitionsService.findAll(businessId, req.user);
  }

  @Post(':id/approve')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async approve(@Param('id') id: string, @Body() dto: ApproveRequisitionDto, @Req() req: any) {
    return this.requisitionsService.approve(id, dto, req.user);
  }

  @Post(':id/reject')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async reject(@Param('id') id: string, @Body() dto: ReasonDto, @Req() req: any) {
    return this.requisitionsService.reject(id, dto, req.user);
  }

  @Post(':id/hold')
  @Roles(WAREHOUSE_PURCHASING_OPERATOR_ROLE)
  async hold(@Param('id') id: string, @Body() dto: ReasonDto, @Req() req: any) {
    return this.requisitionsService.hold(id, dto, req.user);
  }

  @Post(':id/dispatch')
  @Roles(WAREHOUSE_PURCHASING_OPERATOR_ROLE)
  async dispatch(@Param('id') id: string, @Body() dto: DispatchRequisitionDto, @Req() req: any) {
    return this.requisitionsService.dispatch(id, dto, req.user);
  }

  @Post(':id/deliver')
  @Roles(WAREHOUSE_PURCHASING_OPERATOR_ROLE, OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async deliver(@Param('id') id: string, @Body() dto: DeliverRequisitionDto, @Req() req: any) {
    return this.requisitionsService.deliver(id, dto, req.user);
  }

  @Get(':id/history')
  @Roles(BRANCH_OPERATOR_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE, OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async history(@Param('id') id: string, @Req() req: any) {
    return this.requisitionsService.history(id, req.user);
  }

  @Get(':id')
  @Roles(BRANCH_OPERATOR_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE, OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.requisitionsService.findOne(id, req.user);
  }
}
