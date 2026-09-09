import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ThresholdsService } from './thresholds.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE } from '../../auth/roles';
import { assertBusinessAccess } from '../../auth/business-access';
import { IsUUID, IsOptional, IsNumber, Min } from 'class-validator';

class UpsertThresholdDto {
  @IsUUID()
  businessId: string;

  @IsUUID()
  productId: string;

  @IsUUID()
  branchId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStock?: number;
}

class UpsertWarehouseThresholdDto {
  @IsUUID()
  businessId: string;

  @IsUUID()
  productId: string;

  @IsUUID()
  warehouseId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStock?: number;
}

@Controller('inventory/thresholds')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ThresholdsController {
  constructor(private readonly thresholdsService: ThresholdsService) {}

  @Get()
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async list(@Query('businessId') businessId: string, @Query('branchId') branchId: string, @Req() req: any) {
    assertBusinessAccess(req.user, businessId);
    return this.thresholdsService.listByBusiness(businessId, branchId);
  }

  @Post()
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async upsert(@Body() dto: UpsertThresholdDto, @Req() req: any) {
    assertBusinessAccess(req.user, dto.businessId);
    return this.thresholdsService.upsert({
      businessId: dto.businessId,
      productId: dto.productId,
      branchId: dto.branchId,
      minStock: dto.minStock,
      maxStock: dto.maxStock,
      updatedBy: req.user?.sub,
    });
  }

  @Delete(':id')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async remove(@Param('id') id: string) {
    return this.thresholdsService.remove(id);
  }

  @Get('warehouses')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async listWarehouses(@Query('businessId') businessId: string, @Query('warehouseId') warehouseId: string, @Req() req: any) {
    assertBusinessAccess(req.user, businessId);
    return this.thresholdsService.listWarehousesByBusiness(businessId, warehouseId);
  }

  @Post('warehouses')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async upsertWarehouse(@Body() dto: UpsertWarehouseThresholdDto, @Req() req: any) {
    assertBusinessAccess(req.user, dto.businessId);
    return this.thresholdsService.upsertWarehouse({
      businessId: dto.businessId,
      productId: dto.productId,
      warehouseId: dto.warehouseId,
      minStock: dto.minStock,
      maxStock: dto.maxStock,
      updatedBy: req.user?.sub,
    });
  }

  @Delete('warehouses/:id')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async removeWarehouse(@Param('id') id: string) {
    return this.thresholdsService.removeWarehouse(id);
  }

  @Get('suggestions')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async suggestions(@Query('businessId') businessId: string, @Query('weeks') weeks: string, @Req() req: any) {
    assertBusinessAccess(req.user, businessId);
    return this.thresholdsService.getSuggestions(businessId, Number(weeks) || 4);
  }
}
