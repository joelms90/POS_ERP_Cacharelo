import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module';
import { ReportsModule } from '../reports/reports.module';
import { InventoryModule } from '../inventory/inventory.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OwnerCopilotController } from './owner-copilot.controller';
import { OwnerCopilotService } from './owner-copilot.service';
import { LocalDemoOwnerCopilotProvider } from './local-demo.provider';
@Module({ imports: [DatabaseModule, ReportsModule, InventoryModule, JwtModule.register({})], controllers: [OwnerCopilotController], providers: [OwnerCopilotService, LocalDemoOwnerCopilotProvider, JwtAuthGuard, RolesGuard] })
export class OwnerCopilotModule {}
