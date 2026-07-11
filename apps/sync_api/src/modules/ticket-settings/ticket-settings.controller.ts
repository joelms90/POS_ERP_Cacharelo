import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { TicketSettingsService } from './ticket-settings.service';
import { UpsertTicketSettingsDto } from './dto/upsert-ticket-settings.dto';

@Controller('ticket-settings')
export class TicketSettingsController {
  constructor(private readonly ticketSettingsService: TicketSettingsService) {}

  @Get()
  async findActive(
    @Query('businessId') businessId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.ticketSettingsService.findActiveOrDefault(businessId, branchId);
  }

  @Put()
  async upsert(@Body() dto: UpsertTicketSettingsDto) {
    return this.ticketSettingsService.upsert(dto);
  }
}
