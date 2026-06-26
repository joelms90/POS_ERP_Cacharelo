import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { OrdersRepository } from './repositories/orders.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { AddOrderItemsDto } from './dto/add-order-items.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  async create(createOrderDto: CreateOrderDto) {
    const { items, ...orderData } = createOrderDto;

    const itemsToInsert = items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
      assignedGuest: item.assignedGuest ?? 1,
      notes: item.notes || null,
      isSent: false,
    }));

    return this.ordersRepository.create(
      {
        ...orderData,
        state: 'open',
      },
      itemsToInsert,
    );
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

  async addItems(orderId: string, addOrderItemsDto: AddOrderItemsDto) {
    const order = await this.findOne(orderId);

    if (order.state !== 'open') {
      throw new ConflictException(`Cannot add items to an order in state: ${order.state}`);
    }

    const newItems = addOrderItemsDto.items;

    // Calculate new totals
    let addedSubtotal = 0;
    const itemsToInsert = newItems.map((item) => {
      addedSubtotal += parseFloat(item.price) * item.quantity;
      return {
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
    const currentTax = parseFloat(order.tax);

    const newSubtotalVal = currentSubtotal + addedSubtotal;
    // Recalculate tax (say, 16% IVA on the difference, or just keep tax proportional. Let's do simple: keep tax at 16% IVA on subtotal if not defined, or calculate simple total = subtotal - discount + tax)
    const newTaxVal = newSubtotalVal * 0.16; // 16% standard IVA
    const newTotalVal = newSubtotalVal - currentDiscount + newTaxVal;

    return this.ordersRepository.addItems(orderId, itemsToInsert, {
      subtotal: newSubtotalVal.toFixed(2),
      tax: newTaxVal.toFixed(2),
      total: newTotalVal.toFixed(2),
    });
  }

  async requestBilling(orderId: string) {
    const order = await this.findOne(orderId);
    if (order.state !== 'open') {
      throw new ConflictException(`Cannot request billing for an order in state: ${order.state}`);
    }

    return this.ordersRepository.updateOrderAndTableState(orderId, 'billing', 'billing');
  }

  async processPayment(orderId: string, createPaymentDto: CreatePaymentDto) {
    const order = await this.findOne(orderId);

    if (order.state === 'closed' || order.state === 'cancelled') {
      throw new ConflictException(`Cannot process payment for a ${order.state} order.`);
    }

    const { amount, paymentMethod, referenceCode } = createPaymentDto;

    return this.ordersRepository.createPayment(orderId, {
      orderId,
      amount,
      paymentMethod,
      referenceCode: referenceCode || null,
    });
  }
}
