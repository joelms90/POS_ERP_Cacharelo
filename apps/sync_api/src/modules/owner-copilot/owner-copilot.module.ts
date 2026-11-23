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
import { GeminiOwnerCopilotProvider } from './gemini.provider';
import { OWNER_COPILOT_PROVIDER } from './owner-copilot.types';
@Module({
  imports: [DatabaseModule, ReportsModule, InventoryModule, JwtModule.register({})],
  controllers: [OwnerCopilotController],
  providers: [
    OwnerCopilotService, LocalDemoOwnerCopilotProvider, GeminiOwnerCopilotProvider, JwtAuthGuard, RolesGuard,
    {
      provide: OWNER_COPILOT_PROVIDER,
      inject: [LocalDemoOwnerCopilotProvider, GeminiOwnerCopilotProvider],
      useFactory: (local: LocalDemoOwnerCopilotProvider, gemini: GeminiOwnerCopilotProvider) =>
        process.env.OWNER_COPILOT_PROVIDER === 'gemini' && gemini.isConfigured ? gemini : local,
    },
  ],
})
export class OwnerCopilotModule {}
