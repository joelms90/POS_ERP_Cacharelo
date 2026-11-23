import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { MarkPurchasedDto, PoReasonDto, ReceivePurchaseOrderDto } from './dto/purchase-order-flow.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { INVENTORY_ADMIN_ROLE, OWNER_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE } from '../auth/roles';

/**
 * Purchase orders (OC). Who does what:
 * - Owner / Admin. Inventario (web): create, edit/delete drafts, authorize, cancel, close short.
 * - Almacén y Compras (POS): sees authorized OCs only; marks purchased; registers the entrada.
 *   Owner / Admin. Inv. may do those on its behalf with a reason.
 * - Soporte Técnico: read-only.
 */
@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE)
  async findAll(@Query('businessId') businessId: string, @Req() req: any) {
    return this.purchaseOrdersService.findAll(businessId, req.user);
  }

  /** Almacén y Compras: "Órdenes por comprar" (authorized, purchased, partially received). */
  @Get('purchasing')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE)
  async findPurchasing(@Query('businessId') businessId: string, @Req() req: any) {
    return this.purchaseOrdersService.findPurchasing(businessId, req.user);
  }

  @Get(':id/history')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE)
  async history(@Param('id') id: string, @Req() req: any) {
    return this.purchaseOrdersService.history(id, req.user);
  }

  @Get(':id')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE, WAREHOUSE_PURCHASING_OPERATOR_ROLE)
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.purchaseOrdersService.findOne(id, req.user);
  }

  @Post()
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async create(@Body() dto: CreatePurchaseOrderDto, @Req() req: any) {
    return this.purchaseOrdersService.create(dto, req.user);
  }

  @Patch(':id')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async update(@Param('id') id: string, @Body() dto: UpdatePurchaseOrderDto, @Req() req: any) {
    return this.purchaseOrdersService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.purchaseOrdersService.remove(id, req.user);
  }

  @Post(':id/authorize')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async authorize(@Param('id') id: string, @Req() req: any) {
    return this.purchaseOrdersService.authorize(id, req.user);
  }

  @Post(':id/cancel')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async cancel(@Param('id') id: string, @Body() dto: PoReasonDto, @Req() req: any) {
    return this.purchaseOrdersService.cancel(id, dto, req.user);
  }

  @Post(':id/close')
  @Roles(OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async closeShort(@Param('id') id: string, @Body() dto: PoReasonDto, @Req() req: any) {
    return this.purchaseOrdersService.closeShort(id, dto, req.user);
  }

  @Post(':id/purchase')
  @Roles(WAREHOUSE_PURCHASING_OPERATOR_ROLE, OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async markPurchased(@Param('id') id: string, @Body() dto: MarkPurchasedDto, @Req() req: any) {
    return this.purchaseOrdersService.markPurchased(id, dto, req.user);
  }

  /** Entrada: single count + price paid; stock updates when it is confirmed. */
  @Post(':id/receive')
  @Roles(WAREHOUSE_PURCHASING_OPERATOR_ROLE, OWNER_ROLE, INVENTORY_ADMIN_ROLE)
  async receive(@Param('id') id: string, @Body() dto: ReceivePurchaseOrderDto, @Req() req: any) {
    return this.purchaseOrdersService.receive(id, dto, req.user);
  }
}
