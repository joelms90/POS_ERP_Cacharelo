import { IsNotEmpty, IsUUID, IsNumber, IsArray, ValidateNested, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class RecipeItemDto {
  @IsUUID()
  @IsNotEmpty()
  ingredientProductId: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0.001)
  quantityNeeded: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  wastePercent?: number;
}

export class SetRecipeDto {
  @IsUUID()
  @IsNotEmpty()
  parentProductId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeItemDto)
  items: RecipeItemDto[];
}
