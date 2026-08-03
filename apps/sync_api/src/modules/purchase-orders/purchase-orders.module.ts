import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersRepository } from './repositories/purchase-orders.repository';
import { InventoryModule } from '../inventory/inventory.module';

import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [DatabaseModule, InventoryModule, JwtModule.register({})],
  controllers: [PurchaseOrdersController],
  providers: [
    PurchaseOrdersService,
    PurchaseOrdersRepository,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [PurchaseOrdersRepository],
})
export class PurchaseOrdersModule {}
