import { IsString, IsNotEmpty } from 'class-validator';

export class AckSyncDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsNotEmpty()
  lastSyncedAt: string; // ISO-8601 Timestamp
}
