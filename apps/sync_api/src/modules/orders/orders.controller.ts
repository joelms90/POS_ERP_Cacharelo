import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { OrdersAccessGuard } from './orders-access.guard';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { AddOrderItemsDto } from './dto/add-order-items.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BRANCH_OPERATOR_ROLE, CASHIER_ROLE, OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE } from '../auth/roles';
import { CancelOrderDto } from './dto/cancel-order.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, OrdersAccessGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get('active')
  @HttpCode(HttpStatus.OK)
  async findActive(@Query('branchId') branchId: string) {
    return this.ordersService.findActiveByBranch(branchId);
  }

  @Get('active/business')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  async findActiveByBusiness(@Query('businessId') businessId: string) {
    return this.ordersService.findActiveByBusiness(businessId);
  }

  @Get('reports/daily-summary')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(BRANCH_OPERATOR_ROLE, CASHIER_ROLE, OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async dailySummary(@Query('date') date: string | undefined, @Req() req: any) {
    return this.ordersService.getDailyPaymentSummary(req.user, date);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post(':id/items')
  @HttpCode(HttpStatus.OK)
  async addItems(@Param('id') id: string, @Body() addOrderItemsDto: AddOrderItemsDto) {
    return this.ordersService.addItems(id, addOrderItemsDto);
  }

  @Post(':id/billing')
  @HttpCode(HttpStatus.OK)
  async requestBilling(@Param('id') id: string) {
    return this.ordersService.requestBilling(id);
  }

  @Post(':id/payments')
  @HttpCode(HttpStatus.OK)
  async processPayment(@Param('id') id: string, @Body() createPaymentDto: CreatePaymentDto) {
    return this.ordersService.processPayment(id, createPaymentDto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(BRANCH_OPERATOR_ROLE, CASHIER_ROLE, OWNER_ROLE, INVENTORY_ADMIN_ROLE, SUPPORT_TECH_ROLE)
  async cancel(@Param('id') id: string, @Body() dto: CancelOrderDto, @Req() req: any) {
    return this.ordersService.cancelOrder(id, dto.reason, req.user);
  }

}
