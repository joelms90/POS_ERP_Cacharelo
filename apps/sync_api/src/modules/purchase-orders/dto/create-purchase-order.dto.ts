import { ArrayMinSize, IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseOrderItemDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsNumber()
  @Min(0)
  estimatedUnitCost: number;
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  @IsNotEmpty()
  businessId: string;

  @IsUUID()
  @IsNotEmpty()
  providerId: string;

  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;

  @IsString()
  @IsNotEmpty()
  orderNumber: string;

  @IsString()
  @IsOptional()
  notes?: string;

  /** Ignored: the creator comes from the signed login. Kept for older clients. */
  @IsUUID()
  @IsOptional()
  createdBy?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}
