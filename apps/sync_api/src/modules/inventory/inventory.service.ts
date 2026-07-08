import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryRepository } from './repositories/inventory.repository';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { CreateProductionRunDto } from './dto/create-production-run.dto';
import * as schema from '../../database/schema';
import { eq, and, gte, lte, sql, desc, inArray } from 'drizzle-orm';

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

        // Record stock movement
        await tx.insert(schema.inventoryMovements).values({
          businessId,
          productId: item.productId,
          warehouseId: warehouseId || null,
          branchId: branchId || null,
          quantity: item.quantity.toString(),
          type: 'receipt',
          referenceId: receipt.id,
          documentNumber: documentNumber || null,
          notes: notes || null,
        });
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

    // Fetch product to resolve businessId
    const [product] = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Producto con ID ${productId} no encontrado`);
    }
    const businessId = product.businessId;

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

      // Record output movement (assembled product entry)
      await tx.insert(schema.inventoryMovements).values({
        businessId,
        productId,
        warehouseId,
        quantity: quantityProduced.toString(),
        type: 'production_output',
        referenceId: run.id,
        notes: notes || null,
      });

      // Record input movements (ingredients deduction)
      for (const item of recipe) {
        const decrementQty = parseFloat(item.quantityNeeded) * quantityProduced;
        await tx.insert(schema.inventoryMovements).values({
          businessId,
          productId: item.ingredientProductId,
          warehouseId,
          quantity: (-decrementQty).toString(),
          type: 'production_input',
          referenceId: run.id,
          notes: `Insumo consumido en receta para ensamble de ${product.name}`,
        });
      }

      return {
        success: true,
        productionRunId: run.id,
      };
    });
  }

  async getTransfers(businessId: string) {
    const db = this.inventoryRepository.getDb();
    
    const transfers = await db
      .select()
      .from(schema.stockTransfers)
      .where(eq(schema.stockTransfers.businessId, businessId))
      .orderBy(desc(schema.stockTransfers.transferredAt));

    const warehouses = await db
      .select()
      .from(schema.warehouses)
      .where(eq(schema.warehouses.businessId, businessId));

    const branches = await db
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.businessId, businessId));

    const whMap = new Map(warehouses.map(w => [w.id, w.name]));
    const brMap = new Map(branches.map(b => [b.id, b.name]));

    return transfers.map(t => ({
      ...t,
      fromWarehouseName: t.fromWarehouseId ? whMap.get(t.fromWarehouseId) : null,
      fromBranchName: t.fromBranchId ? brMap.get(t.fromBranchId) : null,
      toWarehouseName: t.toWarehouseId ? whMap.get(t.toWarehouseId) : null,
      toBranchName: t.toBranchId ? brMap.get(t.toBranchId) : null,
    }));
  }

  async recordTransfer(dto: any) {
    const { businessId, fromWarehouseId, fromBranchId, toWarehouseId, toBranchId, notes, items } = dto;

    if (!fromWarehouseId && !fromBranchId) {
      throw new BadRequestException('Debe especificar un origen (Bodega o Sucursal).');
    }
    if (!toWarehouseId && !toBranchId) {
      throw new BadRequestException('Debe especificar un destino (Bodega o Sucursal).');
    }

    const db = this.inventoryRepository.getDb();

    return db.transaction(async (tx) => {
      // 1. Create the transfer record
      const [transfer] = await tx
        .insert(schema.stockTransfers)
        .values({
          businessId,
          fromWarehouseId: fromWarehouseId || null,
          fromBranchId: fromBranchId || null,
          toWarehouseId: toWarehouseId || null,
          toBranchId: toBranchId || null,
          notes: notes || null,
          status: 'completed',
        })
        .returning();

      // 2. Process items
      for (const item of items) {
        // Find product to get the current cost
        const [product] = await tx
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, item.productId))
          .limit(1);

        if (!product) {
          throw new NotFoundException(`Producto con ID ${item.productId} no encontrado`);
        }

        const unitCost = product.cost;
        const totalCost = (parseFloat(unitCost) * item.quantity).toFixed(2);

        // A. Decrement stock from source
        const sourceCond = [eq(schema.stockLevels.productId, item.productId)];
        if (fromWarehouseId) {
          sourceCond.push(eq(schema.stockLevels.warehouseId, fromWarehouseId));
        } else {
          sourceCond.push(eq(schema.stockLevels.branchId, fromBranchId));
        }

        const [sourceStock] = await tx
          .select()
          .from(schema.stockLevels)
          .where(and(...sourceCond))
          .limit(1);

        if (!sourceStock || parseFloat(sourceStock.quantity) < item.quantity) {
          throw new BadRequestException(`Stock insuficiente en origen para el producto ${product.name}`);
        }

        const newSourceQty = (parseFloat(sourceStock.quantity) - item.quantity).toString();
        await tx
          .update(schema.stockLevels)
          .set({
            quantity: newSourceQty,
            updatedAt: new Date(),
          })
          .where(eq(schema.stockLevels.id, sourceStock.id));

        // B. Increment stock at destination
        const destCond = [eq(schema.stockLevels.productId, item.productId)];
        if (toWarehouseId) {
          destCond.push(eq(schema.stockLevels.warehouseId, toWarehouseId));
        } else {
          destCond.push(eq(schema.stockLevels.branchId, toBranchId));
        }

        const [destStock] = await tx
          .select()
          .from(schema.stockLevels)
          .where(and(...destCond))
          .limit(1);

        if (destStock) {
          const newDestQty = (parseFloat(destStock.quantity) + item.quantity).toString();
          await tx
            .update(schema.stockLevels)
            .set({
              quantity: newDestQty,
              updatedAt: new Date(),
            })
            .where(eq(schema.stockLevels.id, destStock.id));
        } else {
          await tx
            .insert(schema.stockLevels)
            .values({
              productId: item.productId,
              warehouseId: toWarehouseId || null,
              branchId: toBranchId || null,
              quantity: item.quantity.toString(),
              updatedAt: new Date(),
            });
        }

        // C. Record transfer item details
        await tx
          .insert(schema.stockTransferItems)
          .values({
            transferId: transfer.id,
            productId: item.productId,
            quantity: item.quantity.toString(),
            unitCost,
            totalCost,
          });

        // Record stock movements
        await tx.insert(schema.inventoryMovements).values({
          businessId,
          productId: item.productId,
          warehouseId: fromWarehouseId || null,
          branchId: fromBranchId || null,
          quantity: (-item.quantity).toString(),
          type: 'transfer_out',
          referenceId: transfer.id,
          notes: `Traspaso enviado`,
        });

        await tx.insert(schema.inventoryMovements).values({
          businessId,
          productId: item.productId,
          warehouseId: toWarehouseId || null,
          branchId: toBranchId || null,
          quantity: item.quantity.toString(),
          type: 'transfer_in',
          referenceId: transfer.id,
          notes: `Traspaso recibido`,
        });
      }

      return {
        success: true,
        transferId: transfer.id,
      };
    });
  }

  async getTransfersSummaryReport(businessId: string, startDate?: string, endDate?: string) {
    const db = this.inventoryRepository.getDb();
    
    const conditions = [
      eq(schema.stockTransfers.businessId, businessId),
      sql`${schema.stockTransfers.toBranchId} is not null`
    ];

    if (startDate) {
      conditions.push(gte(schema.stockTransfers.transferredAt, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(schema.stockTransfers.transferredAt, new Date(endDate)));
    }

    const transfers = await db
      .select({
        id: schema.stockTransfers.id,
        toBranchId: schema.stockTransfers.toBranchId,
      })
      .from(schema.stockTransfers)
      .where(and(...conditions));

    if (transfers.length === 0) {
      return [];
    }

    const transferIds = transfers.map(t => t.id);

    // Sum costs of transfer items
    const items = await db
      .select({
        transferId: schema.stockTransferItems.transferId,
        totalCost: schema.stockTransferItems.totalCost,
      })
      .from(schema.stockTransferItems)
      .where(inArray(schema.stockTransferItems.transferId, transferIds));

    // Map branch names
    const branches = await db
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.businessId, businessId));
    const brMap = new Map(branches.map(b => [b.id, b.name]));

    // Group and sum
    const branchTotals = new Map<string, number>();
    for (const t of transfers) {
      const branchId = t.toBranchId!;
      const branchItems = items.filter(i => i.transferId === t.id);
      const sum = branchItems.reduce((acc, curr) => acc + parseFloat(curr.totalCost), 0);
      branchTotals.set(branchId, (branchTotals.get(branchId) || 0) + sum);
    }

    return Array.from(branchTotals.entries()).map(([branchId, totalCost]) => ({
      branchId,
      branchName: brMap.get(branchId) || 'Sucursal Desconocida',
      totalCost: totalCost.toFixed(2),
    }));
  }

  async getTransfersDetailedReport(businessId: string, branchId: string, startDate?: string, endDate?: string) {
    const db = this.inventoryRepository.getDb();

    const conditions = [
      eq(schema.stockTransfers.businessId, businessId),
      eq(schema.stockTransfers.toBranchId, branchId),
    ];

    if (startDate) {
      conditions.push(gte(schema.stockTransfers.transferredAt, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(schema.stockTransfers.transferredAt, new Date(endDate)));
    }

    const transfers = await db
      .select({
        id: schema.stockTransfers.id,
      })
      .from(schema.stockTransfers)
      .where(and(...conditions));

    if (transfers.length === 0) {
      return [];
    }

    const transferIds = transfers.map(t => t.id);

    // Get item totals grouped by product
    const items = await db
      .select({
        productId: schema.stockTransferItems.productId,
        quantity: schema.stockTransferItems.quantity,
        totalCost: schema.stockTransferItems.totalCost,
      })
      .from(schema.stockTransferItems)
      .where(inArray(schema.stockTransferItems.transferId, transferIds));

    // Join with product names
    const products = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.businessId, businessId));
    const prodMap = new Map(products.map(p => [p.id, p]));

    const productTotals = new Map<string, { quantity: number; totalCost: number }>();
    for (const item of items) {
      const current = productTotals.get(item.productId) || { quantity: 0, totalCost: 0 };
      productTotals.set(item.productId, {
        quantity: current.quantity + parseFloat(item.quantity),
        totalCost: current.totalCost + parseFloat(item.totalCost),
      });
    }

    return Array.from(productTotals.entries()).map(([productId, totals]) => {
      const p = prodMap.get(productId);
      return {
        productId,
        productName: p ? p.name : 'Producto Desconocido',
        sku: p ? p.sku : null,
        internalCode: p ? p.internalCode : null,
        totalQuantity: totals.quantity,
        totalCost: totals.totalCost.toFixed(2),
      };
    });
  }

  async adjustStock(body: { productId: string; warehouseId?: string; branchId?: string; quantity: number }) {
    const { productId, warehouseId, branchId, quantity } = body;
    const db = this.inventoryRepository.getDb();

    // Fetch product to resolve businessId
    const [product] = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Producto con ID ${productId} no encontrado`);
    }

    const conditions = [eq(schema.stockLevels.productId, productId)];
    if (warehouseId) {
      conditions.push(eq(schema.stockLevels.warehouseId, warehouseId));
    } else if (branchId) {
      conditions.push(eq(schema.stockLevels.branchId, branchId));
    } else {
      throw new BadRequestException('Debe especificar un almacén o sucursal.');
    }

    const [existing] = await db
      .select()
      .from(schema.stockLevels)
      .where(and(...conditions))
      .limit(1);

    const oldQty = existing ? parseFloat(existing.quantity) : 0;
    const diff = quantity - oldQty;

    await db.transaction(async (tx) => {
      if (existing) {
        await tx
          .update(schema.stockLevels)
          .set({
            quantity: quantity.toString(),
            updatedAt: new Date(),
          })
          .where(eq(schema.stockLevels.id, existing.id));
      } else {
        await tx
          .insert(schema.stockLevels)
          .values({
            productId,
            warehouseId: warehouseId || null,
            branchId: branchId || null,
            quantity: quantity.toString(),
            updatedAt: new Date(),
          });
      }

      if (diff !== 0) {
        await tx.insert(schema.inventoryMovements).values({
          businessId: product.businessId,
          productId,
          warehouseId: warehouseId || null,
          branchId: branchId || null,
          quantity: diff.toString(),
          type: 'adjustment',
          notes: `Ajuste manual de stock (anterior: ${oldQty}, nuevo: ${quantity})`,
        });
      }
    });

    return { success: true };
  }
}
