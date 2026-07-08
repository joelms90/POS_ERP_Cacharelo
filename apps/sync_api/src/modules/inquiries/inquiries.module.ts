import { Module } from '@nestjs/common';
import { InquiriesController } from './inquiries.controller';
import { InquiriesService } from './inquiries.service';
import { JwtModule } from '@nestjs/jwt';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [InquiriesController],
  providers: [InquiriesService, AdminGuard],
  exports: [InquiriesService],
})
export class InquiriesModule {}
