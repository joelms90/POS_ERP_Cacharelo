import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { JwtModule } from '@nestjs/jwt';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [ReportsController],
  providers: [ReportsService, AdminGuard],
  exports: [ReportsService],
})
export class ReportsModule {}
