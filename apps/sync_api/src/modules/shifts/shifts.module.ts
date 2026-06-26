import { Module } from '@nestjs/common';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { ShiftsRepository } from './repositories/shifts.repository';
import { TransactionsRepository } from './repositories/transactions.repository';

@Module({
  controllers: [ShiftsController],
  providers: [ShiftsService, ShiftsRepository, TransactionsRepository],
  exports: [ShiftsService, ShiftsRepository, TransactionsRepository],
})
export class ShiftsModule {}
