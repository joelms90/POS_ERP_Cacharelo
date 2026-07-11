import { IsArray, IsEmail, IsEnum, IsOptional, IsString, IsUUID, Length, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { AdminRole } from '../../auth/roles';

export class AdminBusinessAccessDto {
  @IsUUID()
  businessId: string;

  @IsEnum(['owner', 'inventory_admin'], {
    message: 'Role must be one of: owner, inventory_admin',
  })
  role: AdminRole;
}

export class CreateAdminUserDto {
  @IsUUID()
  businessId: string;

  @IsString()
  @Length(2, 100)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 100)
  password: string;

  @IsString()
  @IsOptional()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'PIN must consist of exactly 4 digits' })
  pin?: string;

  @IsEnum(['owner', 'inventory_admin'], {
    message: 'Role must be one of: owner, inventory_admin',
  })
  role: AdminRole;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdminBusinessAccessDto)
  businessAccess?: AdminBusinessAccessDto[];
}
