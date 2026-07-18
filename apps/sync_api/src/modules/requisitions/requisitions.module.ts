import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RequisitionsController } from './requisitions.controller';
import { RequisitionsService } from './requisitions.service';
import { RequisitionsRepository } from './repositories/requisitions.repository';

import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
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
