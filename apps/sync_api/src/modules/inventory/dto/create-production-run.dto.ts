import { IsString, IsNotEmpty, IsOptional, IsUUID, IsNumber, Min } from 'class-validator';

export class CreateProductionRunDto {
  @IsUUID()
  @IsNotEmpty()
  warehouseId: string;

  @IsUUID()
  @IsOptional()
  destinationWarehouseId?: string;

  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0.001)
  quantityProduced: number;

  @IsString()
  @IsOptional()
  status?: 'pending' | 'completed';

  @IsString()
  @IsOptional()
  notes?: string;
}

