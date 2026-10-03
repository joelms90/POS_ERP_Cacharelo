import { Module, forwardRef } from '@nestjs/common';
import { OrdersAccessGuard } from './orders-access.guard';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './repositories/orders.repository';
import { SyncModule } from '../sync/sync.module';
import { InventoryModule } from '../inventory/inventory.module';
import { JwtModule } from '@nestjs/jwt';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [forwardRef(() => SyncModule), InventoryModule, JwtModule.register({})],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, AdminGuard, OrdersAccessGuard],
  exports: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
