import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from '../audit/notifications.service';

type NotificationsRequest = { user?: { sub?: string; id?: string } };

/** Spec 019 D-6: persistent notifications, each user reads only their own. */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @Req() req: NotificationsRequest,
    @Query('unread') unread?: string,
    @Query('branchId') branchId?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notifications.list(this.userId(req), {
      unread: unread === 'true',
      branchId,
      type,
      from: from ? new Date(`${from}T00:00:00`) : undefined,
      to: to ? new Date(`${to}T23:59:59`) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
      offset: offset ? Number.parseInt(offset, 10) : undefined,
    });
  }

  @Get('unread-count')
  unreadCount(@Req() req: NotificationsRequest) {
    return this.notifications.unreadCount(this.userId(req));
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  readAll(@Req() req: NotificationsRequest) {
    return this.notifications.markAllRead(this.userId(req));
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  read(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: NotificationsRequest,
  ) {
    return this.notifications.markRead(this.userId(req), id);
  }

  private userId(req: NotificationsRequest) {
    return (req.user?.sub ?? req.user?.id)!;
  }
}
