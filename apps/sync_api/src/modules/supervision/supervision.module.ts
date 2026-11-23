import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ShiftsModule } from '../shifts/shifts.module';
import { ApprovalsService } from './approvals.service';
import { NotificationsController } from './notifications.controller';
import { SupervisionController } from './supervision.controller';

@Module({
  imports: [JwtModule.register({}), ShiftsModule],
  controllers: [SupervisionController, NotificationsController],
  providers: [ApprovalsService, JwtAuthGuard, RolesGuard],
  exports: [ApprovalsService],
})
export class SupervisionModule {}
