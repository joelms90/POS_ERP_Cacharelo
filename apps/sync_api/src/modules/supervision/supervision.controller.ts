import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  BRANCH_OPERATOR_ROLE,
  BRANCH_SUPERVISOR_ROLE,
  CASHIER_ROLE,
  OWNER_ROLE,
} from '../auth/roles';
import type { JwtUser } from '../audit/supervisor-scope.service';
import { ApprovalsService } from './approvals.service';
import {
  AdjustMovementDto,
  AdjustShiftDto,
  ApproveDto,
  AssignmentsDto,
  ReasonDto,
  RejectDto,
} from './dto/approval.dto';

type SupervisionRequest = { user?: JwtUser & { deviceId?: string } };

/**
 * Spec 019 — supervision endpoints. Guards only admit the roles involved in the
 * chain; who may act on each item is decided in ApprovalsService (server-side,
 * BR-ROLE-004): N1/N2 level, assignments, no self-approval, C-1.
 */
@Controller('supervision')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(OWNER_ROLE, BRANCH_SUPERVISOR_ROLE, BRANCH_OPERATOR_ROLE, CASHIER_ROLE)
export class SupervisionController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get('approvals')
  list(
    @Req() req: SupervisionRequest,
    @Query('type') type?: 'corte_z' | 'cash_movement',
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('actionable') actionable?: string,
  ) {
    if (type && type !== 'corte_z' && type !== 'cash_movement')
      throw new BadRequestException('type inválido.');
    return this.approvals.listApprovals(req.user!, {
      type,
      status,
      branchId,
      from,
      to,
      actionable: actionable === 'true',
    });
  }

  @Get('branches')
  branches(@Req() req: SupervisionRequest) {
    return this.approvals.visibleBranches(req.user!);
  }

  @Get('approvals/count')
  count(@Req() req: SupervisionRequest) {
    return this.approvals.countActionable(req.user!);
  }

  @Get('cash-shifts/:id')
  shiftDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: SupervisionRequest,
  ) {
    return this.approvals.getShiftDetail(id, req.user!);
  }

  @Post('cash-shifts/:id/approve')
  @HttpCode(HttpStatus.OK)
  approveShift(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveDto,
    @Req() req: SupervisionRequest,
  ) {
    return this.approvals.approveShift(id, req.user!, dto, this.source(req));
  }

  @Post('cash-shifts/:id/reject')
  @HttpCode(HttpStatus.OK)
  rejectShift(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectDto,
    @Req() req: SupervisionRequest,
  ) {
    return this.approvals.rejectShift(id, req.user!, dto, this.source(req));
  }

  @Post('cash-shifts/:id/adjust')
  @HttpCode(HttpStatus.OK)
  adjustShift(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustShiftDto,
    @Req() req: SupervisionRequest,
  ) {
    return this.approvals.adjustShift(id, req.user!, dto, this.source(req));
  }

  @Post('cash-shifts/:id/reopen')
  @HttpCode(HttpStatus.OK)
  reopenShift(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @Req() req: SupervisionRequest,
  ) {
    return this.approvals.reopenShift(id, req.user!, dto.reason);
  }

  @Post('cash-shifts/:id/override-open-block')
  @HttpCode(HttpStatus.OK)
  overrideOpenBlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @Req() req: SupervisionRequest,
  ) {
    return this.approvals.overrideOpenBlock(id, req.user!, dto.reason);
  }

  @Post('cash-movements/:id/approve')
  @HttpCode(HttpStatus.OK)
  approveMovement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveDto,
    @Req() req: SupervisionRequest,
  ) {
    return this.approvals.approveMovement(id, req.user!, dto, this.source(req));
  }

  @Post('cash-movements/:id/reject')
  @HttpCode(HttpStatus.OK)
  rejectMovement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectDto,
    @Req() req: SupervisionRequest,
  ) {
    return this.approvals.rejectMovement(id, req.user!, dto, this.source(req));
  }

  @Post('cash-movements/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelMovement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectDto,
    @Req() req: SupervisionRequest,
  ) {
    return this.approvals.cancelMovement(id, req.user!, dto);
  }

  @Post('cash-movements/:id/adjust')
  @HttpCode(HttpStatus.OK)
  adjustMovement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustMovementDto,
    @Req() req: SupervisionRequest,
  ) {
    return this.approvals.adjustMovement(id, req.user!, dto);
  }

  @Get('cash-movements/:id/impact')
  impact(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('action') action: string,
    @Query('amount') amount: string | undefined,
    @Req() req: SupervisionRequest,
  ) {
    if (action !== 'reject' && action !== 'cancel' && action !== 'adjust') {
      throw new BadRequestException('action debe ser reject, cancel o adjust.');
    }
    const parsed = amount !== undefined ? Number.parseFloat(amount) : undefined;
    if (parsed !== undefined && (!Number.isFinite(parsed) || parsed <= 0))
      throw new BadRequestException('amount inválido.');
    return this.approvals.movementImpact(id, req.user!, action, parsed);
  }

  @Get('debts')
  debts(
    @Req() req: SupervisionRequest,
    @Query('branchId') branchId?: string,
    @Query('cashierId') cashierId?: string,
    @Query('status') status?: string,
    @Query('mine') mine?: string,
  ) {
    return this.approvals.listDebts(req.user!, {
      branchId,
      cashierId,
      status,
      mine: mine === 'true',
    });
  }

  @Get('audit-log')
  auditLog(
    @Req() req: SupervisionRequest,
    @Query('branchId') branchId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.approvals.auditLog(req.user!, {
      branchId,
      entityType,
      entityId,
      actorId,
      action,
      from,
      to,
    });
  }

  @Get('assignments')
  assignments(
    @Req() req: SupervisionRequest,
    @Query('businessId', ParseUUIDPipe) businessId: string,
  ) {
    return this.approvals.listAssignments(req.user!, businessId);
  }

  @Put('assignments/:userId')
  replaceAssignments(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignmentsDto,
    @Req() req: SupervisionRequest,
  ) {
    return this.approvals.replaceAssignments(
      req.user!,
      userId,
      dto.businessId,
      dto.branchIds,
    );
  }

  /** Tablet tokens carry the terminal branch; Business Control tokens do not. */
  private source(req: SupervisionRequest): 'pos' | 'admin_web' {
    return req.user?.branchId ? 'pos' : 'admin_web';
  }
}
