import { Module } from '@nestjs/common';
import { KitchenController } from './kitchen.controller';
import { KitchenService } from './kitchen.service';
import { KitchenRepository } from './repositories/kitchen.repository';

@Module({
  controllers: [KitchenController],
  providers: [KitchenService, KitchenRepository],
  exports: [KitchenService, KitchenRepository],
})
export class KitchenModule {}
