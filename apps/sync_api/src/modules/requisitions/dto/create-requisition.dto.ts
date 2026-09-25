import { IsString, IsNotEmpty, IsUUID, IsOptional, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RequisitionItemDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0.01)
  quantityRequested: number;
}

export class CreateRequisitionDto {
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsUUID()
  @IsNotEmpty()
  businessId: string;

  @IsUUID()
  @IsNotEmpty()
  fromBranchId: string;

  @IsUUID()
  @IsNotEmpty()
  toWarehouseId: string;

  @IsUUID()
  @IsNotEmpty()
  createdBy: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequisitionItemDto)
  items: RequisitionItemDto[];
}
