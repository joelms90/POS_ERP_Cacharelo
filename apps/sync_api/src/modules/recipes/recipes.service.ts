import { Injectable } from '@nestjs/common';
import { RecipesRepository } from './repositories/recipes.repository';
import { SetRecipeDto } from './dto/set-recipe.dto';

@Injectable()
export class RecipesService {
  constructor(private readonly recipesRepository: RecipesRepository) {}

  async findByParentProductId(parentProductId: string) {
    return this.recipesRepository.findByParentProductId(parentProductId);
  }

  async setRecipe(setRecipeDto: SetRecipeDto) {
    const formattedItems = setRecipeDto.items.map((item) => ({
      ingredientProductId: item.ingredientProductId,
      quantityNeeded: item.quantityNeeded.toFixed(3),
    }));

    return this.recipesRepository.setRecipe(setRecipeDto.parentProductId, formattedItems);
  }
}
