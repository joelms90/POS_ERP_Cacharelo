import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryRepository } from './repositories/inventory.repository';
import { LedgerService } from './ledger.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { CreateProductionRunDto } from './dto/create-production-run.dto';
import { CompleteProductionRunDto } from './dto/complete-production-run.dto';
import * as schema from '../../database/schema';
import { eq, and, gte, lte, sql, desc, inArray } from 'drizzle-orm';

@Injectable()
export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly ledgerService: LedgerService,
  ) {}

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

        // Record stock movement through the ledger (updates read model + audit)
        await this.ledgerService.applyMovement(tx, {
          businessId,
          productId: item.productId,
          quantityDelta: item.quantity,
          eventType: 'receipt',
          warehouseId: warehouseId || null,
          branchId: branchId || null,
          unitCost: item.unitCost?.toString() ?? null,
          referenceType: 'receipt',
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
    const {
      warehouseId,
      destinationWarehouseId,
      productId,
      quantityProduced,
      status = 'completed',
      notes,
    } = createProductionRunDto;
    const db = this.inventoryRepository.getDb();
    const destWarehouseId = destinationWarehouseId || warehouseId;

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

    // If creating a planned / pending OP:
    if (status === 'pending') {
      const [run] = await db
        .insert(schema.productionRuns)
        .values({
          warehouseId,
          destinationWarehouseId: destWarehouseId,
          productId,
          quantityProduced: quantityProduced.toString(),
          status: 'pending',
          assembledAt: null,
          notes: notes || null,
        })
        .returning();

      return {
        success: true,
        productionRunId: run.id,
        status: 'pending',
      };
    }

    // Otherwise, direct / immediate assembly (status === 'completed'):
    // Perform BOM validation: check stock levels for each ingredient in the origin warehouse
    for (const item of recipe) {
      const requiredQty = parseFloat(item.quantityNeeded) * quantityProduced;

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

    // Execute transaction: decrement ingredients stock, increment parent stock in destination warehouse, log run
    return db.transaction(async (tx) => {
      const [run] = await tx
        .insert(schema.productionRuns)
        .values({
          warehouseId,
          destinationWarehouseId: destWarehouseId,
          productId,
          quantityProduced: quantityProduced.toString(),
          actualQuantityProduced: quantityProduced.toString(),
          status: 'completed',
          assembledAt: new Date(),
          notes: notes || null,
        })
        .returning();

      // Record output movement (assembled product entry in destination warehouse)
      await this.ledgerService.applyMovement(tx, {
        businessId,
        productId,
        quantityDelta: quantityProduced,
        eventType: 'production_output',
        warehouseId: destWarehouseId,
        referenceType: 'production_run',
        referenceId: run.id,
        notes: notes || null,
      });

      // Record input movements (ingredients deduction from origin warehouse)
      for (const item of recipe) {
        const decrementQty = parseFloat(item.quantityNeeded) * quantityProduced;
        await this.ledgerService.applyMovement(tx, {
          businessId,
          productId: item.ingredientProductId,
          quantityDelta: -decrementQty,
          eventType: 'production_input',
          warehouseId,
          referenceType: 'production_run',
          referenceId: run.id,
          notes: `Insumo consumido en receta para ensamble de ${product.name}`,
        });
      }

      return {
        success: true,
        productionRunId: run.id,
        status: 'completed',
      };
    });
  }

  async startProductionRun(id: string) {
    const db = this.inventoryRepository.getDb();
    const [run] = await db
      .select()
      .from(schema.productionRuns)
      .where(eq(schema.productionRuns.id, id))
      .limit(1);

    if (!run) {
      throw new NotFoundException(`Orden de producción con ID ${id} no encontrada`);
    }

    if (run.status !== 'pending') {
      throw new BadRequestException(`Solo se pueden iniciar órdenes en estado pendiente (Estado actual: ${run.status})`);
    }

    await db
      .update(schema.productionRuns)
      .set({
        status: 'in_progress',
        startedAt: new Date(),
      })
      .where(eq(schema.productionRuns.id, id));

    return {
      success: true,
      productionRunId: id,
      status: 'in_progress',
    };
  }

  async completeProductionRun(id: string, completeDto: CompleteProductionRunDto) {
    const db = this.inventoryRepository.getDb();
    const [run] = await db
      .select()
      .from(schema.productionRuns)
      .where(eq(schema.productionRuns.id, id))
      .limit(1);

    if (!run) {
      throw new NotFoundException(`Orden de producción con ID ${id} no encontrada`);
    }

    if (run.status === 'completed') {
      throw new BadRequestException('Esta orden de producción ya fue completada.');
    }
    if (run.status === 'cancelled') {
      throw new BadRequestException('Esta orden de producción fue cancelada y no puede completarse.');
    }

    const actualQuantity = completeDto.actualQuantityProduced ?? parseFloat(run.quantityProduced);
    const destWarehouseId = completeDto.destinationWarehouseId || run.destinationWarehouseId || run.warehouseId;

    // 1. Fetch recipe
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
      .where(eq(schema.recipes.parentProductId, run.productId));

    if (recipe.length === 0) {
      throw new BadRequestException('El producto no tiene una receta configurada.');
    }

    // 2. Validate ingredient stock in origin warehouse
    for (const item of recipe) {
      const requiredQty = parseFloat(item.quantityNeeded) * actualQuantity;
      const [stock] = await db
        .select()
        .from(schema.stockLevels)
        .where(
          and(
            eq(schema.stockLevels.productId, item.ingredientProductId),
            eq(schema.stockLevels.warehouseId, run.warehouseId),
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

    // 3. Fetch product for businessId & name
    const [product] = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, run.productId))
      .limit(1);

    const businessId = product.businessId;

    // 4. Transaction: ledger movements & status update
    return db.transaction(async (tx) => {
      // Update OP record
      await tx
        .update(schema.productionRuns)
        .set({
          status: 'completed',
          actualQuantityProduced: actualQuantity.toString(),
          destinationWarehouseId: destWarehouseId,
          assembledAt: new Date(),
          notes: completeDto.notes || run.notes,
        })
        .where(eq(schema.productionRuns.id, id));

      // Record output movement (entry of finished goods into destination warehouse)
      await this.ledgerService.applyMovement(tx, {
        businessId,
        productId: run.productId,
        quantityDelta: actualQuantity,
        eventType: 'production_output',
        warehouseId: destWarehouseId,
        referenceType: 'production_run',
        referenceId: run.id,
        notes: completeDto.notes || run.notes || null,
      });

      // Record input movements (deduction of raw materials from origin warehouse)
      for (const item of recipe) {
        const decrementQty = parseFloat(item.quantityNeeded) * actualQuantity;
        await this.ledgerService.applyMovement(tx, {
          businessId,
          productId: item.ingredientProductId,
          quantityDelta: -decrementQty,
          eventType: 'production_input',
          warehouseId: run.warehouseId,
          referenceType: 'production_run',
          referenceId: run.id,
          notes: `Insumo consumido en OP para ensamble de ${product.name}`,
        });
      }

      return {
        success: true,
        productionRunId: id,
        status: 'completed',
      };
    });
  }

  async cancelProductionRun(id: string) {
    const db = this.inventoryRepository.getDb();
    const [run] = await db
      .select()
      .from(schema.productionRuns)
      .where(eq(schema.productionRuns.id, id))
      .limit(1);

    if (!run) {
      throw new NotFoundException(`Orden de producción con ID ${id} no encontrada`);
    }

    if (run.status === 'completed') {
      throw new BadRequestException('No se puede cancelar una orden de producción ya completada.');
    }

    await db
      .update(schema.productionRuns)
      .set({
        status: 'cancelled',
      })
      .where(eq(schema.productionRuns.id, id));

    return {
      success: true,
      productionRunId: id,
      status: 'cancelled',
    };
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

    // Attach item counts
    const transferIds = transfers.map((t) => t.id);
    const itemCounts = await db
      .select({
        transferId: schema.stockTransferItems.transferId,
        itemCount: sql<number>`count(*)::int`,
      })
      .from(schema.stockTransferItems)
      .where(inArray(schema.stockTransferItems.transferId, transferIds))
      .groupBy(schema.stockTransferItems.transferId);

    const countMap = new Map(itemCounts.map((c) => [c.transferId, Number(c.itemCount)]));

    return transfers.map(t => ({
      ...t,
      itemCount: countMap.get(t.id) || 0,
      fromWarehouseName: t.fromWarehouseId ? whMap.get(t.fromWarehouseId) : null,
      fromBranchName: t.fromBranchId ? brMap.get(t.fromBranchId) : null,
      toWarehouseName: t.toWarehouseId ? whMap.get(t.toWarehouseId) : null,
      toBranchName: t.toBranchId ? brMap.get(t.toBranchId) : null,
    }));
  }

  async getTransfer(transferId: string) {
    const db = this.inventoryRepository.getDb();

    const [transfer] = await db
      .select()
      .from(schema.stockTransfers)
      .where(eq(schema.stockTransfers.id, transferId))
      .limit(1);

    if (!transfer) {
      throw new NotFoundException(`Traspaso con ID ${transferId} no encontrado`);
    }

    const items = await db
      .select({
        id: schema.stockTransferItems.id,
        productId: schema.stockTransferItems.productId,
        quantity: schema.stockTransferItems.quantity,
        unitCost: schema.stockTransferItems.unitCost,
        totalCost: schema.stockTransferItems.totalCost,
        productName: schema.products.name,
        itemType: schema.products.itemType,
        providerId: schema.products.providerId,
      })
      .from(schema.stockTransferItems)
      .innerJoin(schema.products, eq(schema.stockTransferItems.productId, schema.products.id))
      .where(eq(schema.stockTransferItems.transferId, transferId));

    // Origin stock availability for each item (for the "Falta" indication)
    const itemProductIds = items.map((i) => i.productId);
    let originStockMap = new Map<string, number>();
    if (itemProductIds.length > 0) {
      const originCond = [
        inArray(schema.stockLevels.productId, itemProductIds),
      ];
      if (transfer.fromWarehouseId) {
        originCond.push(eq(schema.stockLevels.warehouseId, transfer.fromWarehouseId));
      } else if (transfer.fromBranchId) {
        originCond.push(eq(schema.stockLevels.branchId, transfer.fromBranchId));
      }
      const stockRows = await db
        .select({
          productId: schema.stockLevels.productId,
          quantity: schema.stockLevels.quantity,
        })
        .from(schema.stockLevels)
        .where(and(...originCond));
      for (const r of stockRows) {
        originStockMap.set(r.productId, parseFloat(r.quantity || '0'));
      }
    }

    const itemsWithStock = items.map((i) => ({
      ...i,
      availableQty: originStockMap.get(i.productId) ?? 0,
    }));

    const warehouses = await db
      .select()
      .from(schema.warehouses)
      .where(eq(schema.warehouses.businessId, transfer.businessId));
    const branches = await db
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.businessId, transfer.businessId));

    const whMap = new Map(warehouses.map((w) => [w.id, w.name]));
    const brMap = new Map(branches.map((b) => [b.id, b.name]));

    return {
      ...transfer,
      fromWarehouseName: transfer.fromWarehouseId ? whMap.get(transfer.fromWarehouseId) : null,
      fromBranchName: transfer.fromBranchId ? brMap.get(transfer.fromBranchId) : null,
      toWarehouseName: transfer.toWarehouseId ? whMap.get(transfer.toWarehouseId) : null,
      toBranchName: transfer.toBranchId ? brMap.get(transfer.toBranchId) : null,
      items: itemsWithStock,
    };
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
      // 1. Create the transfer order as "pending" (stock moves only when shipped)
      const [transfer] = await tx
        .insert(schema.stockTransfers)
        .values({
          businessId,
          fromWarehouseId: fromWarehouseId || null,
          fromBranchId: fromBranchId || null,
          toWarehouseId: toWarehouseId || null,
          toBranchId: toBranchId || null,
          notes: notes || null,
          status: 'pending',
        })
        .returning();

      // 2. Record transfer item details (no stock movement yet)
      for (const item of items) {
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

        await tx
          .insert(schema.stockTransferItems)
          .values({
            transferId: transfer.id,
            productId: item.productId,
            quantity: item.quantity.toString(),
            unitCost,
            totalCost,
          });
      }

      return {
        success: true,
        transferId: transfer.id,
        status: 'pending',
      };
    });
  }

  async receiveTransfer(transferId: string) {
    const db = this.inventoryRepository.getDb();

    return db.transaction(async (tx) => {
      const [transfer] = await tx
        .select()
        .from(schema.stockTransfers)
        .where(eq(schema.stockTransfers.id, transferId))
        .limit(1);

      if (!transfer) {
        throw new NotFoundException(`Traspaso con ID ${transferId} no encontrado`);
      }

      if (transfer.status !== 'in_transit') {
        throw new BadRequestException(
          `El traspaso no se puede recibir en estado "${transfer.status}".`,
        );
      }

      const transitWh = await this.getOrCreateTransitWarehouse(tx, transfer.businessId);

      const items = await tx
        .select()
        .from(schema.stockTransferItems)
        .where(eq(schema.stockTransferItems.transferId, transferId));

      for (const item of items) {
        await this.ledgerService.applyMovement(tx, {
          businessId: transfer.businessId,
          productId: item.productId,
          quantityDelta: -parseFloat(item.quantity),
          eventType: 'transit_out',
          warehouseId: transitWh.id,
          unitCost: item.unitCost,
          referenceType: 'transfer',
          referenceId: transferId,
          notes: 'Sale de tránsito',
        });

        await this.ledgerService.applyMovement(tx, {
          businessId: transfer.businessId,
          productId: item.productId,
          quantityDelta: parseFloat(item.quantity),
          eventType: 'transfer_in',
          warehouseId: transfer.toWarehouseId || null,
          branchId: transfer.toBranchId || null,
          unitCost: item.unitCost,
          referenceType: 'transfer',
          referenceId: transferId,
          notes: 'Traspaso recibido',
        });
      }

      const [updated] = await tx
        .update(schema.stockTransfers)
        .set({ status: 'received', transferredAt: new Date() })
        .where(eq(schema.stockTransfers.id, transferId))
        .returning();

      return { success: true, transferId, status: updated.status };
    });
  }

  async shipTransfer(transferId: string, options?: { adjustToAvailable?: boolean }) {
    const db = this.inventoryRepository.getDb();
    const adjustToAvailable = options?.adjustToAvailable === true;

    return db.transaction(async (tx) => {
      const [transfer] = await tx
        .select()
        .from(schema.stockTransfers)
        .where(eq(schema.stockTransfers.id, transferId))
        .limit(1);

      if (!transfer) {
        throw new NotFoundException(`Traspaso con ID ${transferId} no encontrado`);
      }

      if (transfer.status !== 'pending') {
        throw new BadRequestException(
          `El traspaso no se puede enviar en estado "${transfer.status}".`,
        );
      }

      const transitWh = await this.getOrCreateTransitWarehouse(tx, transfer.businessId);

      const items = await tx
        .select()
        .from(schema.stockTransferItems)
        .where(eq(schema.stockTransferItems.transferId, transferId));

      for (const item of items) {
        const sourceStock = await this.ledgerService.getStockLevel(
          tx,
          item.productId,
          transfer.fromWarehouseId || null,
          transfer.fromBranchId || null,
        );

        const qty = parseFloat(item.quantity);
        let shipQty = qty;

        if (sourceStock < qty) {
          if (!adjustToAvailable) {
            throw new BadRequestException('Stock insuficiente en origen para el traspaso.');
          }
          shipQty = Math.max(0, sourceStock);
        }

        if (shipQty <= 0) continue;

        // If adjusting, update the item quantity to what we can actually ship
        if (adjustToAvailable && shipQty !== qty) {
          await tx
            .update(schema.stockTransferItems)
            .set({ quantity: shipQty.toString(), totalCost: (parseFloat(item.unitCost || '0') * shipQty).toFixed(2) })
            .where(eq(schema.stockTransferItems.id, item.id));
        }

        await this.ledgerService.applyMovement(tx, {
          businessId: transfer.businessId,
          productId: item.productId,
          quantityDelta: -shipQty,
          eventType: 'transfer_out',
          warehouseId: transfer.fromWarehouseId || null,
          branchId: transfer.fromBranchId || null,
          unitCost: item.unitCost,
          referenceType: 'transfer',
          referenceId: transferId,
          notes: 'Traspaso enviado',
        });

        await this.ledgerService.applyMovement(tx, {
          businessId: transfer.businessId,
          productId: item.productId,
          quantityDelta: shipQty,
          eventType: 'transit_in',
          warehouseId: transitWh.id,
          unitCost: item.unitCost,
          referenceType: 'transfer',
          referenceId: transferId,
          notes: 'En tránsito',
        });
      }

      const [updated] = await tx
        .update(schema.stockTransfers)
        .set({ status: 'in_transit', transferredAt: new Date() })
        .where(eq(schema.stockTransfers.id, transferId))
        .returning();

      return { success: true, transferId, status: updated.status };
    });
  }

  private async getOrCreateTransitWarehouse(tx: any, businessId: string) {
    const [existing] = await tx
      .select()
      .from(schema.warehouses)
      .where(
        and(
          eq(schema.warehouses.businessId, businessId),
          eq(schema.warehouses.locationType, 'transit'),
        ),
      )
      .limit(1);

    if (existing) return existing;

    const [created] = await tx
      .insert(schema.warehouses)
      .values({
        businessId,
        name: 'En Tránsito',
        code: 'TRANSIT',
        locationType: 'transit',
        isActive: false,
      })
      .returning();

    return created;
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
      if (diff !== 0) {
        await this.ledgerService.applyMovement(tx, {
          businessId: product.businessId,
          productId,
          quantityDelta: diff,
          eventType: 'adjustment',
          warehouseId: warehouseId || null,
          branchId: branchId || null,
          notes: `Ajuste manual de stock (anterior: ${oldQty}, nuevo: ${quantity})`,
        });
      }
    });

    return { success: true };
  }

  async processPurchaseOrderReception(
    poId: string,
    items: Array<{
      productId: string;
      quantityReceived: number;
      unitCostActual: number;
    }>,
    notes?: string,
  ) {
    const db = this.inventoryRepository.getDb();

    const [po] = await db
      .select()
      .from(schema.purchaseOrders)
      .where(eq(schema.purchaseOrders.id, poId))
      .limit(1);

    if (!po) {
      throw new NotFoundException(`Purchase Order with ID ${poId} not found`);
    }

    const destinationWarehouseId = po.warehouseId;
    const destinationBranchId = po.branchId;
    const businessId = po.businessId;

    if (!destinationWarehouseId && !destinationBranchId) {
      throw new BadRequestException('La orden de compra no especifica una bodega o sucursal de destino');
    }

    return db.transaction(async (tx) => {
      for (const item of items) {
        // 1. Update purchase order item actuals
        await tx
          .update(schema.purchaseOrderItems)
          .set({
            quantityReceived: item.quantityReceived.toString(),
            unitCostActual: item.unitCostActual.toString(),
          })
          .where(
            and(
              eq(schema.purchaseOrderItems.poId, poId),
              eq(schema.purchaseOrderItems.productId, item.productId),
            ),
          );

        // 2. Recalculate average cost
        const [product] = await tx
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, item.productId))
          .limit(1);

        if (!product) {
          throw new NotFoundException(`Producto con ID ${item.productId} no encontrado`);
        }

        const currentCost = parseFloat(product.cost || '0');

        // Sum current stock across all locations of this business
        const allStocks = await tx
          .select({ quantity: schema.stockLevels.quantity })
          .from(schema.stockLevels)
          .leftJoin(schema.warehouses, eq(schema.stockLevels.warehouseId, schema.warehouses.id))
          .leftJoin(schema.branches, eq(schema.stockLevels.branchId, schema.branches.id))
          .where(
            and(
              eq(schema.stockLevels.productId, item.productId),
              sql`(${schema.warehouses.businessId} = ${businessId} OR ${schema.branches.businessId} = ${businessId})`,
            ),
          );

        const currentStock = allStocks.reduce((acc, curr) => acc + parseFloat(curr.quantity || '0'), 0);
        const totalQty = currentStock + item.quantityReceived;

        let newCost = item.unitCostActual;
        if (currentStock > 0 && totalQty > 0) {
          newCost = (currentStock * currentCost + item.quantityReceived * item.unitCostActual) / totalQty;
        } else {
          newCost = item.unitCostActual;
        }

        newCost = Math.round(newCost * 100) / 100;

        await tx
          .update(schema.products)
          .set({
            cost: newCost.toString(),
            updatedAt: new Date(),
          })
          .where(eq(schema.products.id, item.productId));

        // 3. Update stock levels at destination (via ledger)
        await this.ledgerService.applyMovement(tx, {
          businessId,
          productId: item.productId,
          quantityDelta: item.quantityReceived,
          eventType: 'receipt',
          warehouseId: destinationWarehouseId || null,
          branchId: destinationBranchId || null,
          unitCost: item.unitCostActual.toString(),
          referenceType: 'purchase_order',
          referenceId: poId,
          documentNumber: po.poNumber,
          notes: notes || `Recepción de Orden de Compra ${po.poNumber}`,
        });
      }

      // 5. Update PO status
      const allPoItems = await tx
        .select()
        .from(schema.purchaseOrderItems)
        .where(eq(schema.purchaseOrderItems.poId, poId));

      let allFullyReceived = true;
      let someReceived = false;

      for (const poItem of allPoItems) {
        const ordered = parseFloat(poItem.quantityOrdered);
        const received = parseFloat(poItem.quantityReceived || '0');
        if (received < ordered) {
          allFullyReceived = false;
        }
        if (received > 0) {
          someReceived = true;
        }
      }

      const finalStatus = allFullyReceived
        ? 'received'
        : someReceived
          ? 'partially_received'
          : 'sent';

      const [updatedPo] = await tx
        .update(schema.purchaseOrders)
        .set({
          status: finalStatus,
          actualDeliveryDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.purchaseOrders.id, poId))
        .returning();

      return {
        success: true,
        status: finalStatus,
        purchaseOrder: updatedPo,
      };
    });
  }
}
