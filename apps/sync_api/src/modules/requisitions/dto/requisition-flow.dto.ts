import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class ApproveItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(0)
  quantityApproved: number;
}

/** Owner / Admin. Inventario. Omitted items are approved as requested. */
export class ApproveRequisitionDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApproveItemDto)
  items?: ApproveItemDto[];

  /** Required when any approved quantity differs from the requested one. */
  @IsOptional()
  @IsString()
  notes?: string;

  /** Suggested origin warehouse; Bodega may change it when dispatching. */
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class ReasonDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class DispatchItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(0)
  quantity: number;
}

/** Almacén y Bodega. Omitted items are dispatched at the approved quantity. */
export class DispatchRequisitionDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DispatchItemDto)
  items?: DispatchItemDto[];

  /** Required when any dispatched quantity differs from the approved one. */
  @IsOptional()
  @IsString()
  notes?: string;
}

export class DeliverRequisitionDto {
  /** Required when Owner / Admin. Inventario marks the delivery on Bodega's behalf. */
  @IsOptional()
  @IsString()
  notes?: string;
}
