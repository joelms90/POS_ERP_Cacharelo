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
import { InquiriesModule } from './modules/inquiries/inquiries.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { BranchesModule } from './modules/branches/branches.module';
import { RecipesModule } from './modules/recipes/recipes.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TicketSettingsModule } from './modules/ticket-settings/ticket-settings.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { RequisitionsModule } from './modules/requisitions/requisitions.module';
import { PrintingModule } from './modules/printing/printing.module';

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
    InquiriesModule,
    WarehousesModule,
    InventoryModule,
    BranchesModule,
    RecipesModule,
    ReportsModule,
    TicketSettingsModule,
    PurchaseOrdersModule,
    RequisitionsModule,
    PrintingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
