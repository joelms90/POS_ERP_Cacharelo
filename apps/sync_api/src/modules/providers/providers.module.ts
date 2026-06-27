import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { ProvidersRepository } from './repositories/providers.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [ProvidersController],
  providers: [
    ProvidersService,
    ProvidersRepository,
  ],
  exports: [ProvidersRepository],
})
export class ProvidersModule {}
