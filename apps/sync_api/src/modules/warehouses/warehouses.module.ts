import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';
import { WarehousesRepository } from './repositories/warehouses.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [WarehousesController],
  providers: [WarehousesService, WarehousesRepository],
  exports: [WarehousesService, WarehousesRepository],
})
export class WarehousesModule {}
