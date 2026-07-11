import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { TicketSettingsController } from './ticket-settings.controller';
import { TicketSettingsService } from './ticket-settings.service';

@Module({
  imports: [DatabaseModule],
  controllers: [TicketSettingsController],
  providers: [TicketSettingsService],
  exports: [TicketSettingsService],
})
export class TicketSettingsModule {}
