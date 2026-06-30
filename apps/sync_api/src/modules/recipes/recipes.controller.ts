import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { SetRecipeDto } from './dto/set-recipe.dto';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  async getRecipe(@Query('productId') productId: string) {
    return this.recipesService.findByParentProductId(productId);
  }

  @Post()
  async setRecipe(@Body() setRecipeDto: SetRecipeDto) {
    return this.recipesService.setRecipe(setRecipeDto);
  }
}
