import { Controller, Get, Post, Patch, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { KitchenService } from './kitchen.service';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';

@Controller('kitchen')
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('active')
  @HttpCode(HttpStatus.OK)
  async getActive(@Query('branchId') branchId: string) {
    return this.kitchenService.findActiveTickets(branchId);
  }

  @Post('orders/:orderId/send')
  @HttpCode(HttpStatus.OK)
  async sendOrder(@Param('orderId') orderId: string) {
    return this.kitchenService.sendOrderToKitchen(orderId);
  }

  @Patch('tickets/:id/status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Body() updateTicketStatusDto: UpdateTicketStatusDto,
  ) {
    return this.kitchenService.updateTicketStatus(id, updateTicketStatusDto.status);
  }
}
