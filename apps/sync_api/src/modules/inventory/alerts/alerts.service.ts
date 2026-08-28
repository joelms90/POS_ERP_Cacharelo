import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, inArray, desc, sql, isNull } from 'drizzle-orm';
import { ThresholdsService } from '../thresholds/thresholds.service';

@Injectable()
export class AlertsService {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly thresholdsService: ThresholdsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Alert engine
  // ---------------------------------------------------------------------------

  /**
   * Run the full low-stock/out-of-stock detection engine for a business.
   * Idempotent: safe to run multiple times; only creates/updates/resolves alerts.
   */
  async runAlertEngine(businessId: string) {
    const products = await this.db
      .select({
        id: schema.products.id,
        name: schema.products.name,
        minStock: schema.products.minStock,
        maxStock: schema.products.maxStock,
      })
      .from(schema.products)
      .where(
        and(eq(schema.products.businessId, businessId), isNull(schema.products.deletedAt)),
      );

    if (products.length === 0) {
      return { processed: 0, created: 0, updated: 0, resolved: 0 };
    }

    const productIds = products.map((p) => p.id);

    const branches = await this.db
      .select({ id: schema.branches.id, name: schema.branches.name })
      .from(schema.branches)
      .where(eq(schema.branches.businessId, businessId));

    // Per-branch thresholds (explicit overrides only)
    const thresholds = await this.db
      .select()
      .from(schema.branchStockThresholds)
      .where(eq(schema.branchStockThresholds.businessId, businessId));

    const thresholdMap = new Map<string, { minStock: number; maxStock: number }>();
    for (const t of thresholds) {
      thresholdMap.set(`${t.productId}|${t.branchId}`, {
        minStock: parseFloat(t.minStock || '0'),
        maxStock: parseFloat(t.maxStock || '0'),
      });
    }

    // Global stock (sum across ALL locations, for the "needs purchase" signal)
    const globalStockRows = await this.db
      .select({
        productId: schema.stockLevels.productId,
        qty: sql<string>`COALESCE(SUM(${schema.stockLevels.quantity}), 0)::numeric`,
      })
      .from(schema.stockLevels)
      .where(inArray(schema.stockLevels.productId, productIds))
      .groupBy(schema.stockLevels.productId);

    const globalStockMap = new Map<string, number>();
    for (const r of globalStockRows) {
      globalStockMap.set(r.productId, parseFloat(r.qty || '0'));
    }

    // Branch-level stock (for the "needs requisition" signal)
    const branchStockMap = new Map<string, number>();
    if (branches.length > 0) {
      const branchIds = branches.map((b) => b.id);
      const branchStockRows = await this.db
        .select({
          productId: schema.stockLevels.productId,
          branchId: schema.stockLevels.branchId,
          qty: sql<string>`COALESCE(SUM(${schema.stockLevels.quantity}), 0)::numeric`,
        })
        .from(schema.stockLevels)
        .where(
          and(
            inArray(schema.stockLevels.productId, productIds),
            inArray(schema.stockLevels.branchId, branchIds),
          ),
        )
        .groupBy(schema.stockLevels.productId, schema.stockLevels.branchId);

      for (const r of branchStockRows) {
        branchStockMap.set(`${r.productId}|${r.branchId}`, parseFloat(r.qty || '0'));
      }
    }

    // Existing active alerts (dedup / resolve)
    const existingAlerts = await this.db
      .select()
      .from(schema.inventoryAlerts)
      .where(
        and(
          eq(schema.inventoryAlerts.businessId, businessId),
          sql`${schema.inventoryAlerts.status} IN ('active', 'acknowledged')`,
        ),
      );

    const existingGlobalMap = new Map<string, typeof existingAlerts[number]>();
    const existingBranchMap = new Map<string, typeof existingAlerts[number]>();
    for (const a of existingAlerts) {
      if (a.branchId) {
        existingBranchMap.set(`${a.productId}|${a.branchId}`, a);
      } else {
        existingGlobalMap.set(a.productId, a);
      }
    }

    let created = 0;
    let updated = 0;
    let resolved = 0;

    const upsertAlert = async (
      existing: any,
      input: {
        businessId: string;
        productId: string;
        branchId: string | null;
        alertType: string;
        threshold: string;
        currentQty: string;
      },
    ) => {
      if (existing) {
        await this.db
          .update(schema.inventoryAlerts)
          .set({
            alertType: input.alertType,
            threshold: input.threshold,
            currentQty: input.currentQty,
          })
          .where(eq(schema.inventoryAlerts.id, existing.id));
        updated++;
      } else {
        await this.db.insert(schema.inventoryAlerts).values({
          ...input,
          status: 'active',
        });
        created++;
      }
    };

    const resolveAlert = async (existing: any) => {
      await this.db
        .update(schema.inventoryAlerts)
        .set({ status: 'resolved', resolvedAt: new Date() })
        .where(eq(schema.inventoryAlerts.id, existing.id));
      resolved++;
    };

    // 1. GLOBAL alerts (needs purchase) — global stock vs products.minStock
    for (const product of products) {
      const globalMin = parseFloat(product.minStock || '0');
      const globalQty = globalStockMap.get(product.id) ?? 0;
      const existing = existingGlobalMap.get(product.id);

      if (globalMin > 0 && globalQty < globalMin) {
        await upsertAlert(existing, {
          businessId,
          productId: product.id,
          branchId: null,
          alertType: globalQty <= 0 ? 'out_of_stock' : 'low_stock',
          threshold: globalMin.toString(),
          currentQty: globalQty.toString(),
        });
      } else if (existing) {
        await resolveAlert(existing);
      }
    }

    // 2. BRANCH alerts (needs requisition) — only for explicit per-branch thresholds
    for (const [key, thr] of thresholdMap.entries()) {
      if (thr.minStock <= 0) continue;
      const [productId, branchId] = key.split('|');
      const branchQty = branchStockMap.get(key) ?? 0;
      const existing = existingBranchMap.get(key);

      if (branchQty < thr.minStock) {
        await upsertAlert(existing, {
          businessId,
          productId,
          branchId,
          alertType: branchQty <= 0 ? 'out_of_stock' : 'low_stock',
          threshold: thr.minStock.toString(),
          currentQty: branchQty.toString(),
        });
      } else if (existing) {
        await resolveAlert(existing);
      }
    }

    // 3. Resolve any branch alert whose threshold was removed (no longer has a threshold)
    for (const [key, existing] of existingBranchMap.entries()) {
      const thr = thresholdMap.get(key);
      if (!thr || thr.minStock <= 0) {
        await resolveAlert(existing);
      }
    }

    return { processed: products.length, created, updated, resolved };
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async list(businessId: string, branchId?: string, status?: string) {
    const conditions = [eq(schema.inventoryAlerts.businessId, businessId)];
    if (branchId) conditions.push(eq(schema.inventoryAlerts.branchId, branchId));
    if (status) conditions.push(eq(schema.inventoryAlerts.status, status));

    const alerts = await this.db
      .select({
        id: schema.inventoryAlerts.id,
        productId: schema.inventoryAlerts.productId,
        branchId: schema.inventoryAlerts.branchId,
        alertType: schema.inventoryAlerts.alertType,
        threshold: schema.inventoryAlerts.threshold,
        currentQty: schema.inventoryAlerts.currentQty,
        status: schema.inventoryAlerts.status,
        createdAt: schema.inventoryAlerts.createdAt,
        resolvedAt: schema.inventoryAlerts.resolvedAt,
        productName: schema.products.name,
        productSku: schema.products.sku,
        branchName: schema.branches.name,
      })
      .from(schema.inventoryAlerts)
      .innerJoin(schema.products, eq(schema.inventoryAlerts.productId, schema.products.id))
      .leftJoin(schema.branches, eq(schema.inventoryAlerts.branchId, schema.branches.id))
      .where(and(...conditions))
      .orderBy(desc(schema.inventoryAlerts.createdAt));

    return alerts;
  }

  async getSummary(businessId: string, branchId?: string) {
    await this.runAlertEngine(businessId);

    const alerts = await this.list(businessId, branchId);

    const active = alerts.filter((a) => a.status === 'active' || a.status === 'acknowledged');
    const globalActive = active.filter((a) => !a.branchId);
    const branchActive = active.filter((a) => a.branchId);

    const pendingRequisitions = await this.countPendingRequisitions(businessId);
    const draftPos = await this.countDraftPos(businessId);

    return {
      summary: {
        outOfStock: globalActive.filter((a) => a.alertType === 'out_of_stock').length,
        lowStock: globalActive.filter((a) => a.alertType === 'low_stock').length,
        branchAlerts: branchActive.length,
        totalAlerts: active.length,
        pendingRequisitions,
        draftPurchaseOrders: draftPos,
      },
      alerts,
    };
  }

  private async countPendingRequisitions(businessId: string) {
    const rows = await this.db
      .select({ c: sql<string>`count(*)::int` })
      .from(schema.branchRequisitions)
      .where(
        and(
          eq(schema.branchRequisitions.businessId, businessId),
          eq(schema.branchRequisitions.status, 'pending'),
        ),
      );
    return Number(rows[0]?.c ?? 0);
  }

  private async countDraftPos(businessId: string) {
    const rows = await this.db
      .select({ c: sql<string>`count(*)::int` })
      .from(schema.purchaseOrders)
      .where(
        and(
          eq(schema.purchaseOrders.businessId, businessId),
          eq(schema.purchaseOrders.status, 'draft'),
        ),
      );
    return Number(rows[0]?.c ?? 0);
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async acknowledge(id: string, userId: string) {
    const [alert] = await this.db
      .select()
      .from(schema.inventoryAlerts)
      .where(eq(schema.inventoryAlerts.id, id))
      .limit(1);
    if (!alert) throw new NotFoundException('Alerta no encontrada');

    const [updated] = await this.db
      .update(schema.inventoryAlerts)
      .set({ status: 'acknowledged', acknowledgedAt: new Date(), acknowledgedBy: userId })
      .where(eq(schema.inventoryAlerts.id, id))
      .returning();
    return updated;
  }

  /**
   * One-click requisition from an alert: replenish up to effective maxStock.
   */
  async generateRequisition(alertId: string, userId: string) {
    const [alert] = await this.db
      .select()
      .from(schema.inventoryAlerts)
      .where(eq(schema.inventoryAlerts.id, alertId))
      .limit(1);

    if (!alert) throw new NotFoundException('Alerta no encontrada');

    if (!alert.branchId) {
      throw new BadRequestException(
        'Esta alerta es global (compra sugerida). Use "Generar OC" en su lugar.',
      );
    }
    const branchId: string = alert.branchId;

    const [product] = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, alert.productId))
      .limit(1);

    if (!product) throw new NotFoundException('Producto no encontrado');

    // Determine default warehouse
    const warehouse = await this.resolveDefaultWarehouse(alert.businessId);
    if (!warehouse) {
      throw new BadRequestException('No hay una bodega configurada para este negocio.');
    }

    // Skip if an open requisition already exists for the same product+branch
    const [existingReq] = await this.db
      .select()
      .from(schema.branchRequisitions)
      .where(
        and(
          eq(schema.branchRequisitions.businessId, alert.businessId),
          eq(schema.branchRequisitions.fromBranchId, branchId),
          eq(schema.branchRequisitions.toWarehouseId, warehouse.id),
          eq(schema.branchRequisitions.status, 'pending'),
        ),
      )
      .limit(1);

    if (existingReq) {
      // Optionally update quantity; for simplicity return the existing requisition.
      const [existingItem] = await this.db
        .select()
        .from(schema.branchRequisitionItems)
        .where(eq(schema.branchRequisitionItems.requisitionId, existingReq.id))
        .limit(1);
      return { requisitionId: existingReq.id, skipped: true, existingItem: existingItem ?? null };
    }

    const thr = await this.thresholdsService.getEffectiveThreshold(
      product.id,
      branchId,
      parseFloat(product.minStock || '0'),
      parseFloat(product.maxStock || '0'),
    );

    let qty = thr.maxStock - parseFloat(alert.currentQty || '0');
    if (qty <= 0) {
      qty = thr.minStock > 0 ? thr.minStock * 2 : 1;
    }

    return this.db.transaction(async (tx) => {
      const [requisition] = await tx
        .insert(schema.branchRequisitions)
        .values({
          businessId: alert.businessId,
          fromBranchId: branchId,
          toWarehouseId: warehouse.id,
          createdBy: userId,
          status: 'pending',
          notes: `Generada desde alerta de inventario (${alert.alertType})`,
        })
        .returning();

      await tx.insert(schema.branchRequisitionItems).values({
        requisitionId: requisition.id,
        productId: alert.productId,
        quantityRequested: qty.toFixed(3),
      });

      return { requisitionId: requisition.id, quantityRequested: qty };
    });
  }

