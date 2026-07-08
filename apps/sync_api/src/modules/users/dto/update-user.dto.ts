import { IsString, IsEmail, IsOptional, Length, IsEnum, Matches, IsUUID } from 'class-validator';
import type { UserRole } from '../../auth/roles';
import { USER_ROLES } from './create-user.dto';

export class UpdateUserDto {
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  @Length(2, 100)
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @Length(6, 100)
  password?: string;

  @IsString()
  @IsOptional()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'PIN must consist of exactly 4 digits' })
  pin?: string;

  @IsEnum(USER_ROLES, {
    message: 'Role must be one of: waiter, cashier, kitchen, admin, vendedor, owner, inventory_admin',
  })
  @IsOptional()
  role?: UserRole;
}
