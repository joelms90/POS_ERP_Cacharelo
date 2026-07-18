import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
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

  // Encargado can create requisitions
  @Post()
  @Roles(ENCARGADO_ROLE)
  async create(@Body() createRequisitionDto: CreateRequisitionDto) {
    return this.requisitionsService.create(createRequisitionDto);
  }

  // Encargado can view their branch's requisitions
  @Get('branch/:branchId')
  @Roles(ENCARGADO_ROLE)
  async findByBranch(@Param('branchId') branchId: string) {
    return this.requisitionsService.findByBranch(branchId);
  }

  // Inventory admin can view all pending requisitions
  @Get('pending')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async findPending(@Query('businessId') businessId: string) {
    return this.requisitionsService.findPendingForBusiness(businessId);
  }

  // List all requisitions by business (for traspasos integration)
  @Get()
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async findAll(@Query('businessId') businessId: string) {
    return this.requisitionsService.findAll(businessId);
  }

  // Inventory admin can approve/reject requisitions
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
  async findOne(@Param('id') id: string) {
    return this.requisitionsService.findOne(id);
  }
}