  /**
   * One-click draft purchase order from an alert (global low stock).
   */
  async generatePurchaseOrder(alertId: string, userId: string) {
    const [alert] = await this.db
      .select()
      .from(schema.inventoryAlerts)
      .where(eq(schema.inventoryAlerts.id, alertId))
      .limit(1);

    if (!alert) throw new NotFoundException('Alerta no encontrada');

    const [product] = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, alert.productId))
      .limit(1);

    if (!product) throw new NotFoundException('Producto no encontrado');

    const provider = await this.resolveCheapestProvider(alert.productId);
    if (!provider) {
      throw new BadRequestException('Producto sin proveedor registrado.');
    }

    const warehouse = await this.resolveDefaultWarehouse(alert.businessId);

    const globalStock = await this.getGlobalStock(alert.productId);
    const globalMin = parseFloat(product.minStock || '0');
    const globalMax = parseFloat(product.maxStock || '0');
    let qty = globalMax - globalStock;
    if (qty <= 0) qty = globalMin > 0 ? globalMin * 2 : 1;

    return this.db.transaction(async (tx) => {
      const [po] = await tx
        .insert(schema.purchaseOrders)
        .values({
          businessId: alert.businessId,
          providerId: provider.providerId,
          warehouseId: warehouse ? warehouse.id : null,
          poNumber: await this.nextPoNumber(tx, alert.businessId),
          status: 'draft',
          createdBy: userId,
          notes: `Generada desde alerta de inventario (${alert.alertType})`,
        })
        .returning();

      await tx.insert(schema.purchaseOrderItems).values({
        poId: po.id,
        productId: alert.productId,
        quantityOrdered: qty.toFixed(3),
        unitCostEstimated: provider.cost,
      });

      return { purchaseOrderId: po.id, poNumber: po.poNumber, quantityOrdered: qty };
    });
  }

  // ---------------------------------------------------------------------------
  // Auto-PO engine (global minimums, grouped by provider)
  // ---------------------------------------------------------------------------

  async runAutoPoEngine(businessId: string, userId: string) {
    // Products below global minimum
    const rows = await this.db.execute(sql`
      SELECT p.id AS product_id, p.min_stock, p.max_stock,
             COALESCE(SUM(sl.quantity), 0)::numeric AS total_stock
      FROM products p
      LEFT JOIN stock_levels sl ON sl.product_id = p.id
      WHERE p.business_id = ${businessId}
        AND p.deleted_at IS NULL
        AND p.min_stock::numeric > 0
      GROUP BY p.id, p.min_stock, p.max_stock
      HAVING COALESCE(SUM(sl.quantity), 0) < p.min_stock
    `);

    const lowProducts = (rows.rows as any[]).map((r) => ({
      productId: r.product_id,
      minStock: parseFloat(r.min_stock || '0'),
      maxStock: parseFloat(r.max_stock || '0'),
      totalStock: parseFloat(r.total_stock || '0'),
    }));

    const created: string[] = [];

    for (const lp of lowProducts) {
      const provider = await this.resolveCheapestProvider(lp.productId);
      if (!provider) continue;

      // Check existing draft PO for same product
      const [existingPo] = await this.db
        .select()
        .from(schema.purchaseOrders)
        .where(
          and(
            eq(schema.purchaseOrders.businessId, businessId),
            eq(schema.purchaseOrders.status, 'draft'),
          ),
        )
        .limit(1);

      let qty = lp.maxStock - lp.totalStock;
      if (qty <= 0) qty = lp.minStock > 0 ? lp.minStock * 2 : 1;

      if (existingPo) {
        // Update existing draft PO item quantity (skip duplicate)
        continue;
      }

      const warehouse = await this.resolveDefaultWarehouse(businessId);

      const [po] = await this.db
        .insert(schema.purchaseOrders)
        .values({
          businessId,
          providerId: provider.providerId,
          warehouseId: warehouse ? warehouse.id : null,
          poNumber: await this.nextPoNumber(this.db, businessId),
          status: 'draft',
          createdBy: userId,
          notes: 'Generada automáticamente por stock global bajo el mínimo.',
        })
        .returning();

      await this.db.insert(schema.purchaseOrderItems).values({
        poId: po.id,
        productId: lp.productId,
        quantityOrdered: qty.toFixed(3),
        unitCostEstimated: provider.cost,
      });

      created.push(po.id);
    }

    return { created: created.length, purchaseOrderIds: created };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async resolveDefaultWarehouse(businessId: string) {
    const [settings] = await this.db
      .select()
      .from(schema.businessInventorySettings)
      .where(eq(schema.businessInventorySettings.businessId, businessId))
      .limit(1);

    if (settings?.defaultWarehouseId) {
      const [wh] = await this.db
        .select()
        .from(schema.warehouses)
        .where(eq(schema.warehouses.id, settings.defaultWarehouseId))
        .limit(1);
      if (wh) return wh;
    }

    const [wh] = await this.db
      .select()
      .from(schema.warehouses)
      .where(
        and(eq(schema.warehouses.businessId, businessId), eq(schema.warehouses.isActive, true)),
      )
      .limit(1);
    if (wh) return wh;

    const [anyWh] = await this.db
      .select()
      .from(schema.warehouses)
      .where(eq(schema.warehouses.businessId, businessId))
      .limit(1);
    return anyWh ?? null;
  }

  private async resolveCheapestProvider(productId: string) {
    const rows = await this.db
      .select({
        providerId: schema.supplierProducts.providerId,
        cost: schema.supplierProducts.cost,
      })
      .from(schema.supplierProducts)
      .where(eq(schema.supplierProducts.productId, productId))
      .orderBy(schema.supplierProducts.cost);

    if (rows.length > 0) {
      return rows[0];
    }

    // Fallback: use the product's primary provider (products.providerId)
    const [product] = await this.db
      .select({ providerId: schema.products.providerId, cost: schema.products.cost })
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);

    if (product?.providerId) {
      return { providerId: product.providerId, cost: product.cost ?? '0.00' };
    }

    return null;
  }

  private async getGlobalStock(productId: string) {
    const rows = await this.db
      .select({ qty: sql<string>`COALESCE(SUM(${schema.stockLevels.quantity}), 0)::numeric` })
      .from(schema.stockLevels)
      .where(eq(schema.stockLevels.productId, productId));
    return parseFloat(rows[0]?.qty ?? '0');
  }

  private async nextPoNumber(db: any, businessId: string): Promise<string> {
    const rows = await db
      .select({ poNumber: schema.purchaseOrders.poNumber })
      .from(schema.purchaseOrders)
      .where(eq(schema.purchaseOrders.businessId, businessId));

    const maxNum = rows.reduce((max: number, r: any) => {
      const m = String(r.poNumber || '').match(/(\d+)\s*$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);

    return `OC-${String(maxNum + 1).padStart(4, '0')}`;
  }
}
