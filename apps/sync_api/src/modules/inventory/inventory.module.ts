import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './repositories/inventory.repository';
import { LedgerService } from './ledger.service';
import { ThresholdsService } from './thresholds/thresholds.service';
import { ThresholdsController } from './thresholds/thresholds.controller';
import { AlertsService } from './alerts/alerts.service';
import { AlertsController } from './alerts/alerts.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [InventoryController, ThresholdsController, AlertsController],
  providers: [InventoryService, InventoryRepository, LedgerService, ThresholdsService, AlertsService],
  exports: [InventoryService, InventoryRepository, LedgerService, ThresholdsService, AlertsService],
})
export class InventoryModule {}
