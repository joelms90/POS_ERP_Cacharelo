import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OWNER_ROLE } from '../auth/roles';
import { OwnerCopilotService } from './owner-copilot.service';

class ChatDto { @IsString() @MaxLength(4000) prompt!: string; @IsUUID() businessId!: string; @IsOptional() @IsUUID() branchId?: string; @IsOptional() @IsUUID() conversationId?: string; }
class ConfirmDto { @IsString() @MaxLength(200) confirmationToken!: string; }

@Controller('owner-copilot')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(OWNER_ROLE)
export class OwnerCopilotController {
  constructor(private readonly service: OwnerCopilotService) {}
  @Post('chat') chat(@Req() req: any, @Body() dto: ChatDto) { return this.service.chat(req.user, dto); }
  @Post('confirm') confirm(@Req() req: any, @Body() dto: ConfirmDto) { return this.service.confirm(req.user, dto); }
}
