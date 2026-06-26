import { Injectable, NotFoundException } from '@nestjs/common';
import { KitchenRepository } from './repositories/kitchen.repository';

@Injectable()
export class KitchenService {
  constructor(private readonly kitchenRepository: KitchenRepository) {}

  async findActiveTickets(branchId: string) {
    return this.kitchenRepository.findActiveTicketsByBranch(branchId);
  }

  async sendOrderToKitchen(orderId: string) {
    return this.kitchenRepository.createTicketsForOrder(orderId);
  }

  async updateTicketStatus(id: string, status: 'pending' | 'preparing' | 'ready' | 'served') {
    const ticket = await this.kitchenRepository.findTicketById(id);
    if (!ticket) {
      throw new NotFoundException(`Kitchen ticket with ID ${id} not found.`);
    }

    return this.kitchenRepository.updateTicketStatus(id, status);
  }
}
