import { Module, forwardRef } from '@nestjs/common';
import { SyncModule } from '../sync/sync.module';
import { PrintingController } from './printing.controller';
import { PrintingService } from './printing.service';
import { PrintingRepository } from './repositories/printing.repository';

@Module({
  imports: [forwardRef(() => SyncModule)],
  controllers: [PrintingController],
  providers: [PrintingService, PrintingRepository],
  exports: [PrintingService, PrintingRepository],
})
export class PrintingModule {}
