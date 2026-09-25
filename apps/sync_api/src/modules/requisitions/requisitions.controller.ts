import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Req } from '@nestjs/common';
import { RequisitionsService } from './requisitions.service';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { UpdateRequisitionStatusDto } from './dto/update-requisition-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BRANCH_OPERATOR_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE, OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE } from '../auth/roles';
import { assertBusinessAccess } from '../auth/business-access';

@Controller('requisitions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RequisitionsController {
  constructor(private readonly requisitionsService: RequisitionsService) {}

  @Post()
  @Roles(BRANCH_OPERATOR_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE)
  async create(@Body() createRequisitionDto: CreateRequisitionDto, @Req() req: any) {
    assertBusinessAccess(req.user, createRequisitionDto.businessId);
    return this.requisitionsService.create({ ...createRequisitionDto, createdBy: req.user.sub });
  }

  @Get('branch/:branchId')
  @Roles(BRANCH_OPERATOR_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE, OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async findByBranch(
    @Param('branchId') branchId: string,
    @Query('businessId') businessId: string,
    @Req() req: any,
  ) {
    assertBusinessAccess(req.user, businessId);
    return this.requisitionsService.findByBranch(branchId, businessId);
  }

  @Get('pending')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async findPending(@Query('businessId') businessId: string, @Req() req: any) {
    assertBusinessAccess(req.user, businessId);
    return this.requisitionsService.findPendingForBusiness(businessId);
  }

  @Get()
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async findAll(@Query('businessId') businessId: string, @Req() req: any) {
    assertBusinessAccess(req.user, businessId);
    return this.requisitionsService.findAll(businessId);
  }

  @Patch(':id/status')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateRequisitionStatusDto,
    @Req() req: any,
  ) {
    return this.requisitionsService.updateStatus(id, updateStatusDto, req.user.sub, req.user.roles || [req.user.role]);
  }

  @Get(':id')
  @Roles(BRANCH_OPERATOR_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE, OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async findOne(@Param('id') id: string, @Req() req: any) {
    const requisition = await this.requisitionsService.findOne(id);
    if (requisition) {
      assertBusinessAccess(req.user, requisition.businessId);
    }
    return requisition;
  }
}
