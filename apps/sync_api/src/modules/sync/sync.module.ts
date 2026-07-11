import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncGateway } from './sync.gateway';

@Module({
  imports: [JwtModule.register({})],
  controllers: [SyncController],
  providers: [SyncService, SyncGateway],
  exports: [SyncService, SyncGateway],
})
export class SyncModule {}
