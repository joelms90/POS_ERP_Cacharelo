import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryRepository } from './repositories/inventory.repository';
import { CreateReceiptDto } from './dto/create-receipt.dto';
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
}
