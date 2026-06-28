import { IsString, IsEmail, IsOptional, Length, IsEnum, Matches, IsUUID } from 'class-validator';

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

  @IsEnum(['waiter', 'cashier', 'kitchen', 'admin'], {
    message: 'Role must be one of: waiter, cashier, kitchen, admin',
  })
  @IsOptional()
  role?: 'waiter' | 'cashier' | 'kitchen' | 'admin';
}
