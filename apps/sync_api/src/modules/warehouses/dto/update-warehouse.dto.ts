import { IsString, Length, IsOptional, IsIn } from 'class-validator';

export class UpdateWarehouseDto {
  @IsString()
  @IsOptional()
  @Length(2, 100)
  name?: string;

  @IsString()
  @IsOptional()
  @Length(2, 30)
  code?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  @IsIn(['warehouse', 'factory', 'transit'])
  locationType?: string;
}
