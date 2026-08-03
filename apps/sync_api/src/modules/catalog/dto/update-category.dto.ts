import { IsString, Length, IsOptional } from 'class-validator';

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  @Length(2, 100)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  targetStation?: string;
}
