import { ArrayMinSize, ArrayUnique, IsArray, IsString, IsEmail, IsOptional, Length, IsUUID, IsEnum, Matches } from 'class-validator';
import type { UserRole } from '../../auth/roles';

export const USER_ROLES = ['waiter', 'cashier', 'kitchen', 'admin', 'vendedor', 'encargado', 'empleado', 'owner', 'inventory_admin'] as const;

export class CreateUserDto {
  @IsUUID()
  @IsOptional() // Nullable for system admins
  businessId?: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsString()
  @Length(2, 100)
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @Length(6, 100)
  password?: string;

  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'PIN must consist of exactly 4 digits' })
  pin: string;

  @IsEnum(USER_ROLES, {
    message: 'Role must be one of: waiter, cashier, kitchen, admin, vendedor, owner, inventory_admin',
  })
  @IsOptional()
  role?: UserRole;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one role must be selected' })
  @ArrayUnique()
  @IsEnum(USER_ROLES, {
    each: true,
    message: 'Roles must contain only: waiter, cashier, kitchen, admin, vendedor, owner, inventory_admin',
  })
  @IsOptional()
  roles?: UserRole[];
}
