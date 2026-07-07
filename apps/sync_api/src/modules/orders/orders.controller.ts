import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { AddOrderItemsDto } from './dto/add-order-items.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('orders')
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
  async cancel(@Param('id') id: string) {
    return this.ordersService.cancelOrder(id);
  }
}
