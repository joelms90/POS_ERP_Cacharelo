import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreatePrintJobDto } from './dto/create-print-job.dto';
import { PrintStationHeartbeatDto } from './dto/print-station-heartbeat.dto';
import { UpdatePrintJobStatusDto } from './dto/update-print-job-status.dto';
import { PrintingService } from './printing.service';

@Controller()
export class PrintingController {
  constructor(private readonly printingService: PrintingService) {}

  @Get('print-stations')
  @HttpCode(HttpStatus.OK)
  async findOnlineStations(@Query('branchId') branchId: string) {
    return this.printingService.findOnlineStations(branchId);
  }

  @Post('print-stations/heartbeat')
  @HttpCode(HttpStatus.OK)
  async heartbeat(@Body() dto: PrintStationHeartbeatDto) {
    return this.printingService.heartbeat(dto);
  }

  @Post('print-jobs')
  @HttpCode(HttpStatus.CREATED)
  async createPrintJob(@Body() dto: CreatePrintJobDto) {
    return this.printingService.createPrintJob(dto);
  }

  @Get('print-jobs')
  @HttpCode(HttpStatus.OK)
  async findPrintJobs(
    @Query('branchId') branchId?: string,
    @Query('targetStationId') targetStationId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.printingService.findPrintJobs({
      branchId,
      targetStationId,
      status,
      limit,
    });
  }

  @Patch('print-jobs/:id/status')
  @HttpCode(HttpStatus.OK)
  async updatePrintJobStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePrintJobStatusDto,
  ) {
    return this.printingService.updatePrintJobStatus(id, dto);
  }
}
