import { Controller, Post, Get, Body, Param, Query, HttpCode, HttpStatus, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CASHIER_ROLE, BRANCH_OPERATOR_ROLE } from '../auth/roles';

type ShiftRequest = { user?: { sub?: string; branchId?: string; businessId?: string } };

@Controller('cash-shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(CASHIER_ROLE, BRANCH_OPERATOR_ROLE)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async open(@Body() openShiftDto: OpenShiftDto, @Req() req: ShiftRequest) {
    const scope = this.scope(req, openShiftDto.branchId, openShiftDto.cashierId);
    return this.shiftsService.openShift({ ...openShiftDto, ...scope });
  }

  @Get('active')
  @HttpCode(HttpStatus.OK)
  async getActive(
    @Query('branchId') branchId: string,
    @Query('cashierId') cashierId: string,
    @Req() req: ShiftRequest,
  ) {
    const scope = this.scope(req, branchId, cashierId);
    return this.shiftsService.getActiveShift(scope.branchId, scope.cashierId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string, @Req() req: ShiftRequest) {
    return this.ownedShift(id, req);
  }

  @Post(':id/transactions')
  @HttpCode(HttpStatus.CREATED)
  async addTransaction(
    @Param('id') id: string,
    @Body() createTransactionDto: CreateTransactionDto,
    @Req() req: ShiftRequest,
  ) {
    await this.ownedShift(id, req);
    return this.shiftsService.createTransaction(id, createTransactionDto);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  async close(
    @Param('id') id: string,
    @Body() closeShiftDto: CloseShiftDto,
    @Req() req: ShiftRequest,
  ) {
    await this.ownedShift(id, req);
    return this.shiftsService.closeShift(id, closeShiftDto);
  }

  private scope(req: ShiftRequest, branchId?: string, cashierId?: string) {
    const actor = req.user;
    if (!actor?.sub || !actor.branchId || !actor.businessId) {
      throw new ForbiddenException('Se requiere un operador con negocio y sucursal.');
    }
    if ((branchId !== undefined && branchId !== actor.branchId) ||
        (cashierId !== undefined && cashierId !== actor.sub)) {
      throw new ForbiddenException('Solo puedes acceder a tu caja y sucursal.');
    }
    return { branchId: actor.branchId, cashierId: actor.sub };
  }

  private async ownedShift(id: string, req: ShiftRequest) {
    const scope = this.scope(req);
    const shift = await this.shiftsService.getShiftById(id);
    if (shift.branchId !== scope.branchId || shift.cashierId !== scope.cashierId) {
      throw new ForbiddenException('Solo puedes acceder a tu caja y sucursal.');
    }
    return shift;
  }
}
