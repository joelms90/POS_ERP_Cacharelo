import { IsString, IsOptional } from 'class-validator';

export class PullSyncDto {
  @IsString()
  @IsOptional()
  lastSyncedAt?: string; // ISO-8601 Timestamp

  @IsString()
  @IsOptional()
  deviceId?: string;

  @IsString()
  @IsOptional()
  branchId?: string;
}
