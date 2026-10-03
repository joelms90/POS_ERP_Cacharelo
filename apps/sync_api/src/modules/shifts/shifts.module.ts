import { Module } from '@nestjs/common';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { ShiftsRepository } from './repositories/shifts.repository';
import { TransactionsRepository } from './repositories/transactions.repository';

import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [ShiftsController],
  providers: [ShiftsService, ShiftsRepository, TransactionsRepository, JwtAuthGuard, RolesGuard],
  exports: [ShiftsService, ShiftsRepository, TransactionsRepository],
})
export class ShiftsModule {}
