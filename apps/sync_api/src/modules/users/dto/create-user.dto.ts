import { IsString, IsEmail, IsOptional, Length, IsUUID, IsEnum, Matches } from 'class-validator';

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

  @IsEnum(['waiter', 'cashier', 'kitchen', 'admin'], {
    message: 'Role must be one of: waiter, cashier, kitchen, admin',
  })
  role: 'waiter' | 'cashier' | 'kitchen' | 'admin';
}
