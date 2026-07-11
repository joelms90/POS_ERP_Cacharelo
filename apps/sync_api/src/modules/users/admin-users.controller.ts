import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OWNER_ROLE } from '../auth/roles';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

@Controller('admin-users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(OWNER_ROLE)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(@Query('businessId') businessId: string) {
    return this.usersService.findBusinessAdmins(businessId);
  }

  @Post()
  async create(@Body() createAdminUserDto: CreateAdminUserDto) {
    return this.usersService.createBusinessAdmin(createAdminUserDto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateAdminUserDto: UpdateAdminUserDto) {
    return this.usersService.updateBusinessAdmin(id, updateAdminUserDto);
  }

  @Post(':id/reset-password')
  async resetPassword(@Param('id') id: string, @Body('password') password: string) {
    return this.usersService.updateBusinessAdmin(id, { password });
  }

  @Delete(':id')
  async deactivate(@Param('id') id: string, @Req() request: any) {
    return this.usersService.deactivateBusinessAdmin(id, request.user?.sub);
  }
}
