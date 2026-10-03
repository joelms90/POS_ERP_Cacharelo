import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class OrdersAccessGuard implements CanActivate {
  constructor(@Inject(DRIZZLE_CONNECTION) private readonly db: NodePgDatabase<typeof schema>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const actor = req.user;
    if (!actor?.sub || !actor.businessId) throw new ForbiddenException();
    const management = ['owner', 'inventory_admin', 'support_tech'].includes(actor.role);
    if (req.route?.path === '/orders/active/business' || req.route?.path === '/api/orders/active/business') {
      if (!management || req.query.businessId !== actor.businessId) throw new ForbiddenException();
      return true;
    }
    let branchId = req.body?.branchId ?? req.query.branchId ?? actor.branchId;
    if (req.params.id) {
      const [order] = await this.db.select().from(schema.orders).where(eq(schema.orders.id, req.params.id));
      if (!order) throw new ForbiddenException();
      branchId = order.branchId;
    }
    if (!branchId || (!management && branchId !== actor.branchId)) throw new ForbiddenException();
    const [branch] = await this.db.select().from(schema.branches).where(eq(schema.branches.id, branchId));
    if (!branch || branch.businessId !== actor.businessId) throw new ForbiddenException();
    // Check referenced entities before allowing an order to mutate stock or tables.
    if (req.body?.tableId) {
      const [table] = await this.db.select().from(schema.branchTables).where(eq(schema.branchTables.id, req.body.tableId));
      if (!table || table.branchId !== branchId) throw new ForbiddenException();
    }
    if (req.body?.waiterId) {
      const [waiter] = await this.db.select().from(schema.users).where(eq(schema.users.id, req.body.waiterId));
      if (!waiter || waiter.businessId !== actor.businessId || waiter.branchId !== branchId) throw new ForbiddenException();
    }
    for (const item of req.body?.items ?? []) {
      const [product] = await this.db.select().from(schema.products).where(eq(schema.products.id, item.productId));
      if (!product || product.businessId !== actor.businessId) throw new ForbiddenException();
    }
    return true;
  }
}
