import { IsString, Length } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;

  @IsString()
  @Length(1, 255)
  deviceId: string;
}
