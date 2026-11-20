import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AdminGuard } from '../auth/guards/admin.guard';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { ServerErrorsInterceptor } from './server-errors.interceptor';

@Module({
  imports: [JwtModule.register({})],
  controllers: [LogsController],
  providers: [
    LogsService,
    AdminGuard,
    { provide: APP_INTERCEPTOR, useClass: ServerErrorsInterceptor },
  ],
  exports: [LogsService],
})
export class LogsModule {}
