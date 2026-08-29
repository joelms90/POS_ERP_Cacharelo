import { Module, forwardRef } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { BranchesRepository } from './repositories/branches.repository';
import { DatabaseModule } from '../../database/database.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => SyncModule)],
  controllers: [BranchesController],
  providers: [BranchesService, BranchesRepository],
  exports: [BranchesService, BranchesRepository],
})
export class BranchesModule {}
