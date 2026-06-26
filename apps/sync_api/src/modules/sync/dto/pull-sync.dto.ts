import { IsString, IsOptional } from 'class-validator';

export class PullSyncDto {
  @IsString()
  @IsOptional()
  lastSyncedAt?: string; // ISO-8601 Timestamp
}
