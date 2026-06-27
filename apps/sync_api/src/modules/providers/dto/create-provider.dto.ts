import { IsString, IsNotEmpty, Length, IsOptional, IsUUID, IsEmail } from 'class-validator';

export class CreateProviderDto {
  @IsUUID()
  @IsNotEmpty()
  businessId: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @IsString()
  @IsOptional()
  @Length(2, 100)
  contactName?: string;

  @IsString()
  @IsOptional()
  @Length(5, 20)
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;
}
