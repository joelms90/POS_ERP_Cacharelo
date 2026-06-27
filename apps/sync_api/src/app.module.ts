import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { SyncModule } from './modules/sync/sync.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { OrdersModule } from './modules/orders/orders.module';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { ProvidersModule } from './modules/providers/providers.module';

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    AuthModule,
    SyncModule,
    CatalogModule,
    ShiftsModule,
    OrdersModule,
    KitchenModule,
    ProvidersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
