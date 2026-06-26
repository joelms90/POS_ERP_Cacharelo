import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { SyncModule } from './modules/sync/sync.module';

@Module({
  imports: [DatabaseModule, UsersModule, AuthModule, SyncModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
