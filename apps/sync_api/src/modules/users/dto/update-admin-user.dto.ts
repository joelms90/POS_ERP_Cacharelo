import { IsArray, IsEmail, IsEnum, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { AdminRole } from '../../auth/roles';
import { AdminBusinessAccessDto } from './create-admin-user.dto';

export class UpdateAdminUserDto {
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

  @IsEnum(['owner', 'inventory_admin'], {
    message: 'Role must be one of: owner, inventory_admin',
  })
  @IsOptional()
  role?: AdminRole;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdminBusinessAccessDto)
  businessAccess?: AdminBusinessAccessDto[];
}
