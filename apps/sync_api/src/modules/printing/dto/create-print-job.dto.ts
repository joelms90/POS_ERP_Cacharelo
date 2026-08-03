import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePrintJobDto {
  @IsString()
  @MaxLength(120)
  id: string;

  @IsUUID()
  branchId: string;

  @IsString()
  @MaxLength(120)
  targetStationId: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceUserName?: string;

  @IsString()
  @MaxLength(180)
  title: string;

  @IsString()
  details: string;

  @IsString()
  @MaxLength(50)
  target: string;

  @IsOptional()
  @IsString()
  createdAt?: string;

  // Accepted for older clients. The repository still stores new jobs as queued.
  @IsOptional()
  @IsString()
  @IsIn(['queued'])
  status?: 'queued';
}
