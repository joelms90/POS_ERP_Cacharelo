import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './repositories/inventory.repository';
import { LedgerService } from './ledger.service';

@Module({
  imports: [DatabaseModule],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryRepository, LedgerService],
  exports: [InventoryService, InventoryRepository, LedgerService],
})
export class InventoryModule {}
