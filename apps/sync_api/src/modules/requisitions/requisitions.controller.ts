import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { RequisitionsService } from './requisitions.service';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { UpdateRequisitionStatusDto } from './dto/update-requisition-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ENCARGADO_ROLE, OWNER_ROLE, INVENTORY_ADMIN_ROLE } from '../auth/roles';

@Controller('requisitions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RequisitionsController {
  constructor(private readonly requisitionsService: RequisitionsService) {}

  private getUserBusinessIds(req: any): string[] {
    const user = req.user;
    if (!user) throw new ForbiddenException('No user context');
    const ids: string[] = [];
    if (user.businessId) ids.push(user.businessId);
    if (user.businessAccess) {
      for (const access of user.businessAccess) {
        if (access.businessId && !ids.includes(access.businessId)) {
          ids.push(access.businessId);
        }
      }
    }
    return ids;
  }

  private validateBusinessAccess(req: any, targetBusinessId: string) {
    const ids = this.getUserBusinessIds(req);
    if (ids.length === 0) return;
    if (!ids.includes(targetBusinessId)) {
      throw new ForbiddenException('No tienes acceso a este negocio');
    }
  }

  @Post()
  @Roles(ENCARGADO_ROLE)
  async create(@Body() createRequisitionDto: CreateRequisitionDto, @Req() req: any) {
    this.validateBusinessAccess(req, createRequisitionDto.businessId);
    return this.requisitionsService.create(createRequisitionDto);
  }

  @Get('branch/:branchId')
  @Roles(ENCARGADO_ROLE, OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async findByBranch(
    @Param('branchId') branchId: string,
    @Query('businessId') businessId: string,
    @Req() req: any,
  ) {
    if (businessId) this.validateBusinessAccess(req, businessId);
    return this.requisitionsService.findByBranch(branchId, businessId);
  }

  @Get('pending')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async findPending(@Query('businessId') businessId: string, @Req() req: any) {
    this.validateBusinessAccess(req, businessId);
    return this.requisitionsService.findPendingForBusiness(businessId);
  }

  @Get()
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async findAll(@Query('businessId') businessId: string, @Req() req: any) {
    this.validateBusinessAccess(req, businessId);
    return this.requisitionsService.findAll(businessId);
  }

  @Patch(':id/status')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateRequisitionStatusDto,
  ) {
    return this.requisitionsService.updateStatus(id, updateStatusDto);
  }

  @Get(':id')
  @Roles(ENCARGADO_ROLE, OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async findOne(@Param('id') id: string, @Req() req: any) {
    const requisition = await this.requisitionsService.findOne(id);
    if (requisition) {
      this.validateBusinessAccess(req, requisition.businessId);
    }
    return requisition;
  }
}
