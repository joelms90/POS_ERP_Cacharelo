import { IsString, IsNotEmpty, Length, IsOptional, IsUUID, IsNumberString, IsBoolean } from 'class-validator';

export class CreateProductDto {
  @IsUUID()
  @IsNotEmpty()
  businessId: string;

  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  name: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsUUID()
  @IsOptional()
  providerId?: string;

  @IsNumberString()
  @IsOptional()
  cost?: string;

  @IsNumberString()
  @IsOptional()
  price?: string;

  @IsBoolean()
  @IsOptional()
  isSellable?: boolean;

  @IsBoolean()
  @IsOptional()
  isIngredient?: boolean;
}
