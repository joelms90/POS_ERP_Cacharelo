import { OrdersRepository } from '../orders/repositories/orders.repository';
import { LedgerService } from '../inventory/ledger.service';
import { SyncAccessService } from './sync-access.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncGateway } from './sync.gateway';

@Module({
  imports: [JwtModule.register({})],
  controllers: [SyncController],
  providers: [SyncService, SyncGateway, SyncAccessService, JwtAuthGuard, OrdersRepository, LedgerService],
  exports: [SyncService, SyncGateway],
})
export class SyncModule {}
