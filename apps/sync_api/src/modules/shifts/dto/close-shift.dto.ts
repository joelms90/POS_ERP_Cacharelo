import { IsString, IsNotEmpty, IsNumberString, IsOptional } from 'class-validator';

export class CloseShiftDto {
  @IsNumberString()
  @IsNotEmpty()
  actualAmount: string;

  @IsString()
  @IsOptional()
  closedAt?: string;
}
