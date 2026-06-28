import { IsString, IsNotEmpty, Length, IsOptional, IsUUID } from 'class-validator';

export class CreateWarehouseDto {
  @IsUUID()
  @IsNotEmpty()
  businessId: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @IsString()
  @IsOptional()
  @Length(2, 30)
  code?: string;

  @IsString()
  @IsOptional()
  address?: string;
}
