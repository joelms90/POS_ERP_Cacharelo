import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class PrintStationHeartbeatDto {
  @IsString()
  @MaxLength(120)
  stationId: string;

  @IsUUID()
  branchId: string;

  @IsString()
  @MaxLength(120)
  deviceName: string;

  @IsString()
  @MaxLength(30)
  role: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  operatorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  operatorName?: string;

  @IsString()
  @MaxLength(180)
  printerName: string;

  @IsOptional()
  @IsBoolean()
  canPrintComandas?: boolean;

  // Accepted for older clients. The server uses its own receipt time.
  @IsOptional()
  @IsString()
  lastSeenAt?: string;
}
