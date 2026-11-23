import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseOrderItemDto } from './create-purchase-order.dto';

/** Drafts only. `items`, when sent, replaces every line. */
export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  orderNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items?: PurchaseOrderItemDto[];
}
