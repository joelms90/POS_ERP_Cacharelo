import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class ApproveDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RejectDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class AdjustShiftDto extends RejectDto {
  @IsNumberString()
  approvedAmount: string;

  @IsOptional()
  @IsObject()
  denominationCounts?: Record<string, number>;
}

export class AdjustMovementDto extends RejectDto {
  @IsNumberString()
  amount: string;
}

export class ReasonDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class AssignmentsDto {
  @IsUUID()
  businessId: string;

  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  branchIds: string[];
}

export class ImpactQueryDto {
  @IsIn(['reject', 'cancel', 'adjust'])
  action: 'reject' | 'cancel' | 'adjust';

  @IsOptional()
  @IsNumberString()
  amount?: string;
}
