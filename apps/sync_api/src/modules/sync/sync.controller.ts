import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SyncService } from './sync.service';
import { PushSyncDto } from './dto/push-sync.dto';
import { PullSyncDto } from './dto/pull-sync.dto';
import { AckSyncDto } from './dto/ack-sync.dto';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('push')
  @HttpCode(HttpStatus.OK)
  async push(@Body() pushSyncDto: PushSyncDto) {
    return this.syncService.push(pushSyncDto);
  }

  @Post('pull')
  @HttpCode(HttpStatus.OK)
  async pull(@Body() pullSyncDto: PullSyncDto) {
    return this.syncService.pull(pullSyncDto);
  }

  @Post('ack')
  @HttpCode(HttpStatus.OK)
  async ack(@Body() ackSyncDto: AckSyncDto) {
    return this.syncService.ack(ackSyncDto);
  }
}
