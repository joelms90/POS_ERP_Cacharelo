import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RequisitionsController } from './requisitions.controller';
import { RequisitionsService } from './requisitions.service';
import { RequisitionsRepository } from './repositories/requisitions.repository';

import { JwtModule } from '@nestjs/jwt';
import { InventoryModule } from '../inventory/inventory.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [DatabaseModule, JwtModule.register({}), InventoryModule],
  controllers: [RequisitionsController],
  providers: [
    RequisitionsService,
    RequisitionsRepository,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [RequisitionsRepository],
})
export class RequisitionsModule {}
