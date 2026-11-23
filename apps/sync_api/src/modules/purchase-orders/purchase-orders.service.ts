import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomUUID } from 'crypto';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { AuditLogService } from '../audit/audit-log.service';
import { assertBusinessAccess } from '../auth/business-access';
import { InventoryService } from '../inventory/inventory.service';
import { actorSource, primaryRole, qty, sameQty } from '../requisitions/requisition-flow';
import { CreatePurchaseOrderDto, PurchaseOrderItemDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { MarkPurchasedDto, PoReasonDto, ReceivePurchaseOrderDto } from './dto/purchase-order-flow.dto';
import {
  CANCELLABLE_STATUSES,
  CAN_MARK_PURCHASED_STATUSES,
  HIDDEN_FROM_WAREHOUSE_PO_STATUSES,
  PO_STATUS,
  PURCHASING_STATUSES,
  RECEIVABLE_STATUSES,
  isPoManager,
  isPurchasingOperator,
  money,
  recalculatePurchaseOrderTotals,
  recordReceiptLedger,
} from './purchase-order-flow';
import { PurchaseOrdersRepository } from './repositories/purchase-orders.repository';

type Tx = Parameters<Parameters<NodePgDatabase<typeof schema>['transaction']>[0]>[0];

const STATUS_LABEL: Record<string, string> = {
  draft: 'borrador',
  authorized: 'por comprar',
  purchased: 'comprada',
  partially_received: 'recibida parcialmente',
  received: 'recibida',
  cancelled: 'cancelada',
  closed_short: 'cerrada con faltante',
};

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly purchaseOrdersRepository: PurchaseOrdersRepository,
    private readonly inventoryService: InventoryService,
    @Inject(DRIZZLE_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
    private readonly auditLog: AuditLogService,
  ) {}

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  async findAll(businessId: string, actor: any) {
    assertBusinessAccess(actor, businessId);
    const orders = await this.purchaseOrdersRepository.findAll(businessId);
    return this.hidesDrafts(actor)
      ? orders.filter((o) => !HIDDEN_FROM_WAREHOUSE_PO_STATUSES.includes(o.status as any))
      : orders;
  }

  /** Almacén y Compras: por comprar, en camino, recibidas en parte. */
  async findPurchasing(businessId: string, actor: any) {
    assertBusinessAccess(actor, businessId);
    return this.purchaseOrdersRepository.findByStatuses(businessId, PURCHASING_STATUSES);
  }

  async findOne(id: string, actor: any) {
    const order = await this.purchaseOrdersRepository.findByIdWithItems(id);
    if (!order) throw new NotFoundException(`Purchase order with ID ${id} not found`);
    assertBusinessAccess(actor, order.businessId);
    if (this.hidesDrafts(actor) && HIDDEN_FROM_WAREHOUSE_PO_STATUSES.includes(order.status as any)) {
      throw new ForbiddenException('Esta orden de compra aún no está autorizada.');
    }
    return order;
  }

  /** Audit timeline plus every entrada line. */
  async history(id: string, actor: any) {
    const purchaseOrder = await this.findOne(id, actor);
    const [events, receipts] = await Promise.all([
      this.auditLog.query({ entityType: 'purchase_order', entityId: id, limit: 500 }),
      this.purchaseOrdersRepository.findReceiptLedger(id),
    ]);
    return { purchaseOrder, events: [...events].reverse(), receipts };
  }

  // ---------------------------------------------------------------------------
  // Owner / Admin. Inventario
  // ---------------------------------------------------------------------------

  async create(dto: CreatePurchaseOrderDto, actor: any) {
    this.assertManager(actor);
    assertBusinessAccess(actor, dto.businessId);
    const items = this.mergeLines(dto.items);

    return this.db.transaction(async (tx) => {
      await this.assertBelongsToBusiness(tx, dto.businessId, dto.providerId, dto.warehouseId);
      const [order] = await tx
        .insert(schema.purchaseOrders)
        .values({
          businessId: dto.businessId,
          providerId: dto.providerId,
          warehouseId: dto.warehouseId,
          poNumber: dto.orderNumber.trim(),
          status: PO_STATUS.draft,
          notes: dto.notes?.trim() || null,
          createdBy: actor.sub,
        })
        .returning();
      await this.insertLines(tx, order.id, items);
      await recalculatePurchaseOrderTotals(tx, order.id);
      await this.audit(tx, order, actor, 'created', null, { after: { status: PO_STATUS.draft, items } });
      return this.purchaseOrdersRepository.findByIdWithItems(order.id, tx);
    });
  }

  async update(id: string, dto: UpdatePurchaseOrderDto, actor: any) {
    this.assertManager(actor);
    return this.db.transaction(async (tx) => {
      const order = await this.lock(tx, id, actor);
      if (order.status !== PO_STATUS.draft) {
        throw new BadRequestException('Solo se puede editar una orden en borrador. Cancélala y crea otra.');
      }
      await this.assertBelongsToBusiness(tx, order.businessId, dto.providerId, dto.warehouseId);

      await tx
        .update(schema.purchaseOrders)
        .set({
          ...(dto.providerId ? { providerId: dto.providerId } : {}),
          ...(dto.warehouseId ? { warehouseId: dto.warehouseId } : {}),
          ...(dto.orderNumber ? { poNumber: dto.orderNumber.trim() } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.purchaseOrders.id, id));
      if (dto.items) {
        await tx.delete(schema.purchaseOrderItems).where(eq(schema.purchaseOrderItems.poId, id));
        await this.insertLines(tx, id, this.mergeLines(dto.items));
      }
      await recalculatePurchaseOrderTotals(tx, id);
      await this.audit(tx, order, actor, 'updated', null, { after: dto });
      return this.purchaseOrdersRepository.findByIdWithItems(id, tx);
    });
  }

  async remove(id: string, actor: any) {
    this.assertManager(actor);
    await this.db.transaction(async (tx) => {
      const order = await this.lock(tx, id, actor);
      if (order.status !== PO_STATUS.draft) {
        throw new BadRequestException('Solo se puede borrar una orden en borrador. Para las demás usa Cancelar.');
      }
      await tx
        .update(schema.purchaseOrders)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.purchaseOrders.id, id));
      await this.audit(tx, order, actor, 'deleted', null, { before: { status: order.status } });
    });
    return { success: true, message: 'Purchase order deleted successfully' };
  }

  /** draft → authorized: Almacén y Compras sees it in "Órdenes por comprar". */
  async authorize(id: string, actor: any) {
    this.assertManager(actor);
    return this.transition(id, actor, [PO_STATUS.draft], PO_STATUS.authorized, 'authorized', null);
  }

  async cancel(id: string, dto: PoReasonDto, actor: any) {
    this.assertManager(actor);
    const reason = this.requireText(dto.reason, 'Indica el motivo de la cancelación.');
    return this.transition(id, actor, CANCELLABLE_STATUSES, PO_STATUS.cancelled, 'cancelled', reason);
  }

  /** A partly received OC whose remainder will not arrive. */
  async closeShort(id: string, dto: PoReasonDto, actor: any) {
    this.assertManager(actor);
    const reason = this.requireText(dto.reason, 'Indica por qué se cierra con faltante.');
    return this.transition(id, actor, [PO_STATUS.partiallyReceived], PO_STATUS.closedShort, 'closed_short', reason);
  }

  // ---------------------------------------------------------------------------
  // Almacén y Compras
  // ---------------------------------------------------------------------------

  /** Bought; on the way to the warehouse. Owner / Admin. Inv. may do it on its behalf with a note. */
  async markPurchased(id: string, dto: MarkPurchasedDto, actor: any) {
    const operator = isPurchasingOperator(actor);
    if (!operator && !isPoManager(actor)) {
      throw new ForbiddenException('Solo Almacén y Compras marca una orden como comprada.');
    }
    const notes = dto.notes?.trim() || null;
    if (!operator && !notes) {
      throw new BadRequestException('Indica el motivo para marcarla en nombre de Almacén y Compras.');
    }
    const documentNumber = dto.documentNumber?.trim() || null;
    const reason = [notes, documentNumber ? `Ticket/factura: ${documentNumber}` : null].filter(Boolean).join(' · ') || null;
    return this.transition(
      id,
      actor,
      CAN_MARK_PURCHASED_STATUSES,
      PO_STATUS.purchased,
      operator ? 'purchased' : 'purchased_on_behalf',
      reason,
    );
  }

  /**
   * Entrada: a single count of what physically arrives and the price paid. Stock and
   * average cost change only here, in one transaction. Differences (short, over,
   * price) are allowed with a note and kept in purchase_order_receipt_ledger.
   */
  async receive(id: string, dto: ReceivePurchaseOrderDto, actor: any) {
    const operator = isPurchasingOperator(actor);
    if (!operator && !isPoManager(actor)) throw new ForbiddenException('Solo Almacén y Compras registra entradas.');
    const notes = dto.notes?.trim() || null;
    if (!operator && !notes) {
      throw new BadRequestException('Indica el motivo para registrar la entrada en nombre de Almacén y Compras.');
    }

    return this.db.transaction(async (tx) => {
      const order = await this.lock(tx, id, actor);
      if (!RECEIVABLE_STATUSES.includes(order.status as any)) {
        throw new BadRequestException(
          order.status === PO_STATUS.authorized
            ? 'Marca la orden como comprada antes de registrar la entrada.'
            : `No se puede registrar una entrada en una orden ${STATUS_LABEL[order.status] ?? order.status}.`,
        );
      }

      const items = await tx.select().from(schema.purchaseOrderItems).where(eq(schema.purchaseOrderItems.poId, id));
      const byProduct = new Map(items.map((i) => [i.productId, i]));
      const counted = new Map<string, { quantityReceived: number; unitCostActual: number }>();
      for (const line of dto.items) {
        if (!byProduct.has(line.productId)) throw new BadRequestException('Solo se pueden recibir productos de la orden.');
        if (counted.has(line.productId)) throw new BadRequestException('Cada producto se cuenta una sola vez por entrada.');
        counted.set(line.productId, {
          quantityReceived: qty(line.quantityReceived),
          unitCostActual: money(line.unitCostActual),
        });
      }
      if (![...counted.values()].some((c) => c.quantityReceived > 0)) {
        throw new BadRequestException('La entrada debe incluir al menos un producto recibido.');
      }

      const lines = items
        .filter((item) => counted.has(item.productId))
        .map((item) => {
          const c = counted.get(item.productId)!;
          const ordered = qty(item.quantityOrdered);
          const previouslyReceived = qty(item.quantityReceived);
          const pending = Math.max(0, qty(ordered - previouslyReceived));
          return { item, ordered, previouslyReceived, pending, estimated: money(item.unitCostEstimated), ...c };
        });
      const hasDifference = lines.some(
        (l) => !sameQty(l.quantityReceived, l.pending) || Math.abs(l.unitCostActual - l.estimated) > 0.004,
      );
      if (hasDifference && !notes) {
        throw new BadRequestException('Registra una nota: la cantidad o el precio difiere de lo pendiente en la orden.');
      }

      const ledgerNote = `Entrada OC ${order.poNumber}${notes ? `: ${notes}` : ''}`;
      for (const line of lines.filter((l) => l.quantityReceived > 0)) {
        await this.inventoryService.applyPurchaseReceiptLine(
          tx,
          order,
          { productId: line.item.productId, quantityReceived: line.quantityReceived, unitCostActual: line.unitCostActual },
          ledgerNote,
          actor.sub,
        );
        const totalReceived = qty(line.previouslyReceived + line.quantityReceived);
        // Weighted average of what was actually paid across all entradas of this line.
        const avgActual =
          (line.previouslyReceived * money(line.item.unitCostActual) + line.quantityReceived * line.unitCostActual) /
          totalReceived;
        await tx
          .update(schema.purchaseOrderItems)
          .set({ quantityReceived: totalReceived.toFixed(3), unitCostActual: money(avgActual).toFixed(2) })
          .where(eq(schema.purchaseOrderItems.id, line.item.id));
      }

      const receiptId = randomUUID();
      const documentNumber = dto.documentNumber?.trim() || null;
      await recordReceiptLedger(
        tx,
        {
          businessId: order.businessId,
          purchaseOrderId: id,
          receiptId,
          warehouseId: order.warehouseId,
          branchId: order.branchId,
          note: notes,
          documentNumber,
          actor,
        },
        lines.map((l) => ({
          itemId: l.item.id,
          productId: l.item.productId,
          quantityOrdered: l.ordered,
          previouslyReceived: l.previouslyReceived,
          quantityReceived: l.quantityReceived,
          unitCostEstimated: l.estimated,
          unitCostActual: l.unitCostActual,
        })),
      );

      const after = await tx.select().from(schema.purchaseOrderItems).where(eq(schema.purchaseOrderItems.poId, id));
      const complete = after.every((i) => qty(i.quantityReceived) + 0.0005 >= qty(i.quantityOrdered));
      const status = complete ? PO_STATUS.received : PO_STATUS.partiallyReceived;
      await tx
        .update(schema.purchaseOrders)
        .set({ status, actualDeliveryDate: new Date(), updatedAt: new Date() })
        .where(eq(schema.purchaseOrders.id, id));

      await this.audit(tx, order, actor, operator ? 'received' : 'received_on_behalf', notes, {
        before: { status: order.status },
        after: {
          status,
          receiptId,
          documentNumber,
          hasDifference,
          items: lines.map((l) => ({
            productId: l.item.productId,
            pending: l.pending,
            received: l.quantityReceived,
            estimatedCost: l.estimated,
            actualCost: l.unitCostActual,
          })),
        },
      });
      return {
        success: true,
        status,
        receiptId,
        hasDifference,
        purchaseOrder: await this.purchaseOrdersRepository.findByIdWithItems(id, tx),
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private hidesDrafts(actor: any) {
    return isPurchasingOperator(actor) && !isPoManager(actor);
  }

  private assertManager(actor: any) {
    if (!isPoManager(actor)) {
      throw new ForbiddenException('Solo el propietario o el administrador de inventario gestionan órdenes de compra.');
    }
  }

  private requireText(value: string | undefined, message: string) {
    const text = value?.trim();
    if (!text) throw new BadRequestException(message);
    return text;
  }

  private mergeLines(items: PurchaseOrderItemDto[]) {
    const merged = new Map<string, PurchaseOrderItemDto>();
    for (const item of items) {
      const existing = merged.get(item.productId);
      merged.set(item.productId, existing ? { ...item, quantity: qty(existing.quantity + item.quantity) } : { ...item });
    }
    return [...merged.values()];
  }

  private async insertLines(tx: Tx, poId: string, items: PurchaseOrderItemDto[]) {
    await tx.insert(schema.purchaseOrderItems).values(
      items.map((item) => ({
        poId,
        productId: item.productId,
        quantityOrdered: qty(item.quantity).toFixed(3),
        unitCostEstimated: money(item.estimatedUnitCost).toFixed(2),
      })),
    );
  }

  private async assertBelongsToBusiness(tx: Tx, businessId: string, providerId?: string, warehouseId?: string) {
    if (providerId) {
      const [provider] = await tx
        .select({ id: schema.providers.id })
        .from(schema.providers)
        .where(and(eq(schema.providers.id, providerId), eq(schema.providers.businessId, businessId)));
      if (!provider) throw new BadRequestException('El proveedor no pertenece al negocio.');
    }
    if (warehouseId) {
      const [warehouse] = await tx
        .select({ id: schema.warehouses.id, locationType: schema.warehouses.locationType })
        .from(schema.warehouses)
        .where(and(eq(schema.warehouses.id, warehouseId), eq(schema.warehouses.businessId, businessId)));
      if (!warehouse || warehouse.locationType === 'transit') {
        throw new BadRequestException('La bodega destino no es válida para este negocio.');
      }
    }
  }

  private async lock(tx: Tx, id: string, actor: any) {
    const [order] = await tx
      .select()
      .from(schema.purchaseOrders)
      .where(and(eq(schema.purchaseOrders.id, id), isNull(schema.purchaseOrders.deletedAt)))
      .for('update');
    if (!order) throw new NotFoundException(`Purchase order with ID ${id} not found`);
    assertBusinessAccess(actor, order.businessId);
    if (this.hidesDrafts(actor) && HIDDEN_FROM_WAREHOUSE_PO_STATUSES.includes(order.status as any)) {
      throw new ForbiddenException('Esta orden de compra aún no está autorizada.');
    }
    return order;
  }

  private async transition(
    id: string,
    actor: any,
    from: readonly string[],
    to: string,
    action: string,
    reason: string | null,
  ) {
    return this.db.transaction(async (tx) => {
      const order = await this.lock(tx, id, actor);
      if (!from.includes(order.status)) {
        throw new BadRequestException(
          `No se puede pasar a ${STATUS_LABEL[to] ?? to} una orden ${STATUS_LABEL[order.status] ?? order.status}.`,
        );
      }
      await tx
        .update(schema.purchaseOrders)
        .set({ status: to, updatedAt: new Date() })
        .where(eq(schema.purchaseOrders.id, id));
      await this.audit(tx, order, actor, action, reason, { before: { status: order.status }, after: { status: to } });
      return this.purchaseOrdersRepository.findByIdWithItems(id, tx);
    });
  }

  private audit(
    tx: Tx,
    order: { id: string; businessId: string; branchId: string | null },
    actor: any,
    action: string,
    reason: string | null,
    change: { before?: unknown; after?: unknown },
  ) {
    return this.auditLog.record(tx, {
      businessId: order.businessId,
      branchId: order.branchId,
      entityType: 'purchase_order',
      entityId: order.id,
      action,
      actorId: actor.sub,
      actorRole: primaryRole(actor),
      reason,
      before: change.before,
      after: change.after,
      source: actorSource(actor),
    });
  }
}
