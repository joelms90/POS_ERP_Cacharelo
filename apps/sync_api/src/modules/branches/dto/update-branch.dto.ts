import { IsString, IsOptional, Length } from 'class-validator';

export class UpdateBranchDto {
  @IsString()
  @IsOptional()
  @Length(2, 100)
  name?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  @Length(5, 20)
  phone?: string;

  @IsString()
  @IsOptional()
  roomConfigs?: string;
}
