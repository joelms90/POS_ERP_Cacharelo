import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { BranchCatalogService } from './branch-catalog.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE } from '../auth/roles';
import { assertBusinessAccess } from '../auth/business-access';
import { IsUUID, IsNotEmpty, IsBoolean } from 'class-validator';

class UpsertBranchProductDto {
  @IsUUID()
  businessId: string;

  @IsUUID()
  branchId: string;

  @IsUUID()
  productId: string;

  @IsBoolean()
  isSellable: boolean;
}

@Controller('branch-catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchCatalogController {
  constructor(private readonly branchCatalogService: BranchCatalogService) {}

  @Get()
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async list(@Query('branchId') branchId: string, @Req() req: any) {
    return this.branchCatalogService.listByBranch(branchId);
  }

  @Post()
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async upsert(@Body() dto: UpsertBranchProductDto, @Req() req: any) {
    assertBusinessAccess(req.user, dto.businessId);
    return this.branchCatalogService.upsert(dto);
  }

  @Delete(':id')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async remove(@Param('id') id: string) {
    return this.branchCatalogService.remove(id);
  }
}
