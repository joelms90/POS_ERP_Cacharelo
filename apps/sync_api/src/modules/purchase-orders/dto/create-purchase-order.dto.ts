import { IsString, IsNotEmpty, IsUUID, IsOptional, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseOrderItemDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0.01)
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

  @IsUUID()
  @IsNotEmpty()
  createdBy: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}
