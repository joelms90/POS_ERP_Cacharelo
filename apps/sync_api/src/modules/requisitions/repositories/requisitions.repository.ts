import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, ne, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import * as schema from '../../../database/schema';

type Reader = Pick<NodePgDatabase<typeof schema>, 'select'>;

/** Read side of branch requisitions. State changes live in RequisitionsService. */
@Injectable()
export class RequisitionsRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  private selectRequisitions(exec: Reader, where: SQL | undefined) {
    return exec
      .select({
        requisition: schema.branchRequisitions,
        fromBranchName: schema.branches.name,
        toWarehouseName: schema.warehouses.name,
        createdByName: schema.users.name,
      })
      .from(schema.branchRequisitions)
      .leftJoin(schema.branches, eq(schema.branchRequisitions.fromBranchId, schema.branches.id))
      .leftJoin(schema.warehouses, eq(schema.branchRequisitions.toWarehouseId, schema.warehouses.id))
      .leftJoin(schema.users, eq(schema.branchRequisitions.createdBy, schema.users.id))
      .where(where)
      .orderBy(desc(schema.branchRequisitions.createdAt));
  }

  /** Attach items and the (non-cancelled) transfer that fulfils each requisition. */
  private async populate(
    exec: Reader,
    rows: Array<{
      requisition: typeof schema.branchRequisitions.$inferSelect;
      fromBranchName: string | null;
      toWarehouseName: string | null;
      createdByName: string | null;
    }>,
  ) {
    if (rows.length === 0) return [];
    const reqIds = rows.map((r) => r.requisition.id);

    const [items, transfers] = await Promise.all([
      exec
        .select({
          requisitionItem: schema.branchRequisitionItems,
          productName: schema.products.name,
          unit: schema.products.uom,
        })
        .from(schema.branchRequisitionItems)
        .leftJoin(schema.products, eq(schema.branchRequisitionItems.productId, schema.products.id))
        .where(inArray(schema.branchRequisitionItems.requisitionId, reqIds)),
      exec
        .select()
        .from(schema.stockTransfers)
        .where(and(inArray(schema.stockTransfers.requisitionId, reqIds), ne(schema.stockTransfers.status, 'cancelled'))),
    ]);

    const itemsMap = new Map<string, any[]>();
    for (const item of items) {
      const list = itemsMap.get(item.requisitionItem.requisitionId) || [];
      list.push({ ...item.requisitionItem, productName: item.productName || 'Insumo', unit: item.unit || 'pza' });
      itemsMap.set(item.requisitionItem.requisitionId, list);
    }
    const transferMap = new Map(transfers.map((t) => [t.requisitionId as string, t]));

    return rows.map((r) => {
      const reqItems = itemsMap.get(r.requisition.id) || [];
      const transfer = transferMap.get(r.requisition.id);
      return {
        ...r.requisition,
        fromBranchName: r.fromBranchName || null,
        toWarehouseName: r.toWarehouseName || null,
        createdByName: r.createdByName || null,
        itemCount: reqItems.length,
        items: reqItems,
        transfer: transfer
          ? {
              id: transfer.id,
              status: transfer.status,
              shippedAt: transfer.transferredAt,
              deliveredAt: transfer.deliveredAt,
              receivedAt: transfer.receivedAt,
              receiptNote: transfer.receiptNote,
            }
          : null,
      };
    });
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(schema.branchRequisitions).where(eq(schema.branchRequisitions.id, id));
    return row || null;
  }

  async findByIdWithItems(id: string, exec: Reader = this.db) {
    const rows = await this.selectRequisitions(exec, eq(schema.branchRequisitions.id, id));
    const [populated] = await this.populate(exec, rows);
    return populated || null;
  }

  async findByBranch(branchId: string, businessId?: string) {
    const conditions = [eq(schema.branchRequisitions.fromBranchId, branchId)];
    if (businessId) conditions.push(eq(schema.branchRequisitions.businessId, businessId));
    return this.populate(this.db, await this.selectRequisitions(this.db, and(...conditions)));
  }

  async findAll(businessId: string) {
    return this.populate(
      this.db,
      await this.selectRequisitions(this.db, eq(schema.branchRequisitions.businessId, businessId)),
    );
  }

  async findByStatuses(businessId: string, statuses: string[]) {
    return this.populate(
      this.db,
      await this.selectRequisitions(
        this.db,
        and(eq(schema.branchRequisitions.businessId, businessId), inArray(schema.branchRequisitions.status, statuses)),
      ),
    );
  }

  async findByRequester(businessId: string, branchId: string, createdBy: string, status?: string) {
    const conditions = [
      eq(schema.branchRequisitions.businessId, businessId),
      eq(schema.branchRequisitions.fromBranchId, branchId),
      eq(schema.branchRequisitions.createdBy, createdBy),
    ];
    if (status) conditions.push(eq(schema.branchRequisitions.status, status));
    return this.populate(this.db, await this.selectRequisitions(this.db, and(...conditions)));
  }

  /** Per-product trail, oldest first, with product and actor names. */
  async findLedger(requisitionId: string) {
    return this.db
      .select({
        id: schema.requisitionItemLedger.id,
        stage: schema.requisitionItemLedger.stage,
        productId: schema.requisitionItemLedger.productId,
        productName: schema.products.name,
        transferId: schema.requisitionItemLedger.transferId,
        quantity: schema.requisitionItemLedger.quantity,
        expectedQuantity: schema.requisitionItemLedger.expectedQuantity,
        difference: schema.requisitionItemLedger.difference,
        note: schema.requisitionItemLedger.note,
        actorId: schema.requisitionItemLedger.actorId,
        actorName: schema.users.name,
        actorRole: schema.requisitionItemLedger.actorRole,
        source: schema.requisitionItemLedger.source,
        createdAt: schema.requisitionItemLedger.createdAt,
      })
      .from(schema.requisitionItemLedger)
      .leftJoin(schema.products, eq(schema.requisitionItemLedger.productId, schema.products.id))
      .leftJoin(schema.users, eq(schema.requisitionItemLedger.actorId, schema.users.id))
      .where(eq(schema.requisitionItemLedger.requisitionId, requisitionId))
      .orderBy(asc(schema.requisitionItemLedger.createdAt), asc(schema.requisitionItemLedger.id));
  }
}
