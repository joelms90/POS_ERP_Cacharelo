import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryRepository } from './repositories/inventory.repository';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { CreateProductionRunDto } from './dto/create-production-run.dto';
import * as schema from '../../database/schema';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class InventoryService {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async getStockLevels(businessId: string, warehouseId?: string, branchId?: string) {
    return this.inventoryRepository.getStockLevels(businessId, warehouseId, branchId);
  }

  async getReceipts(businessId: string) {
    return this.inventoryRepository.getReceipts(businessId);
  }

  async recordReceipt(createReceiptDto: CreateReceiptDto) {
    const { businessId, providerId, branchId, warehouseId, documentNumber, notes, items } = createReceiptDto;

    // 1. Validation
    if (!branchId && !warehouseId) {
      throw new BadRequestException('Debe especificar un destino (Sucursal o Bodega) para el ingreso.');
    }
    if (branchId && warehouseId) {
      throw new BadRequestException('No puede ingresar inventario a una Sucursal y una Bodega al mismo tiempo.');
    }

    const db = this.inventoryRepository.getDb();

    // Verify provider exists
    const matchProvider = await db
      .select()
      .from(schema.providers)
      .where(eq(schema.providers.id, providerId))
      .limit(1);

    if (matchProvider.length === 0) {
      throw new NotFoundException(`Proveedor con ID ${providerId} no encontrado`);
    }

    // 2. Transaction execution
    return db.transaction(async (tx) => {
      // Create receipt document
      const [receipt] = await tx
        .insert(schema.inventoryReceipts)
        .values({
          businessId,
          providerId,
          branchId: branchId || null,
          warehouseId: warehouseId || null,
          documentNumber: documentNumber || null,
          notes: notes || null,
        })
        .returning();

      // Process items and stock levels
      const savedItems = [];
      for (const item of items) {
        const totalCost = (item.quantity * item.unitCost).toFixed(2);
        
        // Insert item record
        const [savedItem] = await tx
          .insert(schema.inventoryReceiptItems)
          .values({
            receiptId: receipt.id,
            productId: item.productId,
            quantity: item.quantity.toString(),
            unitCost: item.unitCost.toString(),
            totalCost,
          })
          .returning();

        savedItems.push(savedItem);

        // Update Stock levels
        const conditions = [eq(schema.stockLevels.productId, item.productId)];
        if (warehouseId) {
          conditions.push(eq(schema.stockLevels.warehouseId, warehouseId));
        } else {
          conditions.push(eq(schema.stockLevels.branchId, branchId!));
        }

        const matchStock = await tx
          .select()
          .from(schema.stockLevels)
          .where(and(...conditions))
          .limit(1);

        if (matchStock.length > 0) {
          const currentQty = parseFloat(matchStock[0].quantity);
          const newQty = (currentQty + item.quantity).toString();
          
          await tx
            .update(schema.stockLevels)
            .set({
              quantity: newQty,
              updatedAt: new Date(),
            })
            .where(eq(schema.stockLevels.id, matchStock[0].id));
        } else {
          await tx
            .insert(schema.stockLevels)
            .values({
              productId: item.productId,
              warehouseId: warehouseId || null,
              branchId: branchId || null,
              quantity: item.quantity.toString(),
              updatedAt: new Date(),
            });
        }
      }

      return {
        success: true,
        receiptId: receipt.id,
        itemsProcessed: savedItems.length,
      };
    });
  }

  async getProductionRuns(businessId: string) {
    return this.inventoryRepository.getProductionRuns(businessId);
  }

  async assembleProduct(createProductionRunDto: CreateProductionRunDto) {
    const { warehouseId, productId, quantityProduced, notes } = createProductionRunDto;
    const db = this.inventoryRepository.getDb();

    // 1. Fetch the recipe components for this assembled product
    const recipe = await db
      .select({
        id: schema.recipes.id,
        parentProductId: schema.recipes.parentProductId,
        ingredientProductId: schema.recipes.ingredientProductId,
        quantityNeeded: schema.recipes.quantityNeeded,
        ingredientName: schema.products.name,
      })
      .from(schema.recipes)
      .innerJoin(schema.products, eq(schema.recipes.ingredientProductId, schema.products.id))
      .where(eq(schema.recipes.parentProductId, productId));

    if (recipe.length === 0) {
      throw new BadRequestException('El producto seleccionado no tiene una receta configurada (ingredientes).');
    }

    // 2. Perform BOM validation: check stock levels for each ingredient in the warehouse
    for (const item of recipe) {
      const requiredQty = parseFloat(item.quantityNeeded) * quantityProduced;

      // Find stock level for the ingredient in this warehouse
      const [stock] = await db
        .select()
        .from(schema.stockLevels)
        .where(
          and(
            eq(schema.stockLevels.productId, item.ingredientProductId),
            eq(schema.stockLevels.warehouseId, warehouseId),
          ),
        )
        .limit(1);

      const availableQty = stock ? parseFloat(stock.quantity) : 0;
      if (availableQty < requiredQty) {
        throw new BadRequestException(
          `Stock insuficiente para el ingrediente "${item.ingredientName}". Requerido: ${requiredQty.toFixed(3)}, Disponible: ${availableQty.toFixed(3)}`,
        );
      }
    }

    // 3. Execute transaction: decrement ingredients stock, increment parent stock, log run
    return db.transaction(async (tx) => {
      // Decrement ingredient stocks
      for (const item of recipe) {
        const decrementQty = parseFloat(item.quantityNeeded) * quantityProduced;

        // Fetch current stock row inside transaction
        const [stock] = await tx
          .select()
          .from(schema.stockLevels)
          .where(
            and(
              eq(schema.stockLevels.productId, item.ingredientProductId),
              eq(schema.stockLevels.warehouseId, warehouseId),
            ),
          )
          .limit(1);

        const newQty = (parseFloat(stock.quantity) - decrementQty).toString();
        await tx
          .update(schema.stockLevels)
          .set({
            quantity: newQty,
            updatedAt: new Date(),
          })
          .where(eq(schema.stockLevels.id, stock.id));
      }

      // Increment parent stock
      const [parentStock] = await tx
        .select()
        .from(schema.stockLevels)
        .where(
          and(
            eq(schema.stockLevels.productId, productId),
            eq(schema.stockLevels.warehouseId, warehouseId),
          ),
        )
        .limit(1);

      if (parentStock) {
        const newQty = (parseFloat(parentStock.quantity) + quantityProduced).toString();
        await tx
          .update(schema.stockLevels)
          .set({
            quantity: newQty,
            updatedAt: new Date(),
          })
          .where(eq(schema.stockLevels.id, parentStock.id));
      } else {
        await tx
          .insert(schema.stockLevels)
          .values({
            productId,
            warehouseId,
            quantity: quantityProduced.toString(),
            updatedAt: new Date(),
          });
      }

      // Insert production run record
      const [run] = await tx
        .insert(schema.productionRuns)
        .values({
          warehouseId,
          productId,
          quantityProduced: quantityProduced.toString(),
          notes: notes || null,
        })
        .returning();

      return {
        success: true,
        productionRunId: run.id,
      };
    });
  }
}
