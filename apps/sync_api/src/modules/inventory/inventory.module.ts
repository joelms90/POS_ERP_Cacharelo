import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { JwtModule } from '@nestjs/jwt';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './repositories/inventory.repository';
import { LedgerService } from './ledger.service';
import { ThresholdsService } from './thresholds/thresholds.service';
import { ThresholdsController } from './thresholds/thresholds.controller';
import { AlertsService } from './alerts/alerts.service';
import { AlertsController } from './alerts/alerts.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [InventoryController, ThresholdsController, AlertsController],
  providers: [
    InventoryService,
    InventoryRepository,
    LedgerService,
    ThresholdsService,
    AlertsService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [InventoryService, InventoryRepository, LedgerService, ThresholdsService, AlertsService],
})
export class InventoryModule {}
