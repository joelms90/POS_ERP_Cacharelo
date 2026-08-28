import { Injectable } from '@nestjs/common';
import * as schema from '../../database/schema';
import { eq, and } from 'drizzle-orm';

export interface LedgerMovementInput {
  businessId: string;
  productId: string;
  quantityDelta: number; // positivo = entrada, negativo = salida
  eventType: string; // receipt | sale | production_input | production_output | transfer_out | transfer_in | adjustment | initial
  warehouseId?: string | null;
  branchId?: string | null;
  unitCost?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  documentNumber?: string | null;
  notes?: string | null;
  lotNumber?: string | null;
  expirationDate?: Date | null;
  createdById?: string | null;
}

/**
 * LedgerService is the single choke point that writes inventory.
 *
 * It applies an immutable `stock_ledger` row (the source of truth) and keeps the
 * `stock_levels` read model in sync inside the SAME transaction. Business logic
 * must never write `stock_levels` or `inventory_movements` directly.
 */
@Injectable()
export class LedgerService {
  /**
   * Apply one movement: append a ledger row and update the stock_levels read model.
   * Must be called inside an active database transaction (`tx`).
   */
  async applyMovement(tx: any, input: LedgerMovementInput) {
    const {
      businessId,
      productId,
      quantityDelta,
      eventType,
      warehouseId = null,
      branchId = null,
      unitCost = null,
      referenceType = null,
      referenceId = null,
      documentNumber = null,
      notes = null,
      lotNumber = null,
      expirationDate = null,
      createdById = null,
    } = input;

    if (!warehouseId && !branchId) {
      throw new Error(
        'LedgerService.applyMovement requires a location (warehouseId or branchId).',
      );
    }

    // 1. Append the immutable ledger row (source of truth).
    await tx.insert(schema.stockLedger).values({
      businessId,
      productId,
      branchId,
      warehouseId,
      quantityDelta: quantityDelta.toString(),
      eventType,
      unitCost: unitCost ?? null,
      referenceType: referenceType ?? null,
      referenceId: referenceId ?? null,
      documentNumber: documentNumber ?? null,
      notes: notes ?? null,
      lotNumber: lotNumber ?? null,
      expirationDate: expirationDate ?? null,
      createdById: createdById ?? null,
    });

    // 2. Update the stock_levels read model (kept in sync with the ledger).
    const conditions = [eq(schema.stockLevels.productId, productId)];
    if (warehouseId) {
      conditions.push(eq(schema.stockLevels.warehouseId, warehouseId));
    } else {
      conditions.push(eq(schema.stockLevels.branchId, branchId!));
    }

    const [existing] = await tx
      .select()
      .from(schema.stockLevels)
      .where(and(...conditions))
      .limit(1);

    if (existing) {
      const currentQty = parseFloat(existing.quantity || '0');
      const newQty = (currentQty + quantityDelta).toString();
      await tx
        .update(schema.stockLevels)
        .set({ quantity: newQty, updatedAt: new Date() })
        .where(eq(schema.stockLevels.id, existing.id));
    } else {
      await tx.insert(schema.stockLevels).values({
        productId,
        warehouseId: warehouseId ?? null,
        branchId: branchId ?? null,
        quantity: quantityDelta.toString(),
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Read the current on-hand quantity for a product at a location.
   * Must be called inside an active database transaction (`tx`).
   */
  async getStockLevel(
    tx: any,
    productId: string,
    warehouseId?: string | null,
    branchId?: string | null,
  ): Promise<number> {
    const conditions = [eq(schema.stockLevels.productId, productId)];
    if (warehouseId) {
      conditions.push(eq(schema.stockLevels.warehouseId, warehouseId));
    } else if (branchId) {
      conditions.push(eq(schema.stockLevels.branchId, branchId));
    } else {
      return 0;
    }

    const [stock] = await tx
      .select()
      .from(schema.stockLevels)
      .where(and(...conditions))
      .limit(1);

    return stock ? parseFloat(stock.quantity || '0') : 0;
  }
}
