import {
  IsObject,
  IsString,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CloseShiftDto {
  @IsNumberString()
  @IsNotEmpty()
  actualAmount: string;

  @IsString()
  @IsOptional()
  closedAt?: string;

  @IsObject()
  @IsOptional()
  denominationCounts?: Record<string, number>;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  closeNotes?: string;

  @IsNumberString()
  @IsOptional()
  nextShiftFloat?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  receivedBy?: string;
}
