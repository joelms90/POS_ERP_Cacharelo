import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, inArray, desc, asc } from 'drizzle-orm';

@Injectable()
export class RequisitionsRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  private async populateRequisitions(
    rows: Array<{
      requisition: typeof schema.branchRequisitions.$inferSelect;
      fromBranchName: string | null;
      toWarehouseName: string | null;
    }>,
  ) {
    if (rows.length === 0) return [];

    const reqIds = rows.map((r) => r.requisition.id);

    const items = await this.db
      .select({
        requisitionItem: schema.branchRequisitionItems,
        productName: schema.products.name,
        unit: schema.products.uom,
      })
      .from(schema.branchRequisitionItems)
      .leftJoin(schema.products, eq(schema.branchRequisitionItems.productId, schema.products.id))
      .where(inArray(schema.branchRequisitionItems.requisitionId, reqIds));

    const itemsMap = new Map<string, any[]>();
    for (const item of items) {
      const list = itemsMap.get(item.requisitionItem.requisitionId) || [];
      list.push({
        ...item.requisitionItem,
        productName: item.productName || 'Insumo',
        unit: item.unit || 'pza',
      });
      itemsMap.set(item.requisitionItem.requisitionId, list);
    }

    return rows.map((r) => {
      const reqItems = itemsMap.get(r.requisition.id) || [];
      return {
        ...r.requisition,
        fromBranchName: r.fromBranchName || null,
        toWarehouseName: r.toWarehouseName || null,
        itemCount: reqItems.length,
        items: reqItems,
      };
    });
  }

  async findById(id: string) {
    const results = await this.db
      .select()
      .from(schema.branchRequisitions)
      .where(eq(schema.branchRequisitions.id, id));
    return results[0] || null;
  }

  async findByIdWithItems(id: string) {
    const rows = await this.db
      .select({
        requisition: schema.branchRequisitions,
        fromBranchName: schema.branches.name,
        toWarehouseName: schema.warehouses.name,
      })
      .from(schema.branchRequisitions)
      .leftJoin(schema.branches, eq(schema.branchRequisitions.fromBranchId, schema.branches.id))
      .leftJoin(schema.warehouses, eq(schema.branchRequisitions.toWarehouseId, schema.warehouses.id))
      .where(eq(schema.branchRequisitions.id, id));

    if (rows.length === 0) return null;
    const populated = await this.populateRequisitions(rows);
    return populated[0] || null;
  }

  async findByBranch(branchId: string, businessId?: string) {
    const conditions = [eq(schema.branchRequisitions.fromBranchId, branchId)];
    if (businessId) {
      conditions.push(eq(schema.branchRequisitions.businessId, businessId));
    }
    const rows = await this.db
      .select({
        requisition: schema.branchRequisitions,
        fromBranchName: schema.branches.name,
        toWarehouseName: schema.warehouses.name,
      })
      .from(schema.branchRequisitions)
      .leftJoin(schema.branches, eq(schema.branchRequisitions.fromBranchId, schema.branches.id))
      .leftJoin(schema.warehouses, eq(schema.branchRequisitions.toWarehouseId, schema.warehouses.id))
      .where(and(...conditions))
      .orderBy(desc(schema.branchRequisitions.createdAt));

    return this.populateRequisitions(rows);
  }

  async findAll(businessId: string) {
    const rows = await this.db
      .select({
        requisition: schema.branchRequisitions,
        fromBranchName: schema.branches.name,
        toWarehouseName: schema.warehouses.name,
      })
      .from(schema.branchRequisitions)
      .leftJoin(schema.branches, eq(schema.branchRequisitions.fromBranchId, schema.branches.id))
      .leftJoin(schema.warehouses, eq(schema.branchRequisitions.toWarehouseId, schema.warehouses.id))
      .where(eq(schema.branchRequisitions.businessId, businessId))
      .orderBy(desc(schema.branchRequisitions.createdAt));

    return this.populateRequisitions(rows);
  }

  async findByRequester(businessId: string, branchId: string, createdBy: string, status?: string) {
    const conditions = [
      eq(schema.branchRequisitions.businessId, businessId),
      eq(schema.branchRequisitions.fromBranchId, branchId),
      eq(schema.branchRequisitions.createdBy, createdBy),
    ];
    if (status) conditions.push(eq(schema.branchRequisitions.status, status));
    const rows = await this.db
      .select({
        requisition: schema.branchRequisitions,
        fromBranchName: schema.branches.name,
        toWarehouseName: schema.warehouses.name,
      })
      .from(schema.branchRequisitions)
      .leftJoin(schema.branches, eq(schema.branchRequisitions.fromBranchId, schema.branches.id))
      .leftJoin(schema.warehouses, eq(schema.branchRequisitions.toWarehouseId, schema.warehouses.id))
      .where(and(...conditions))
      .orderBy(desc(schema.branchRequisitions.createdAt));

    return this.populateRequisitions(rows);
  }

  async findPendingForBusiness(businessId: string) {
    const rows = await this.db
      .select({
        requisition: schema.branchRequisitions,
        fromBranchName: schema.branches.name,
        toWarehouseName: schema.warehouses.name,
      })
      .from(schema.branchRequisitions)
      .leftJoin(schema.branches, eq(schema.branchRequisitions.fromBranchId, schema.branches.id))
      .leftJoin(schema.warehouses, eq(schema.branchRequisitions.toWarehouseId, schema.warehouses.id))
      .where(
        and(
          eq(schema.branchRequisitions.businessId, businessId),
          inArray(schema.branchRequisitions.status, ['pending', 'pending_approval', 'standby']),
        ),
      )
      .orderBy(desc(schema.branchRequisitions.createdAt));

    return this.populateRequisitions(rows);
  }

  async create(data: {
    id?: string;
    businessId: string;
    fromBranchId: string;
    toWarehouseId: string;
    createdBy: string;
    notes?: string;
    items: Array<{
      productId: string;
      quantityRequested: number;
    }>;
  }) {
    return await this.db.transaction(async (tx) => {
      if (data.id) {
        const existing = await tx
          .select()
          .from(schema.branchRequisitions)
          .where(eq(schema.branchRequisitions.id, data.id));
        if (existing[0]) {
          const items = await tx
            .select({
              requisitionItem: schema.branchRequisitionItems,
              productName: schema.products.name,
            })
            .from(schema.branchRequisitionItems)
            .leftJoin(schema.products, eq(schema.branchRequisitionItems.productId, schema.products.id))
            .where(eq(schema.branchRequisitionItems.requisitionId, data.id));

          return {
            ...existing[0],
            items: items.map((i) => ({
              ...i.requisitionItem,
              productName: i.productName,
            })),
          };
        }
      }

      // Create requisition
      const [requisition] = await tx
        .insert(schema.branchRequisitions)
        .values({
          id: data.id,
          businessId: data.businessId,
          fromBranchId: data.fromBranchId,
          toWarehouseId: data.toWarehouseId,
          createdBy: data.createdBy,
          status: 'pending',
          notes: data.notes || null,
        })
        .returning();

      // Create requisition items
      let insertedItems: Array<typeof schema.branchRequisitionItems.$inferSelect> = [];
      if (data.items && data.items.length > 0) {
        insertedItems = await tx
          .insert(schema.branchRequisitionItems)
          .values(
            data.items.map((item) => ({
              requisitionId: requisition.id,
              productId: item.productId,
              quantityRequested: item.quantityRequested.toString(),
            })),
          )
          .returning();
      }

      // Attach product names within the same transaction
      const productIds = insertedItems.map((i) => i.productId);
      const products = productIds.length
        ? await tx
            .select({ id: schema.products.id, name: schema.products.name })
            .from(schema.products)
            .where(inArray(schema.products.id, productIds))
        : [];
      const nameMap = new Map(products.map((p) => [p.id, p.name]));

      return {
        ...requisition,
        items: insertedItems.map((item) => ({
          ...item,
          productName: nameMap.get(item.productId) || null,
        })),
      };
    });
  }

  async createForBranch(data: {
    id?: string;
    businessId: string;
    fromBranchId: string;
    createdBy: string;
    notes?: string;
    items: Array<{ productId: string; quantityRequested: number }>;
  }) {
    const [warehouse] = await this.db
      .select({ id: schema.warehouses.id })
      .from(schema.warehouses)
      .where(eq(schema.warehouses.businessId, data.businessId))
      .orderBy(asc(schema.warehouses.createdAt))
      .limit(1);
    if (!warehouse) throw new Error('No hay una bodega configurada para este negocio.');
    return this.create({ ...data, toWarehouseId: warehouse.id });
  }

  async updateStatus(
    id: string,
    status: 'pending' | 'pending_approval' | 'approved' | 'rejected' | 'completed' | 'standby',
    approvalNotes?: string,
  ) {
    return await this.db.transaction(async (tx) => {
      // 1. Update status
      const [requisition] = await tx
        .update(schema.branchRequisitions)
        .set({
          status,
          ...(approvalNotes ? { notes: approvalNotes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.branchRequisitions.id, id))
        .returning();

      if (!requisition) return null;

      // 2. If approved, create a pending stock transfer
      if (status === 'approved') {
        // Fetch requisition items
        const items = await tx
          .select()
          .from(schema.branchRequisitionItems)
          .where(eq(schema.branchRequisitionItems.requisitionId, id));

        if (items.length > 0) {
          // Fetch product costs to log unitCost/totalCost
          const productIds = items.map(item => item.productId);
          const products = await tx
            .select({ id: schema.products.id, cost: schema.products.cost })
            .from(schema.products)
            .where(inArray(schema.products.id, productIds));

          const productCostMap = new Map(products.map(p => [p.id, p.cost]));

          // Create stock transfer
          const [transfer] = await tx
            .insert(schema.stockTransfers)
            .values({
              businessId: requisition.businessId,
              fromWarehouseId: requisition.toWarehouseId,
              toBranchId: requisition.fromBranchId,
              status: 'pending',
              notes: `Aprobación de Requisición: ${requisition.notes || ''}. Notas de aprobación: ${approvalNotes || ''}`.trim(),
            })
            .returning();

          // Create stock transfer items
          await tx
            .insert(schema.stockTransferItems)
            .values(
              items.map((item) => {
                const costStr = productCostMap.get(item.productId) || '0.00';
                const costVal = parseFloat(costStr);
                const qtyVal = parseFloat(item.quantityRequested);
                const totalCostVal = costVal * qtyVal;

                return {
                  transferId: transfer.id,
                  productId: item.productId,
                  quantity: item.quantityRequested,
                  unitCost: costStr,
                  totalCost: totalCostVal.toFixed(2),
                };
              })
            );
        }
      }

      return requisition;
    });
  }
}
