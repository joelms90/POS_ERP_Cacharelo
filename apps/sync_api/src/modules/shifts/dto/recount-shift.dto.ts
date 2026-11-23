import {
  IsNotEmpty,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** New physical count after a Corte Z rejection (spec 019 CZ-02 / CZ-04). */
export class RecountShiftDto {
  @IsNumberString()
  @IsNotEmpty()
  actualAmount: string;

  @IsObject()
  @IsOptional()
  denominationCounts?: Record<string, number>;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}
