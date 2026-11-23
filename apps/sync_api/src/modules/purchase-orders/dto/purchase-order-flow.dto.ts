import { ArrayMinSize, IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PoReasonDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

/** Almacén y Compras: bought, on the way to the warehouse. */
export class MarkPurchasedDto {
  @IsOptional()
  @IsString()
  notes?: string;

  /** Ticket / invoice / supplier folio. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  documentNumber?: string;
}

export class ReceiveLineDto {
  @IsUUID()
  productId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantityReceived: number;

  /** Price actually paid per unit. */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCostActual: number;
}

/** Entrada: one count per line. Any difference in quantity or price needs `notes`. */
export class ReceivePurchaseOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  items: ReceiveLineDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  documentNumber?: string;
}
