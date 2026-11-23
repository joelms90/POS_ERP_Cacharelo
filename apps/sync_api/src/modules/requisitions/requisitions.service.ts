import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { AuditLogService } from '../audit/audit-log.service';
import { assertBusinessAccess } from '../auth/business-access';
import { InventoryService } from '../inventory/inventory.service';
import { LedgerService } from '../inventory/ledger.service';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import {
  ApproveRequisitionDto,
  DeliverRequisitionDto,
  DispatchRequisitionDto,
  ReasonDto,
} from './dto/requisition-flow.dto';
import {
  AWAITING_APPROVAL_STATUSES,
  HIDDEN_FROM_WAREHOUSE_STATUSES,
  OUTBOUND_STATUSES,
  REQUISITION_STATUS,
  actorRoles,
  actorSource,
  insertRequisition,
  isApprover,
  isBranchOperator,
  isWarehouse,
  primaryRole,
  qty,
  qtyStr,
  recordRequisitionLedger,
  sameQty,
} from './requisition-flow';
import { RequisitionsRepository } from './repositories/requisitions.repository';

type Tx = Parameters<Parameters<NodePgDatabase<typeof schema>['transaction']>[0]>[0];

@Injectable()
export class RequisitionsService {
  constructor(
    private readonly requisitionsRepository: RequisitionsRepository,
    @Inject(DRIZZLE_CONNECTION) private readonly db: NodePgDatabase<typeof schema>,
    private readonly ledgerService: LedgerService,
    private readonly inventoryService: InventoryService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  /**
   * OIS (POS) creates for its own branch → pending_approval.
   * Owner / Admin. Inventario (admin web) create for any branch → approved.
   */
  async createForOperator(dto: CreateRequisitionDto, actor: any) {
    if (!dto.items?.length) throw new BadRequestException('Agrega al menos un producto a la requisición.');
    if (!actor?.sub) throw new ForbiddenException('Operador no encontrado.');

    const approver = isApprover(actor);
    if (!approver && !isBranchOperator(actor)) {
      throw new ForbiddenException('Solo la sucursal, el propietario o el administrador de inventario crean requisiciones.');
    }

    // The POS never chooses its scope: business and branch come from the signed login.
    // Fields in the body are only a fallback for offline clients built before that.
    const businessId = approver ? dto.businessId || actor.businessId : actor.businessId || dto.businessId;
    const branchId = approver ? dto.fromBranchId || actor.branchId : actor.branchId || dto.fromBranchId;
    if (!businessId || !branchId) {
      throw new BadRequestException('Debe especificar un negocio y sucursal de origen válidos.');
    }
    assertBusinessAccess(actor, businessId);

    return this.db.transaction(async (tx) => {
      if (dto.id) {
        const [existing] = await tx
          .select({ id: schema.branchRequisitions.id })
          .from(schema.branchRequisitions)
          .where(eq(schema.branchRequisitions.id, dto.id));
        // Offline retries resend the same id: return what was stored the first time.
        if (existing) return this.requisitionsRepository.findByIdWithItems(existing.id, tx);
      }

      const [branch] = await tx
        .select({ id: schema.branches.id })
        .from(schema.branches)
        .where(and(eq(schema.branches.id, branchId), eq(schema.branches.businessId, businessId)));
      if (!branch) throw new BadRequestException('La sucursal no pertenece al negocio.');

      const requisition = await insertRequisition(tx, this.auditLog, {
        id: dto.id,
        businessId,
        branchId,
        toWarehouseId: dto.toWarehouseId || null,
        notes: dto.notes,
        actor,
        items: dto.items,
      });
      return this.requisitionsRepository.findByIdWithItems(requisition.id, tx);
    });
  }

  // ---------------------------------------------------------------------------
  // Owner / Admin. Inventario
  // ---------------------------------------------------------------------------

  async approve(id: string, dto: ApproveRequisitionDto, actor: any) {
    this.assertRole(isApprover(actor), 'Solo el propietario o el administrador de inventario autorizan requisiciones.');

    return this.db.transaction(async (tx) => {
      const requisition = await this.lockRequisition(tx, id, actor);
      if (!AWAITING_APPROVAL_STATUSES.includes(requisition.status)) {
        throw new BadRequestException(`La requisición ya no está por autorizar (estado: ${requisition.status}).`);
      }

      const items = await this.itemsOf(tx, id);
      const requested = new Map((dto.items ?? []).map((i) => [i.productId, qty(i.quantityApproved)]));
      this.assertKnownProducts(requested, items);

      const lines = items.map((item) => {
        const quantityRequested = qty(item.quantityRequested);
        return {
          item,
          quantityRequested,
          quantityApproved: requested.get(item.productId) ?? quantityRequested,
        };
      });
      if (!lines.some((l) => l.quantityApproved > 0)) {
        throw new BadRequestException('Autoriza al menos un producto o rechaza la requisición.');
      }
      const adjusted = lines.some((l) => !sameQty(l.quantityApproved, l.quantityRequested));
      const notes = dto.notes?.trim() || null;
      if (adjusted && !notes) {
        throw new BadRequestException('Explica el motivo al autorizar cantidades distintas a las solicitadas.');
      }

      for (const line of lines) {
        await tx
          .update(schema.branchRequisitionItems)
          .set({ quantityApproved: qtyStr(line.quantityApproved) })
          .where(eq(schema.branchRequisitionItems.id, line.item.id));
      }
      await tx
        .update(schema.branchRequisitions)
        .set({
          status: REQUISITION_STATUS.approved,
          approvedBy: actor.sub,
          approvedAt: new Date(),
          ...(dto.warehouseId ? { toWarehouseId: dto.warehouseId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.branchRequisitions.id, id));

      await recordRequisitionLedger(
        tx,
        this.ledgerCtx(requisition, 'approved', actor),
        lines.map((l) => ({
          productId: l.item.productId,
          quantity: l.quantityApproved,
          expectedQuantity: l.quantityRequested,
          note: notes,
        })),
      );
      await this.audit(tx, requisition, actor, 'approved', notes, {
        before: { status: requisition.status },
        after: {
          status: REQUISITION_STATUS.approved,
          items: lines.map((l) => ({
            productId: l.item.productId,
            requested: l.quantityRequested,
            approved: l.quantityApproved,
          })),
        },
      });
      return this.requisitionsRepository.findByIdWithItems(id, tx);
    });
  }

  /** Rejects a request, or cancels an approved one that has not been dispatched yet. */
  async reject(id: string, dto: ReasonDto, actor: any) {
    this.assertRole(isApprover(actor), 'Solo el propietario o el administrador de inventario rechazan requisiciones.');
    const reason = this.requireText(dto.reason, 'Indica el motivo del rechazo.');

    return this.db.transaction(async (tx) => {
      const requisition = await this.lockRequisition(tx, id, actor);
      const rejectable = [...AWAITING_APPROVAL_STATUSES, REQUISITION_STATUS.approved, REQUISITION_STATUS.standby];
      if (!rejectable.includes(requisition.status)) {
        throw new BadRequestException(`No se puede rechazar una requisición en estado "${requisition.status}".`);
      }
      await this.setStatus(tx, id, REQUISITION_STATUS.rejected);
      await this.audit(tx, requisition, actor, 'rejected', reason, {
        before: { status: requisition.status },
        after: { status: REQUISITION_STATUS.rejected },
      });
      return this.requisitionsRepository.findByIdWithItems(id, tx);
    });
  }

  // ---------------------------------------------------------------------------
  // Almacén y Bodega
  // ---------------------------------------------------------------------------

  async hold(id: string, dto: ReasonDto, actor: any) {
    this.assertRole(isWarehouse(actor), 'Solo Almacén y Bodega pone requisiciones en espera.');
    const reason = this.requireText(dto.reason, 'Indica por qué no se puede surtir todavía.');

    return this.db.transaction(async (tx) => {
      const requisition = await this.lockRequisition(tx, id, actor);
      if (requisition.status !== REQUISITION_STATUS.approved) {
        throw new BadRequestException(`Solo una requisición autorizada se puede poner en espera (estado: ${requisition.status}).`);
      }
      await this.setStatus(tx, id, REQUISITION_STATUS.standby);
      await this.audit(tx, requisition, actor, 'held', reason, {
        before: { status: requisition.status },
        after: { status: REQUISITION_STATUS.standby },
      });
      return this.requisitionsRepository.findByIdWithItems(id, tx);
    });
  }

  /**
   * Creates the transfer and ships it in one step: stock leaves the origin warehouse
   * and enters "En Tránsito". Quantities may differ from the approved ones (with a
   * note); the difference is kept in requisition_item_ledger.
   */
  async dispatch(id: string, dto: DispatchRequisitionDto, actor: any) {
    this.assertRole(isWarehouse(actor), 'Solo Almacén y Bodega despacha requisiciones.');

    return this.db.transaction(async (tx) => {
      const requisition = await this.lockRequisition(tx, id, actor);
      if (requisition.status !== REQUISITION_STATUS.approved && requisition.status !== REQUISITION_STATUS.standby) {
        throw new BadRequestException(`Solo se despachan requisiciones autorizadas (estado: ${requisition.status}).`);
      }

      const warehouseId = dto.warehouseId || requisition.toWarehouseId;
      if (!warehouseId) throw new BadRequestException('Selecciona la bodega de salida.');
      const [warehouse] = await tx
        .select()
        .from(schema.warehouses)
        .where(and(eq(schema.warehouses.id, warehouseId), eq(schema.warehouses.businessId, requisition.businessId)));
      if (!warehouse || warehouse.locationType === 'transit') {
        throw new BadRequestException('La bodega de salida no es válida para este negocio.');
      }

      const items = await this.itemsOf(tx, id);
      const shipped = new Map((dto.items ?? []).map((i) => [i.productId, qty(i.quantity)]));
      this.assertKnownProducts(shipped, items);

      const products = await tx
        .select({ id: schema.products.id, name: schema.products.name, cost: schema.products.cost })
        .from(schema.products)
        .where(inArray(schema.products.id, items.map((i) => i.productId)));
      const productById = new Map(products.map((p) => [p.id, p]));

      const lines = items.map((item) => {
        // Legacy approvals never stored quantity_approved; fall back to what was requested.
        const approved = qty(item.quantityApproved) > 0 ? qty(item.quantityApproved) : qty(item.quantityRequested);
        return { item, approved, quantity: shipped.get(item.productId) ?? approved };
      });
      if (!lines.some((l) => l.quantity > 0)) {
        throw new BadRequestException('Despacha al menos un producto.');
      }
      const notes = dto.notes?.trim() || null;
      if (lines.some((l) => !sameQty(l.quantity, l.approved)) && !notes) {
        throw new BadRequestException('Explica el motivo al despachar cantidades distintas a las autorizadas.');
      }

      const shortages: string[] = [];
      for (const line of lines.filter((l) => l.quantity > 0)) {
        const available = await this.ledgerService.getStockLevel(tx, line.item.productId, warehouseId, null);
        if (line.quantity > qty(available) + 0.0005) {
          const name = productById.get(line.item.productId)?.name ?? 'Producto';
          shortages.push(`${name}: disponible ${qty(available)}, a despachar ${line.quantity}`);
        }
      }
      if (shortages.length) {
        throw new BadRequestException(`Stock insuficiente en ${warehouse.name}. ${shortages.join('; ')}`);
      }

      const now = new Date();
      const [transfer] = await tx
        .insert(schema.stockTransfers)
        .values({
          businessId: requisition.businessId,
          fromWarehouseId: warehouseId,
          toBranchId: requisition.fromBranchId,
          status: 'in_transit',
          transferredAt: now,
          requisitionId: id,
          shippedBy: actor.sub,
          notes: notes ? `Requisición despachada: ${notes}` : 'Requisición despachada',
        })
        .returning();

      const transitWh = await this.inventoryService.getOrCreateTransitWarehouse(tx, requisition.businessId);
      for (const line of lines.filter((l) => l.quantity > 0)) {
        const unitCost = productById.get(line.item.productId)?.cost || '0.00';
        await tx.insert(schema.stockTransferItems).values({
          transferId: transfer.id,
          productId: line.item.productId,
          quantity: qtyStr(line.quantity),
          unitCost,
          totalCost: (parseFloat(unitCost) * line.quantity).toFixed(2),
        });
        const movement = {
          businessId: requisition.businessId,
          productId: line.item.productId,
          unitCost,
          referenceType: 'transfer',
          referenceId: transfer.id,
          createdById: actor.sub,
        };
        await this.ledgerService.applyMovement(tx, {
          ...movement,
          quantityDelta: -line.quantity,
          eventType: 'transfer_out',
          warehouseId,
          notes: 'Salida a sucursal por requisición',
        });
        await this.ledgerService.applyMovement(tx, {
          ...movement,
          quantityDelta: line.quantity,
          eventType: 'transit_in',
          warehouseId: transitWh.id,
          notes: 'En tránsito',
        });
      }

      for (const line of lines) {
        await tx
          .update(schema.branchRequisitionItems)
          .set({ quantityDispatched: qtyStr(line.quantity) })
          .where(eq(schema.branchRequisitionItems.id, line.item.id));
      }
      await tx
        .update(schema.branchRequisitions)
        .set({ status: REQUISITION_STATUS.inTransit, toWarehouseId: warehouseId, updatedAt: now })
        .where(eq(schema.branchRequisitions.id, id));

      await recordRequisitionLedger(
        tx,
        { ...this.ledgerCtx(requisition, 'dispatched', actor), transferId: transfer.id },
        lines.map((l) => ({
          productId: l.item.productId,
          quantity: l.quantity,
          expectedQuantity: l.approved,
          note: notes,
        })),
      );
      await this.audit(tx, requisition, actor, 'dispatched', notes, {
        before: { status: requisition.status },
        after: {
          status: REQUISITION_STATUS.inTransit,
          transferId: transfer.id,
          warehouseId,
          items: lines.map((l) => ({ productId: l.item.productId, approved: l.approved, dispatched: l.quantity })),
        },
      });
      return this.requisitionsRepository.findByIdWithItems(id, tx);
    });
  }

  /** Bodega marks the merchandise as handed over; Owner / Admin. Inv. may do it on its behalf. */
  async deliver(id: string, dto: DeliverRequisitionDto, actor: any) {
    const warehouse = isWarehouse(actor);
    this.assertRole(warehouse || isApprover(actor), 'Solo Almacén y Bodega marca la entrega.');
    const notes = dto.notes?.trim() || null;
    if (!warehouse && !notes) {
      throw new BadRequestException('Indica el motivo para marcar la entrega en nombre de Almacén y Bodega.');
    }

    return this.db.transaction(async (tx) => {
      const requisition = await this.lockRequisition(tx, id, actor);
      if (requisition.status !== REQUISITION_STATUS.inTransit) {
        throw new BadRequestException(`Solo se entrega una requisición en camino (estado: ${requisition.status}).`);
      }
      const [transfer] = await tx
        .select()
        .from(schema.stockTransfers)
        .where(and(eq(schema.stockTransfers.requisitionId, id), eq(schema.stockTransfers.status, 'in_transit')))
        .for('update');
      if (!transfer) throw new BadRequestException('No se encontró el traspaso en camino de esta requisición.');

      const now = new Date();
      await tx
        .update(schema.stockTransfers)
        .set({ status: 'delivered', deliveredBy: actor.sub, deliveredAt: now, deliveryNote: notes })
        .where(eq(schema.stockTransfers.id, transfer.id));
      await this.setStatus(tx, id, REQUISITION_STATUS.delivered);
      await this.audit(tx, requisition, actor, warehouse ? 'delivered' : 'delivered_on_behalf', notes, {
        before: { status: requisition.status },
        after: { status: REQUISITION_STATUS.delivered, transferId: transfer.id },
      });
      return this.requisitionsRepository.findByIdWithItems(id, tx);
    });
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  async findMine(actor: any, status?: string) {
    if (!actor?.sub) throw new ForbiddenException('Operador no encontrado.');
    if (!actor.businessId || !actor.branchId) {
      throw new ForbiddenException('El operador debe estar asignado a un negocio y sucursal.');
    }
    return this.requisitionsRepository.findByRequester(actor.businessId, actor.branchId, actor.sub, status);
  }

  async findByBranch(branchId: string, businessId: string | undefined, actor: any) {
    assertBusinessAccess(actor, businessId);
    if (!this.isManagementReader(actor) && actor.branchId !== branchId) {
      throw new ForbiddenException('Solo puedes consultar requisiciones de tu sucursal.');
    }
    return this.withoutHiddenForWarehouse(actor, await this.requisitionsRepository.findByBranch(branchId, businessId));
  }

  /** Waiting for Owner / Admin. Inventario. */
  async findPendingForBusiness(businessId: string, actor: any) {
    assertBusinessAccess(actor, businessId);
    return this.requisitionsRepository.findByStatuses(businessId, AWAITING_APPROVAL_STATUSES);
  }

  /** Almacén y Bodega "Salidas": approved, on hold, on the way and delivered awaiting confirmation. */
  async findOutbound(businessId: string, actor: any) {
    assertBusinessAccess(actor, businessId);
    return this.requisitionsRepository.findByStatuses(businessId, OUTBOUND_STATUSES);
  }

  async findAll(businessId: string, actor: any) {
    assertBusinessAccess(actor, businessId);
    return this.withoutHiddenForWarehouse(actor, await this.requisitionsRepository.findAll(businessId));
  }

  async findOne(id: string, actor: any) {
    const requisition = await this.requisitionsRepository.findByIdWithItems(id);
    if (!requisition) throw new NotFoundException(`Requisition with ID ${id} not found`);
    this.assertMayRead(actor, requisition);
    return requisition;
  }

  /** Audit timeline plus the per-product ledger (requested → approved → dispatched → received). */
  async history(id: string, actor: any) {
    const requisition = await this.findOne(id, actor);
    const [events, ledger] = await Promise.all([
      this.auditLog.query({ entityType: 'branch_requisition', entityId: id, limit: 500 }),
      this.requisitionsRepository.findLedger(id),
    ]);
    return { requisition, events: [...events].reverse(), ledger };
  }

  assertMayRead(actor: any, requisition: any) {
    assertBusinessAccess(actor, requisition.businessId);
    if (isWarehouse(actor) && !isApprover(actor) && HIDDEN_FROM_WAREHOUSE_STATUSES.includes(requisition.status)) {
      throw new ForbiddenException('Esta requisición aún no está autorizada.');
    }
    if (this.isManagementReader(actor)) return;
    if (requisition.fromBranchId !== actor.branchId) {
      throw new ForbiddenException('Solo puedes consultar requisiciones de tu sucursal.');
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private isManagementReader(actor: any) {
    const roles = actorRoles(actor);
    return isApprover(actor) || isWarehouse(actor) || roles.includes('support_tech');
  }

  private withoutHiddenForWarehouse<T extends { status: string }>(actor: any, rows: T[]) {
    if (!isWarehouse(actor) || isApprover(actor)) return rows;
    return rows.filter((r) => !HIDDEN_FROM_WAREHOUSE_STATUSES.includes(r.status));
  }

  private assertRole(allowed: boolean, message: string) {
    if (!allowed) throw new ForbiddenException(message);
  }

  private requireText(value: string | undefined, message: string) {
    const text = value?.trim();
    if (!text) throw new BadRequestException(message);
    return text;
  }

  private assertKnownProducts(byProduct: Map<string, number>, items: Array<{ productId: string }>) {
    const known = new Set(items.map((i) => i.productId));
    if ([...byProduct.keys()].some((productId) => !known.has(productId))) {
      throw new BadRequestException('Solo se pueden ajustar productos de la requisición.');
    }
  }

  private async lockRequisition(tx: Tx, id: string, actor: any) {
    const [requisition] = await tx
      .select()
      .from(schema.branchRequisitions)
      .where(eq(schema.branchRequisitions.id, id))
      .for('update');
    if (!requisition) throw new NotFoundException(`Requisition with ID ${id} not found`);
    assertBusinessAccess(actor, requisition.businessId);
    return requisition;
  }

  private itemsOf(tx: Tx, id: string) {
    return tx.select().from(schema.branchRequisitionItems).where(eq(schema.branchRequisitionItems.requisitionId, id));
  }

  private setStatus(tx: Tx, id: string, status: string) {
    return tx
      .update(schema.branchRequisitions)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.branchRequisitions.id, id));
  }

  private ledgerCtx(requisition: any, stage: 'approved' | 'dispatched', actor: any) {
    return {
      businessId: requisition.businessId,
      branchId: requisition.fromBranchId,
      requisitionId: requisition.id,
      stage,
      actor,
    };
  }

  private audit(
    tx: Tx,
    requisition: any,
    actor: any,
    action: string,
    reason: string | null,
    change: { before?: unknown; after?: unknown },
  ) {
    return this.auditLog.record(tx, {
      businessId: requisition.businessId,
      branchId: requisition.fromBranchId,
      entityType: 'branch_requisition',
      entityId: requisition.id,
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
