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

  // Accepted temporarily for offline clients built before the branch-operator
  // workflow. The server ignores both fields and derives scope from the JWT.
  @IsUUID()
  @IsOptional()
  businessId?: string;

  @IsUUID()
  @IsOptional()
  fromBranchId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequisitionItemDto)
  items: RequisitionItemDto[];
}
