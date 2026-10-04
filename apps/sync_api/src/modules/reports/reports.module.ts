import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { JwtModule } from '@nestjs/jwt';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [ReportsController],
  providers: [ReportsService, AdminGuard, JwtAuthGuard, RolesGuard],
  exports: [ReportsService],
})
export class ReportsModule {}
