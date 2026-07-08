import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './repositories/users.repository';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService, UsersRepository, JwtAuthGuard, RolesGuard, AdminGuard],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
