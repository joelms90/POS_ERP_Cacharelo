import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class RecipesRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByParentProductId(parentProductId: string) {
    return this.db
      .select({
        id: schema.recipes.id,
        parentProductId: schema.recipes.parentProductId,
        ingredientProductId: schema.recipes.ingredientProductId,
        quantityNeeded: schema.recipes.quantityNeeded,
        ingredientName: schema.products.name,
        ingredientSku: schema.products.sku,
      })
      .from(schema.recipes)
      .innerJoin(schema.products, eq(schema.recipes.ingredientProductId, schema.products.id))
      .where(eq(schema.recipes.parentProductId, parentProductId));
  }

  async setRecipe(parentProductId: string, items: { ingredientProductId: string; quantityNeeded: string }[]) {
    return this.db.transaction(async (tx) => {
      // 1. Clear old recipe ingredients
      await tx
        .delete(schema.recipes)
        .where(eq(schema.recipes.parentProductId, parentProductId));

      // 2. Insert new ones if provided
      if (items.length > 0) {
        await tx.insert(schema.recipes).values(
          items.map((item) => ({
            parentProductId,
            ingredientProductId: item.ingredientProductId,
            quantityNeeded: item.quantityNeeded,
          })),
        );
      }

      return { success: true };
    });
  }
}
