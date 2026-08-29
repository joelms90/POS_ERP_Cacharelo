import { IsString, IsOptional, IsUUID, IsNumber, Min } from 'class-validator';

export class CompleteProductionRunDto {
  @IsNumber()
  @IsOptional()
  @Min(0.001)
  actualQuantityProduced?: number;

  @IsUUID()
  @IsOptional()
  destinationWarehouseId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
