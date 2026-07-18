import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, inArray, count } from 'drizzle-orm';

@Injectable()
export class RequisitionsRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: string) {
    const results = await this.db
      .select()
      .from(schema.branchRequisitions)
      .where(eq(schema.branchRequisitions.id, id));
    return results[0] || null;
  }

  async findByIdWithItems(id: string) {
    const requisition = await this.findById(id);
    if (!requisition) return null;

    const items = await this.db
      .select()
      .from(schema.branchRequisitionItems)
      .where(eq(schema.branchRequisitionItems.requisitionId, id));

    return {
      ...requisition,
      items,
    };
  }

  async findByBranch(branchId: string) {
    return this.db
      .select()
      .from(schema.branchRequisitions)
      .where(eq(schema.branchRequisitions.fromBranchId, branchId))
      .orderBy(schema.branchRequisitions.createdAt);
  }

  async findAll(businessId: string) {
    const requisitions = await this.db
      .select()
      .from(schema.branchRequisitions)
      .where(eq(schema.branchRequisitions.businessId, businessId))
      .orderBy(schema.branchRequisitions.createdAt);

    if (requisitions.length === 0) return [];

    const reqIds = requisitions.map((r) => r.id);

    const itemCounts = await this.db
      .select({
        requisitionId: schema.branchRequisitionItems.requisitionId,
        itemCount: count(schema.branchRequisitionItems.id),
      })
      .from(schema.branchRequisitionItems)
      .where(inArray(schema.branchRequisitionItems.requisitionId, reqIds))
      .groupBy(schema.branchRequisitionItems.requisitionId);

    const countMap = new Map(itemCounts.map((ic) => [ic.requisitionId, Number(ic.itemCount)]));

    return requisitions.map((r) => ({
      ...r,
      itemCount: countMap.get(r.id) || 0,
    }));
  }

  async findPendingForBusiness(businessId: string) {
    return this.db
      .select()
      .from(schema.branchRequisitions)
      .where(
        and(
          eq(schema.branchRequisitions.businessId, businessId),
          eq(schema.branchRequisitions.status, 'pending'),
        ),
      )
      .orderBy(schema.branchRequisitions.createdAt);
  }

  async create(data: {
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
      // Create requisition
      const [requisition] = await tx
        .insert(schema.branchRequisitions)
        .values({
          businessId: data.businessId,
          fromBranchId: data.fromBranchId,
          toWarehouseId: data.toWarehouseId,
          createdBy: data.createdBy,
          status: 'pending',
          notes: data.notes || null,
        })
        .returning();

      // Create requisition items
      if (data.items && data.items.length > 0) {
        await tx.insert(schema.branchRequisitionItems).values(
          data.items.map((item) => ({
            requisitionId: requisition.id,
            productId: item.productId,
            quantityRequested: item.quantityRequested.toString(),
          })),
        );
      }

      return this.findByIdWithItems(requisition.id);
    });
  }

  async updateStatus(
    id: string,
    status: 'pending' | 'approved' | 'rejected' | 'completed',
    approvalNotes?: string,
  ) {
    return await this.db.transaction(async (tx) => {
      // 1. Update status
      const [requisition] = await tx
        .update(schema.branchRequisitions)
        .set({
          status,
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
