import { IsString, Length, Matches, IsUUID } from 'class-validator';

export class TabletLoginDto {
  @IsUUID()
  businessId: string;

  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, { message: 'PIN must consist of exactly 4 digits' })
  pin: string;

  @IsString()
  @Length(1, 255)
  deviceId: string;
}
