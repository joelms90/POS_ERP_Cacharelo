import { IsString, Length, IsOptional, IsUUID, IsNumberString } from 'class-validator';

export class UpdateSupplierProductDto {
  @IsUUID()
  @IsOptional()
  productId?: string;

  @IsUUID()
  @IsOptional()
  providerId?: string;

  @IsString()
  @IsOptional()
  @Length(2, 150)
  providerProductName?: string;

  @IsString()
  @IsOptional()
  providerSku?: string;

  @IsNumberString()
  @IsOptional()
  cost?: string;

  @IsNumberString()
  @IsOptional()
  conversionFactor?: string;
}
