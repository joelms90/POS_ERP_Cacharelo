import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, or, inArray, desc, sql, isNull } from 'drizzle-orm';
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

  private inFlightEngine = new Map<
    string,
    Promise<{ processed: number; created: number; updated: number; resolved: number }>
  >();

  /**
   * Run the full low-stock/out-of-stock detection engine for a business.
   * Idempotent: safe to run multiple times; only creates/updates/resolves alerts.
   * Concurrent calls for the same business share the in-flight execution promise.
   */
  async runAlertEngine(businessId: string) {
    const existing = this.inFlightEngine.get(businessId);
    if (existing) {
      return await existing;
    }

    const runPromise = this.executeAlertEngine(businessId);
    this.inFlightEngine.set(businessId, runPromise);
    try {
      return await runPromise;
    } finally {
      this.inFlightEngine.delete(businessId);
    }
  }

  private async executeAlertEngine(businessId: string) {
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

    const warehouses = await this.db
      .select({ id: schema.warehouses.id, name: schema.warehouses.name })
      .from(schema.warehouses)
      .where(
        and(eq(schema.warehouses.businessId, businessId), eq(schema.warehouses.isActive, true)),
      );

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

    // Per-warehouse thresholds (explicit overrides / minimums)
    const warehouseThresholds = await this.db
      .select()
      .from(schema.warehouseStockThresholds)
      .where(eq(schema.warehouseStockThresholds.businessId, businessId));

    const warehouseThresholdMap = new Map<string, { minStock: number; maxStock: number }>();
    for (const t of warehouseThresholds) {
      warehouseThresholdMap.set(`${t.productId}|${t.warehouseId}`, {
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
        if (r.branchId) {
          branchStockMap.set(`${r.productId}|${r.branchId}`, parseFloat(r.qty || '0'));
        }
      }
    }

    // Warehouse-level stock
    const warehouseStockMap = new Map<string, number>();
    if (warehouses.length > 0) {
      const warehouseIds = warehouses.map((w) => w.id);
      const warehouseStockRows = await this.db
        .select({
          productId: schema.stockLevels.productId,
          warehouseId: schema.stockLevels.warehouseId,
          qty: sql<string>`COALESCE(SUM(${schema.stockLevels.quantity}), 0)::numeric`,
        })
        .from(schema.stockLevels)
        .where(
          and(
            inArray(schema.stockLevels.productId, productIds),
            inArray(schema.stockLevels.warehouseId, warehouseIds),
          ),
        )
        .groupBy(schema.stockLevels.productId, schema.stockLevels.warehouseId);

      for (const r of warehouseStockRows) {
        if (r.warehouseId) {
          warehouseStockMap.set(`${r.productId}|${r.warehouseId}`, parseFloat(r.qty || '0'));
        }
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
    const existingWarehouseMap = new Map<string, typeof existingAlerts[number]>();
    for (const a of existingAlerts) {
      if (a.warehouseId) {
        existingWarehouseMap.set(`${a.productId}|${a.warehouseId}`, a);
      } else if (a.branchId) {
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
        warehouseId: string | null;
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
        try {
          await this.db.insert(schema.inventoryAlerts).values({
            ...input,
            status: 'active',
          });
          created++;
        } catch (err: any) {
          const pgCode = err?.code || err?.cause?.code;
          if (pgCode === '23505') {
            // Concurrent execution already inserted the active alert. Fall back to update.
            let condition;
            if (input.warehouseId) {
              condition = and(
                eq(schema.inventoryAlerts.productId, input.productId),
                eq(schema.inventoryAlerts.warehouseId, input.warehouseId),
                sql`${schema.inventoryAlerts.status} IN ('active', 'acknowledged')`,
              );
            } else if (input.branchId) {
              condition = and(
                eq(schema.inventoryAlerts.productId, input.productId),
                eq(schema.inventoryAlerts.branchId, input.branchId),
                sql`${schema.inventoryAlerts.status} IN ('active', 'acknowledged')`,
              );
            } else {
              condition = and(
                eq(schema.inventoryAlerts.productId, input.productId),
                isNull(schema.inventoryAlerts.branchId),
                isNull(schema.inventoryAlerts.warehouseId),
                sql`${schema.inventoryAlerts.status} IN ('active', 'acknowledged')`,
              );
            }

            await this.db
              .update(schema.inventoryAlerts)
              .set({
                alertType: input.alertType,
                threshold: input.threshold,
                currentQty: input.currentQty,
              })
              .where(condition);
            updated++;
          } else {
            throw err;
          }
        }
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
          warehouseId: null,
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
          warehouseId: null,
          alertType: branchQty <= 0 ? 'out_of_stock' : 'low_stock',
          threshold: thr.minStock.toString(),
          currentQty: branchQty.toString(),
        });
      } else if (existing) {
        await resolveAlert(existing);
      }
    }

    // 3. WAREHOUSE alerts (needs purchase / production) — for explicit per-warehouse thresholds
    for (const [key, thr] of warehouseThresholdMap.entries()) {
      if (thr.minStock <= 0) continue;
      const [productId, warehouseId] = key.split('|');
      const whQty = warehouseStockMap.get(key) ?? 0;
      const existing = existingWarehouseMap.get(key);

      if (whQty < thr.minStock) {
        await upsertAlert(existing, {
          businessId,
          productId,
          branchId: null,
          warehouseId,
          alertType: whQty <= 0 ? 'out_of_stock' : 'low_stock',
          threshold: thr.minStock.toString(),
          currentQty: whQty.toString(),
        });
      } else if (existing) {
        await resolveAlert(existing);
      }
    }

    // 4. Resolve any branch alert whose threshold was removed (no longer has a threshold)
    for (const [key, existing] of existingBranchMap.entries()) {
      const thr = thresholdMap.get(key);
      if (!thr || thr.minStock <= 0) {
        await resolveAlert(existing);
      }
    }

    // 5. Resolve any warehouse alert whose threshold was removed (no longer has a threshold)
    for (const [key, existing] of existingWarehouseMap.entries()) {
      const thr = warehouseThresholdMap.get(key);
      if (!thr || thr.minStock <= 0) {
        await resolveAlert(existing);
      }
    }

    return { processed: products.length, created, updated, resolved };
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async list(
    businessId: string,
    filterOrBranchId?: string | { branchId?: string; warehouseId?: string; locationId?: string; status?: string },
    statusParam?: string,
  ) {
    let branchId: string | undefined;
    let warehouseId: string | undefined;
    let locationId: string | undefined;
    let status: string | undefined = statusParam;

    if (typeof filterOrBranchId === 'object' && filterOrBranchId !== null) {
      branchId = filterOrBranchId.branchId;
      warehouseId = filterOrBranchId.warehouseId;
      locationId = filterOrBranchId.locationId;
      if (filterOrBranchId.status) status = filterOrBranchId.status;
    } else if (typeof filterOrBranchId === 'string') {
      branchId = filterOrBranchId;
    }

    const conditions = [eq(schema.inventoryAlerts.businessId, businessId)];

    if (warehouseId) {
      conditions.push(eq(schema.inventoryAlerts.warehouseId, warehouseId));
    } else if (locationId) {
      conditions.push(
        or(
          eq(schema.inventoryAlerts.branchId, locationId),
          eq(schema.inventoryAlerts.warehouseId, locationId),
        )!,
      );
    } else if (branchId) {
      // Support either branchId or warehouseId passed in branchId
      conditions.push(
        or(
          eq(schema.inventoryAlerts.branchId, branchId),
          eq(schema.inventoryAlerts.warehouseId, branchId),
        )!,
      );
    }

    if (status) {
      conditions.push(eq(schema.inventoryAlerts.status, status));
    }

    const alerts = await this.db
      .select({
        id: schema.inventoryAlerts.id,
        productId: schema.inventoryAlerts.productId,
        branchId: schema.inventoryAlerts.branchId,
        warehouseId: schema.inventoryAlerts.warehouseId,
        alertType: schema.inventoryAlerts.alertType,
        threshold: schema.inventoryAlerts.threshold,
        currentQty: schema.inventoryAlerts.currentQty,
        status: schema.inventoryAlerts.status,
        createdAt: schema.inventoryAlerts.createdAt,
        resolvedAt: schema.inventoryAlerts.resolvedAt,
        productName: schema.products.name,
        productSku: schema.products.sku,
        itemType: schema.products.itemType,
        providerId: schema.products.providerId,
        branchName: schema.branches.name,
        warehouseName: schema.warehouses.name,
      })
      .from(schema.inventoryAlerts)
      .innerJoin(schema.products, eq(schema.inventoryAlerts.productId, schema.products.id))
      .leftJoin(schema.branches, eq(schema.inventoryAlerts.branchId, schema.branches.id))
      .leftJoin(schema.warehouses, eq(schema.inventoryAlerts.warehouseId, schema.warehouses.id))
      .where(and(...conditions))
      .orderBy(desc(schema.inventoryAlerts.createdAt));

    // For branch alerts, compute how much stock is available elsewhere (to transfer)
    const branchProductIds = alerts
      .filter((a) => a.branchId)
      .map((a) => a.productId);

    const globalStockMap = new Map<string, number>();
    if (branchProductIds.length > 0) {
      const rows = await this.db
        .select({
          productId: schema.stockLevels.productId,
          qty: sql<string>`COALESCE(SUM(${schema.stockLevels.quantity}), 0)::numeric`,
        })
        .from(schema.stockLevels)
        .where(inArray(schema.stockLevels.productId, branchProductIds))
        .groupBy(schema.stockLevels.productId);

      for (const r of rows) {
        globalStockMap.set(r.productId, parseFloat(r.qty || '0'));
      }
    }

    return alerts.map((a) => {
      let locationType: 'global' | 'branch' | 'warehouse' = 'global';
      let locationName = 'Global';
      if (a.warehouseId) {
        locationType = 'warehouse';
        locationName = a.warehouseName || 'Bodega';
      } else if (a.branchId) {
        locationType = 'branch';
        locationName = a.branchName || 'Sucursal';
      }

      if (!a.branchId && !a.warehouseId) {
        return { ...a, locationType, locationName, hasProvider: !!a.providerId, transferableQty: null };
      }
      if (a.warehouseId) {
        return { ...a, locationType, locationName, hasProvider: !!a.providerId, transferableQty: null };
      }
      const global = globalStockMap.get(a.productId) ?? 0;
      const branchQty = parseFloat(a.currentQty || '0');
      return {
        ...a,
        locationType,
        locationName,
        hasProvider: !!a.providerId,
        transferableQty: Math.max(0, global - branchQty),
      };
    });
  }

  async getSummary(
    businessId: string,
    filterOrBranchId?: string | { branchId?: string; warehouseId?: string; locationId?: string },
  ) {
    await this.runAlertEngine(businessId);

    const alerts = await this.list(businessId, filterOrBranchId);

    const active = alerts.filter((a) => a.status === 'active' || a.status === 'acknowledged');
    const globalActive = active.filter((a) => !a.branchId && !a.warehouseId);
    const branchActive = active.filter((a) => !!a.branchId);
    const warehouseActive = active.filter((a) => !!a.warehouseId);

    const pendingRequisitions = await this.countPendingRequisitions(businessId);
    const draftPos = await this.countDraftPos(businessId);

    return {
      summary: {
        outOfStock: active.filter((a) => a.alertType === 'out_of_stock').length,
        lowStock: active.filter((a) => a.alertType === 'low_stock').length,
        globalAlerts: globalActive.length,
        branchAlerts: branchActive.length,
        warehouseAlerts: warehouseActive.length,
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

    // Requisition only makes sense if there is stock elsewhere to transfer
    const globalStock = await this.getGlobalStock(alert.productId);
    const branchQty = parseFloat(alert.currentQty || '0');
    if (globalStock - branchQty <= 0) {
      throw new BadRequestException(
        'No hay stock disponible para traspasar. Genere una Orden de Compra en su lugar.',
      );
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
   * One-click draft purchase order from an alert (global or warehouse low stock).
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

    let warehouse: any = null;
    let minStock = parseFloat(product.minStock || '0');
    let maxStock = parseFloat(product.maxStock || '0');
    let currentStock = await this.getGlobalStock(alert.productId);

    if (alert.warehouseId) {
      const [wh] = await this.db
        .select()
        .from(schema.warehouses)
        .where(eq(schema.warehouses.id, alert.warehouseId))
        .limit(1);
      warehouse = wh ?? null;

      const [whThr] = await this.db
        .select()
        .from(schema.warehouseStockThresholds)
        .where(
          and(
            eq(schema.warehouseStockThresholds.warehouseId, alert.warehouseId),
            eq(schema.warehouseStockThresholds.productId, alert.productId),
          ),
        )
        .limit(1);
      if (whThr) {
        if (parseFloat(whThr.minStock || '0') > 0) minStock = parseFloat(whThr.minStock || '0');
        if (parseFloat(whThr.maxStock || '0') > 0) maxStock = parseFloat(whThr.maxStock || '0');
      }
      currentStock = parseFloat(alert.currentQty || '0');
    } else {
      warehouse = await this.resolveDefaultWarehouse(alert.businessId);
    }

    let qty = maxStock - currentStock;
    if (qty <= 0) qty = minStock > 0 ? minStock * 2 : 1;

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
          notes: alert.warehouseId && warehouse
            ? `Generada desde alerta de inventario (Bodega: ${warehouse.name})`
            : `Generada desde alerta de inventario (${alert.alertType})`,
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

  /**
   * Bulk: create draft purchase orders from a selection of (global or warehouse) alerts,
   * grouping products by provider and destination warehouse into draft OCs.
   */
  async generatePurchaseOrders(alertIds: string[], userId: string) {
    if (!alertIds || alertIds.length === 0) {
      throw new BadRequestException('Seleccione al menos una alerta.');
    }

    const alerts = await this.db
      .select()
      .from(schema.inventoryAlerts)
      .where(inArray(schema.inventoryAlerts.id, alertIds));

    if (alerts.length === 0) {
      throw new NotFoundException('No se encontraron alertas seleccionadas.');
    }

    const businessId = alerts[0].businessId;
    const poAlerts = alerts.filter((a) => !a.branchId);

    const items: Array<{ productId: string; quantity: number; warehouseId?: string | null }> = [];
    for (const alert of poAlerts) {
      const [product] = await this.db
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, alert.productId))
        .limit(1);
      if (!product) continue;

      let minStock = parseFloat(product.minStock || '0');
      let maxStock = parseFloat(product.maxStock || '0');
      let currentStock = await this.getGlobalStock(alert.productId);

      if (alert.warehouseId) {
        const [whThr] = await this.db
          .select()
          .from(schema.warehouseStockThresholds)
          .where(
            and(
              eq(schema.warehouseStockThresholds.warehouseId, alert.warehouseId),
              eq(schema.warehouseStockThresholds.productId, alert.productId),
            ),
          )
          .limit(1);
        if (whThr) {
          if (parseFloat(whThr.minStock || '0') > 0) minStock = parseFloat(whThr.minStock || '0');
          if (parseFloat(whThr.maxStock || '0') > 0) maxStock = parseFloat(whThr.maxStock || '0');
        }
        currentStock = parseFloat(alert.currentQty || '0');
      }

      let qty = maxStock - currentStock;
      if (qty <= 0) qty = minStock > 0 ? minStock * 2 : 1;

      items.push({ productId: alert.productId, quantity: qty, warehouseId: alert.warehouseId || null });
    }

    return this.createPurchaseOrdersForProducts(
      businessId,
      userId,
      items,
      'Generada desde alertas de inventario (selección múltiple)',
    );
  }

  /**
   * Create draft purchase orders from explicit product IDs + quantities
   * (e.g. missing ingredients from a production/assembly run), grouped by provider.
   */
  async generatePurchaseOrdersByProducts(
    businessId: string,
    userId: string,
    items: Array<{ productId: string; quantity: number; warehouseId?: string | null }>,
  ) {
    return this.createPurchaseOrdersForProducts(
      businessId,
      userId,
      items,
      'Generada desde Ensamble (insumos faltantes)',
    );
  }

  private async createPurchaseOrdersForProducts(
    businessId: string,
    userId: string,
    items: Array<{ productId: string; quantity: number; warehouseId?: string | null }>,
    notes: string,
  ) {
    if (!items || items.length === 0) {
      throw new BadRequestException('No hay productos para generar la orden de compra.');
    }

    const defaultWarehouse = await this.resolveDefaultWarehouse(businessId);

    const itemsByGroup = new Map<
      string,
      {
        providerId: string;
        warehouseId: string | null;
        items: Array<{ productId: string; qty: number; cost: string }>;
      }
    >();
    const skipped: string[] = [];

    for (const it of items) {
      if (!it.quantity || it.quantity <= 0) continue;

      const provider = await this.resolveCheapestProvider(it.productId);
      if (!provider) {
        skipped.push(it.productId);
        continue;
      }

      const targetWarehouseId = it.warehouseId || defaultWarehouse?.id || null;
      const groupKey = `${provider.providerId}|${targetWarehouseId || 'none'}`;

      let group = itemsByGroup.get(groupKey);
      if (!group) {
        group = {
          providerId: provider.providerId,
          warehouseId: targetWarehouseId,
          items: [],
        };
        itemsByGroup.set(groupKey, group);
      }

      group.items.push({ productId: it.productId, qty: it.quantity, cost: provider.cost });
    }

    if (itemsByGroup.size === 0) {
      throw new BadRequestException(
        'Ningún producto tiene un proveedor registrado.',
      );
    }

    const purchaseOrders: Array<{
      purchaseOrderId: string;
      poNumber: string;
      itemCount: number;
    }> = [];

    await this.db.transaction(async (tx) => {
      for (const group of itemsByGroup.values()) {
        const poNumber = await this.nextPoNumber(tx, businessId);
        const [po] = await tx
          .insert(schema.purchaseOrders)
          .values({
            businessId,
            providerId: group.providerId,
            warehouseId: group.warehouseId,
            poNumber,
            status: 'draft',
            createdBy: userId,
            notes,
          })
          .returning();

        await tx.insert(schema.purchaseOrderItems).values(
          group.items.map((it) => ({
            poId: po.id,
            productId: it.productId,
            quantityOrdered: it.qty.toFixed(3),
            unitCostEstimated: it.cost,
          })),
        );

        purchaseOrders.push({ purchaseOrderId: po.id, poNumber, itemCount: group.items.length });
      }
    });

    return { success: true, purchaseOrders, skipped };
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

    // Products already present in an existing draft PO (avoid duplicates)
    const existingItems = await this.db
      .select({ productId: schema.purchaseOrderItems.productId })
      .from(schema.purchaseOrderItems)
      .innerJoin(
        schema.purchaseOrders,
        eq(schema.purchaseOrderItems.poId, schema.purchaseOrders.id),
      )
      .where(
        and(
          eq(schema.purchaseOrders.businessId, businessId),
          eq(schema.purchaseOrders.status, 'draft'),
        ),
      );

    const alreadyOrdered = new Set(existingItems.map((i) => i.productId));

    // Resolve provider + quantity per product, grouped by provider
    const itemsByProvider = new Map<
      string,
      Array<{ productId: string; qty: number; cost: string }>
    >();
    const skipped: string[] = [];

    for (const lp of lowProducts) {
      if (alreadyOrdered.has(lp.productId)) continue;

      const provider = await this.resolveCheapestProvider(lp.productId);
      if (!provider) {
        skipped.push(lp.productId);
        continue;
      }

      let qty = lp.maxStock - lp.totalStock;
      if (qty <= 0) qty = lp.minStock > 0 ? lp.minStock * 2 : 1;

      const list = itemsByProvider.get(provider.providerId) || [];
      list.push({ productId: lp.productId, qty, cost: provider.cost });
      itemsByProvider.set(provider.providerId, list);
    }

    if (itemsByProvider.size === 0) {
      return { created: 0, purchaseOrderIds: [], skipped };
    }

    const warehouse = await this.resolveDefaultWarehouse(businessId);
    const created: string[] = [];

    await this.db.transaction(async (tx) => {
      for (const [providerId, items] of itemsByProvider.entries()) {
        const poNumber = await this.nextPoNumber(tx, businessId);
        const [po] = await tx
          .insert(schema.purchaseOrders)
          .values({
            businessId,
            providerId,
            warehouseId: warehouse ? warehouse.id : null,
            poNumber,
            status: 'draft',
            createdBy: userId,
            notes: 'Generada automáticamente por stock global bajo el mínimo.',
          })
          .returning();

        await tx.insert(schema.purchaseOrderItems).values(
          items.map((it) => ({
            poId: po.id,
            productId: it.productId,
            quantityOrdered: it.qty.toFixed(3),
            unitCostEstimated: it.cost,
          })),
        );

        created.push(po.id);
      }
    });

    return { created: created.length, purchaseOrderIds: created, skipped };
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
    // po_number has a GLOBAL unique constraint, so the sequence must be global
    // (not per-business) to avoid collisions across businesses.
    const rows = await db
      .select({ poNumber: schema.purchaseOrders.poNumber })
      .from(schema.purchaseOrders);

    const maxNum = rows.reduce((max: number, r: any) => {
      const m = String(r.poNumber || '').match(/^OC-(\d+)$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);

    return `OC-${String(maxNum + 1).padStart(4, '0')}`;
  }
}
