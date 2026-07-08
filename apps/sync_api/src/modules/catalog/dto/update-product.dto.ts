import { IsString, Length, IsOptional, IsUUID, IsNumberString, IsBoolean } from 'class-validator';

export class UpdateProductDto {
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  @Length(2, 150)
  name?: string;

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

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  internalCode?: string;

  @IsNumberString()
  @IsOptional()
  priceWholesale?: string;

  @IsNumberString()
  @IsOptional()
  minStock?: string;

  @IsNumberString()
  @IsOptional()
  maxStock?: string;

  @IsString()
  @IsOptional()
  saleType?: string;
}
