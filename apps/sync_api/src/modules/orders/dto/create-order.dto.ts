import { IsUUID, IsNotEmpty, IsNumberString, IsArray, IsOptional, ValidateNested, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsString()
  @IsOptional()
  clientUuid?: string;

  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumberString()
  @IsNotEmpty()
  price: string;

  @IsInt()
  @IsOptional()
  assignedGuest?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateOrderDto {
  @IsString()
  @IsOptional()
  clientUuid?: string;

  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @IsUUID()
  @IsNotEmpty()
  tableId: string;

  @IsUUID()
  @IsNotEmpty()
  waiterId: string;

  @IsNumberString()
  @IsNotEmpty()
  subtotal: string;

  @IsNumberString()
  @IsOptional()
  discount?: string;

  @IsNumberString()
  @IsOptional()
  tax?: string;

  @IsNumberString()
  @IsNotEmpty()
  total: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
