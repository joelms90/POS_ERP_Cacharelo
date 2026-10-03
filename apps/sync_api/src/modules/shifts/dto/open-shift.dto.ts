import { IsUUID, IsNotEmpty, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

export class OpenShiftDto {
  @IsUUID()
  @IsOptional()
  cashierId?: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsNumberString()
  @IsNotEmpty()
  initialFloat: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  shiftType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}
