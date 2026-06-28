import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { InquiriesService, Inquiry } from './inquiries.service';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('admin/inquiries')
@UseGuards(AdminGuard)
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Get()
  async findAll(@Query('status') status?: string): Promise<Inquiry[]> {
    return this.inquiriesService.findAll(status);
  }

  @Patch(':id')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ): Promise<Inquiry> {
    return this.inquiriesService.updateStatus(id, status);
  }
}
