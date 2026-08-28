import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { RecipesRepository } from './repositories/recipes.repository';
import { SetRecipeDto } from './dto/set-recipe.dto';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';
import { eq, inArray } from 'drizzle-orm';

@Injectable()
export class RecipesService {
  constructor(
    private readonly recipesRepository: RecipesRepository,
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByParentProductId(parentProductId: string) {
    return this.recipesRepository.findByParentProductId(parentProductId);
  }

  async setRecipe(setRecipeDto: SetRecipeDto) {
    const { parentProductId, items } = setRecipeDto;

    // BOM validation: parent must be FinishedGood or Wip
    const [parent] = await this.db
      .select({ id: schema.products.id, itemType: schema.products.itemType })
      .from(schema.products)
      .where(eq(schema.products.id, parentProductId))
      .limit(1);

    if (!parent) {
      throw new NotFoundException('El producto padre no existe.');
    }

    const parentItemType = parent.itemType || 'finished_good';
    if (parentItemType !== 'finished_good' && parentItemType !== 'wip') {
      throw new BadRequestException(
        'Solo productos "Terminado" o "En Proceso (WIP)" pueden tener una receta/BOM.',
      );
    }

    if (items.length === 0) {
      return this.recipesRepository.setRecipe(parentProductId, []);
    }

    const ingredientIds = items.map((i) => i.ingredientProductId);
    if (ingredientIds.includes(parentProductId)) {
      throw new BadRequestException('Un producto no puede ser su propio componente.');
    }

    const components = await this.db
      .select({ id: schema.products.id, itemType: schema.products.itemType, name: schema.products.name })
      .from(schema.products)
      .where(inArray(schema.products.id, ingredientIds));

    const componentMap = new Map(components.map((c) => [c.id, c]));

    const formattedItems = items.map((item) => {
      const component = componentMap.get(item.ingredientProductId);
      if (!component) {
        throw new NotFoundException(`Ingrediente con ID ${item.ingredientProductId} no existe.`);
      }
      if ((component.itemType || 'raw_material') === 'service') {
        throw new BadRequestException(`El componente "${component.name}" es un servicio y no puede usarse en una receta.`);
      }
      const waste = item.wastePercent ?? 0;
      if (waste < 0 || waste > 100) {
        throw new BadRequestException('El porcentaje de merma debe estar entre 0 y 100.');
      }
      return {
        ingredientProductId: item.ingredientProductId,
        quantityNeeded: item.quantityNeeded.toFixed(3),
        wastePercent: waste.toFixed(2),
      };
    });

    return this.recipesRepository.setRecipe(parentProductId, formattedItems);
  }
}
