import { Controller, Post, Get, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Controller('cash-shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async open(@Body() openShiftDto: OpenShiftDto) {
    return this.shiftsService.openShift(openShiftDto);
  }

  @Get('active')
  @HttpCode(HttpStatus.OK)
  async getActive(
    @Query('branchId') branchId: string,
    @Query('cashierId') cashierId: string,
  ) {
    return this.shiftsService.getActiveShift(branchId, cashierId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string) {
    return this.shiftsService.getShiftById(id);
  }

  @Post(':id/transactions')
  @HttpCode(HttpStatus.CREATED)
  async addTransaction(
    @Param('id') id: string,
    @Body() createTransactionDto: CreateTransactionDto,
  ) {
    return this.shiftsService.createTransaction(id, createTransactionDto);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  async close(
    @Param('id') id: string,
    @Body() closeShiftDto: CloseShiftDto,
  ) {
    return this.shiftsService.closeShift(id, closeShiftDto);
  }
}
