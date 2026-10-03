import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { SyncService } from './sync.service';
import { PushSyncDto } from './dto/push-sync.dto';
import { PullSyncDto } from './dto/pull-sync.dto';
import { AckSyncDto } from './dto/ack-sync.dto';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('push')
  @HttpCode(HttpStatus.OK)
  async push(@Req() req: any, @Body() pushSyncDto: PushSyncDto) {
    return this.syncService.push(pushSyncDto, req.user);
  }

  @Post('pull')
  @HttpCode(HttpStatus.OK)
  async pull(@Req() req: any, @Body() pullSyncDto: PullSyncDto) {
    return this.syncService.pull(pullSyncDto, req.user);
  }

  @Post('ack')
  @HttpCode(HttpStatus.OK)
  async ack(@Req() req: any, @Body() ackSyncDto: AckSyncDto) {
    return this.syncService.ack(ackSyncDto, req.user);
  }
}
