import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdatePrintJobStatusDto {
  @IsIn(['queued', 'printing', 'printed', 'failed'])
  status: 'queued' | 'printing' | 'printed' | 'failed';

  @IsOptional()
  @IsString()
  error?: string;
}
