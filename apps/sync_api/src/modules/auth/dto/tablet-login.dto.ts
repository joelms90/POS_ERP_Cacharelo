import { IsString, Length, Matches, IsUUID, IsOptional } from 'class-validator';

export class TabletLoginDto {
  @IsUUID()
  businessId: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'PIN must consist of exactly 4 digits' })
  pin: string;

  @IsString()
  @Length(1, 255)
  deviceId: string;
}
