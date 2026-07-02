import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales-dashboard')
  async getSalesDashboard(
    @Query('businessId') businessId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!businessId) {
      throw new BadRequestException('El parámetro businessId es obligatorio.');
    }
    return this.reportsService.getSalesDashboard(businessId, startDate, endDate);
  }
}
