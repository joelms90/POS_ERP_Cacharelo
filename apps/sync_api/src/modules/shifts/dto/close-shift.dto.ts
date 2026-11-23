import {
  IsBoolean,
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

  /** Client-generated id of the close (idempotent retries / offline sync, D-5). */
  @IsString()
  @IsOptional()
  @MaxLength(120)
  clientUuid?: string;

  @IsBoolean()
  @IsOptional()
  closedOffline?: boolean;

  /** Expected cash the POS computed locally when it closed offline. */
  @IsNumberString()
  @IsOptional()
  localExpectedCash?: string;
}
