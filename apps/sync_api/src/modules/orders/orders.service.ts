import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { OrdersRepository } from './repositories/orders.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { AddOrderItemsDto } from './dto/add-order-items.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { SyncGateway } from '../sync/sync.gateway';
import { DRIZZLE_CONNECTION } from '../../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schema';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    @Inject(forwardRef(() => SyncGateway))
    private readonly syncGateway: SyncGateway,
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(createOrderDto: CreateOrderDto) {
    const { items, ...orderData } = createOrderDto;

    const itemsToInsert = items.map((item) => ({
      clientUuid: item.clientUuid || null,
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
      assignedGuest: item.assignedGuest ?? 1,
      notes: item.notes || null,
      isSent: false,
    }));

    const result = await this.ordersRepository.create(
      {
        ...orderData,
        state: 'open',
      },
      itemsToInsert,
    );

    // Broadcast table state change (occupied) and new order
    if (result.branchId) {
      this.syncGateway.broadcastChange(result.branchId, {
        tipo: 'cambio',
        changes: [
          { entity: 'orders', entityId: result.id, payload: { id: result.id, tableId: result.tableId, state: result.state } },
          { entity: 'branchTables', entityId: result.tableId, payload: { state: 'occupied' } }
        ]
      });
      this._logChanges(result.branchId, [
        { entity: 'orders', entityId: result.id, payload: { id: result.id, tableId: result.tableId, state: result.state } },
        { entity: 'branchTables', entityId: result.tableId, payload: { state: 'occupied' } },
      ]);
    }

    return result;
  }

  async findOne(id: string) {
    const order = await this.ordersRepository.findById(id);
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found.`);
    }
    return order;
  }

  async findActiveByBranch(branchId: string) {
    return this.ordersRepository.findActiveByBranch(branchId);
  }

  async findActiveByBusiness(businessId: string) {
    return this.ordersRepository.findActiveByBusiness(businessId);
  }

  async addItems(orderId: string, addOrderItemsDto: AddOrderItemsDto) {
    const order = await this.findOne(orderId);

    if (order.state !== 'open') {
      throw new ConflictException(`Cannot add items to an order in state: ${order.state}`);
    }

    let newItems = addOrderItemsDto.items;
    const clientUuids = newItems
      .map((item) => item.clientUuid)
      .filter((clientUuid): clientUuid is string => Boolean(clientUuid));
    if (clientUuids.length > 0) {
      const existingClientUuids = await this.ordersRepository.findExistingOrderItemClientUuids(
        orderId,
        clientUuids,
      );
      if (existingClientUuids.size > 0) {
        newItems = newItems.filter(
          (item) => !item.clientUuid || !existingClientUuids.has(item.clientUuid),
        );
      }
    }

    if (newItems.length === 0) {
      return order;
    }

    // Calculate new totals
    let addedSubtotal = 0;
    const itemsToInsert = newItems.map((item) => {
      addedSubtotal += parseFloat(item.price) * item.quantity;
      return {
        clientUuid: item.clientUuid || null,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        assignedGuest: item.assignedGuest ?? 1,
        notes: item.notes || null,
        isSent: false,
      };
    });

    const currentSubtotal = parseFloat(order.subtotal);
    const currentDiscount = parseFloat(order.discount);

    const newSubtotalVal = currentSubtotal + addedSubtotal;
    const newTaxVal = newSubtotalVal * 0.16;
    const newTotalVal = newSubtotalVal - currentDiscount + newTaxVal;

    const result = await this.ordersRepository.addItems(orderId, itemsToInsert, {
      subtotal: newSubtotalVal.toFixed(2),
      tax: newTaxVal.toFixed(2),
      total: newTotalVal.toFixed(2),
    });

    // Broadcast items update
    if (result.branchId) {
      this.syncGateway.broadcastChange(result.branchId, {
        tipo: 'cambio',
        changes: [
          { entity: 'orders', entityId: result.id, payload: { id: result.id, tableId: result.tableId, state: result.state } }
        ]
      });
    }

    return result;
  }

  async requestBilling(orderId: string) {
    const order = await this.findOne(orderId);
    if (order.state !== 'open') {
      throw new ConflictException(`Cannot request billing for an order in state: ${order.state}`);
    }

    const result = await this.ordersRepository.updateOrderAndTableState(orderId, 'billing', 'billing');

    // Broadcast table state change (billing)
    if (result.branchId) {
      this.syncGateway.broadcastChange(result.branchId, {
        tipo: 'cambio',
        changes: [
          { entity: 'orders', entityId: result.id, payload: { id: result.id, tableId: result.tableId, state: 'billing' } },
          { entity: 'branchTables', entityId: result.tableId, payload: { state: 'billing' } }
        ]
      });
    }

    return result;
  }

  async processPayment(orderId: string, createPaymentDto: CreatePaymentDto) {
    const order = await this.findOne(orderId);

    if (order.state === 'closed' || order.state === 'cancelled') {
      throw new ConflictException(`Cannot process payment for a ${order.state} order.`);
    }

    const { amount, paymentMethod, referenceCode, paidOrderItemIds } = createPaymentDto;

    const result = await this.ordersRepository.createPayment(orderId, {
      orderId,
      amount,
      paymentMethod,
      referenceCode: referenceCode || null,
      paidOrderItemIds,
    });

    // Broadcast payment state changes and table transitions (e.g. cleaning)
    if (order.branchId && result) {
      this.syncGateway.broadcastChange(order.branchId, {
        tipo: 'cambio',
        changes: [
          { entity: 'orders', entityId: order.id, payload: { id: order.id, tableId: order.tableId, state: result.orderState } },
          { entity: 'branchTables', entityId: order.tableId, payload: { state: result.tableState } }
        ]
      });
    }

    return result;
  }

  async cancelOrder(orderId: string, reason: string, actor: any) {
    const order = await this.findOne(orderId);
    if (!reason?.trim()) throw new BadRequestException('Debes indicar el motivo de la cancelación.');
    if (order.state === 'closed' || order.state === 'cancelled' || order.payments.length > 0) {
      throw new ConflictException(`Cannot cancel an order in state: ${order.state}`);
    }
    const roles = Array.isArray(actor.roles) ? actor.roles : [actor.role];
    const isManagement = roles.some((role: string) => ['owner', 'inventory_admin', 'support_tech'].includes(role));
    if (!isManagement && (!actor.branchId || actor.branchId !== order.branchId)) {
      throw new ForbiddenException('Solo puedes cancelar órdenes de tu sucursal.');
    }

    const result = await this.ordersRepository.cancelOrderWithAudit(orderId, reason.trim(), actor.sub);

    // Broadcast cancellation and table release (free)
    if (result.branchId) {
      this.syncGateway.broadcastChange(result.branchId, {
        tipo: 'cambio',
        changes: [
          { entity: 'orders', entityId: result.id, payload: { id: result.id, tableId: result.tableId, state: 'cancelled' } },
          { entity: 'branchTables', entityId: result.tableId, payload: { state: 'free' } }
        ]
      });
    }

    return result;
  }

  async getDailyPaymentSummary(actor: any, requestedDate?: string) {
    if (!actor.branchId) throw new ForbiddenException('El operador no tiene una sucursal asignada.');
    const date = requestedDate || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('La fecha debe tener formato AAAA-MM-DD.');
    return this.ordersRepository.getDailyPaymentSummary(actor.branchId, date);
  }

  private async _logChanges(branchId: string, entries: Array<{ entity: string; entityId: string; payload: any }>) {
    try {
      for (const entry of entries) {
        await this.db.insert(schema.changeLog).values({
          entity: entry.entity,
          entityId: entry.entityId,
          branchId: branchId,
          versionAt: new Date(),
          payload: entry.payload,
        });
      }
    } catch (e) {
      // Non-critical — broadcast is already done
    }
  }
}
