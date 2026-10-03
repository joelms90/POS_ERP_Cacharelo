import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_CONNECTION } from '../../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';

@Injectable()
export class KitchenRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findTicketById(id: string) {
    const results = await this.db
      .select()
      .from(schema.kitchenTickets)
      .where(eq(schema.kitchenTickets.id, id));
    return results[0] || null;
  }

  async findBranchIdForOrder(orderId: string): Promise<string | null> {
    const results = await this.db
      .select({ branchId: schema.orders.branchId })
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId));
    return results[0]?.branchId || null;
  }

  async findBranchIdForTicket(ticketId: string): Promise<string | null> {
    const results = await this.db
      .select({ branchId: schema.orders.branchId })
      .from(schema.kitchenTickets)
      .innerJoin(schema.orders, eq(schema.kitchenTickets.orderId, schema.orders.id))
      .where(eq(schema.kitchenTickets.id, ticketId));
    return results[0]?.branchId || null;
  }

  async findActiveTicketsByBranch(branchId: string) {
    // 1. Get all active kitchen tickets (status pending, preparing, ready)
    const tickets = await this.db
      .select({
        id: schema.kitchenTickets.id,
        orderId: schema.kitchenTickets.orderId,
        status: schema.kitchenTickets.status,
        station: schema.kitchenTickets.station,
        createdAt: schema.kitchenTickets.createdAt,
        startedAt: schema.kitchenTickets.startedAt,
        readyAt: schema.kitchenTickets.readyAt,
        tableLabel: schema.branchTables.label,
        tableName: schema.branchTables.room,
      })
      .from(schema.kitchenTickets)
      .innerJoin(schema.orders, eq(schema.kitchenTickets.orderId, schema.orders.id))
      .innerJoin(schema.branchTables, eq(schema.orders.tableId, schema.branchTables.id))
      .where(
        and(
          eq(schema.orders.branchId, branchId),
          sql`${schema.kitchenTickets.status} IN ('pending', 'preparing', 'ready')`,
        ),
      );

    // 2. For each ticket, fetch corresponding items
    const ticketsWithItems = [];
    for (const ticket of tickets) {
      const items = await this.db
        .select({
          id: schema.orderItems.id,
          productId: schema.orderItems.productId,
          quantity: schema.orderItems.quantity,
          price: schema.orderItems.price,
          assignedGuest: schema.orderItems.assignedGuest,
          notes: schema.orderItems.notes,
          productName: schema.products.name,
          categoryName: schema.categories.name,
          targetStation: schema.categories.targetStation,
        })
        .from(schema.orderItems)
        .innerJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
        .innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
        .where(
          and(
            eq(schema.orderItems.orderId, ticket.orderId),
            eq(schema.orderItems.isSent, true),
            isNull(schema.orderItems.deletedAt),
          ),
        );

      // Filter items matching the ticket station
      const filteredItems = items.filter((item) => {
        return this.resolveTargetStation(item.categoryName, item.targetStation) === ticket.station;
      });

      // Only add tickets that have items mapped to their station
      if (filteredItems.length > 0) {
        ticketsWithItems.push({
          ...ticket,
          items: filteredItems,
        });
      }
    }

    return ticketsWithItems;
  }

  private isBarraCategory(categoryName: string, targetStation?: string | null): boolean {
    if (targetStation === 'barra') return true;
    const name = categoryName.toLowerCase().trim();
    const barraKeywords = [
      'bebida', 'drinks', 'drink', 'café', 'cafe', 'té', 'te',
      'refresco', 'jugo', 'smoothie', 'frappe', 'agua', 'licor',
      'trago', 'barra'
    ];
    return barraKeywords.some((kw) => name.includes(kw));
  }

  /**
   * BR-KDS-001: a null/empty station is an explicit no-KDS choice.
   * BR-KDS-003: unknown legacy values retain name-based routing temporarily.
   */
  private resolveTargetStation(categoryName: string, targetStation?: string | null): 'cocina' | 'barra' | null {
    if (targetStation === null || targetStation === '') return null;
    // BR-KDS-002: an explicit station is the only destination for the item.
    if (targetStation === 'cocina' || targetStation === 'barra') return targetStation;
    return this.isBarraCategory(categoryName) ? 'barra' : 'cocina';
  }

  async createTicketsForOrder(orderId: string) {
    return this.db.transaction(async (tx) => {
      // 1. Find all unsent items for this order
      const unsentItems = await tx
        .select({
          id: schema.orderItems.id,
          productId: schema.orderItems.productId,
          quantity: schema.orderItems.quantity,
          categoryName: schema.categories.name,
          targetStation: schema.categories.targetStation,
        })
        .from(schema.orderItems)
        .innerJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
        .innerJoin(schema.categories, eq(schema.products.categoryId, schema.categories.id))
        .where(
          and(
            eq(schema.orderItems.orderId, orderId),
            eq(schema.orderItems.isSent, false),
            isNull(schema.orderItems.deletedAt),
          ),
        );

      if (unsentItems.length === 0) {
        return { message: 'No new items to send to kitchen.' };
      }

      // 2. Separate stations
      let hasCocina = false;
      let hasBarra = false;

      for (const item of unsentItems) {
        const station = this.resolveTargetStation(item.categoryName, item.targetStation);
        if (station === 'barra') {
          hasBarra = true;
        } else if (station === 'cocina') {
          hasCocina = true;
        }
      }

      const createdTickets = [];

      // 3. Create 'cocina' ticket if needed and not already existing active
      if (hasCocina) {
        const existingCocina = await tx
          .select()
          .from(schema.kitchenTickets)
          .where(
            and(
              eq(schema.kitchenTickets.orderId, orderId),
              eq(schema.kitchenTickets.station, 'cocina'),
              sql`${schema.kitchenTickets.status} IN ('pending', 'preparing')`,
            ),
          );

        if (existingCocina.length === 0) {
          const [t] = await tx
            .insert(schema.kitchenTickets)
            .values({
              orderId,
              station: 'cocina',
              status: 'pending',
              createdAt: new Date(),
            })
            .returning();
          createdTickets.push(t);
        }
      }

      // 4. Create 'barra' ticket if needed and not already existing active
      if (hasBarra) {
        const existingBarra = await tx
          .select()
          .from(schema.kitchenTickets)
          .where(
            and(
              eq(schema.kitchenTickets.orderId, orderId),
              eq(schema.kitchenTickets.station, 'barra'),
              sql`${schema.kitchenTickets.status} IN ('pending', 'preparing')`,
            ),
          );

        if (existingBarra.length === 0) {
          const [t] = await tx
            .insert(schema.kitchenTickets)
            .values({
              orderId,
              station: 'barra',
              status: 'pending',
              createdAt: new Date(),
            })
            .returning();
          createdTickets.push(t);
        }
      }

      // 5. Update items to isSent = true
      const itemIds = unsentItems.map((item) => item.id);
      for (const itemId of itemIds) {
        await tx
          .update(schema.orderItems)
          .set({ isSent: true, updatedAt: new Date() })
          .where(eq(schema.orderItems.id, itemId));
      }

      return {
        tickets: createdTickets,
        itemsUpdated: itemIds.length,
      };
    });
  }

  async updateTicketStatus(id: string, status: 'pending' | 'preparing' | 'ready' | 'served') {
    const updates: Partial<typeof schema.kitchenTickets.$inferInsert> = {
      status,
    };

    if (status === 'preparing') {
      updates.startedAt = new Date();
    } else if (status === 'ready') {
      updates.readyAt = new Date();
    } else if (status === 'served') {
      updates.servedAt = new Date();
    }

    const [updated] = await this.db
      .update(schema.kitchenTickets)
      .set(updates)
      .where(eq(schema.kitchenTickets.id, id))
      .returning();

    return updated;
  }
}
