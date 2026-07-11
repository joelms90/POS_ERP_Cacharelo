import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { KitchenRepository } from './repositories/kitchen.repository';
import { SyncGateway } from '../sync/sync.gateway';

@Injectable()
export class KitchenService {
  constructor(
    private readonly kitchenRepository: KitchenRepository,
    @Inject(forwardRef(() => SyncGateway))
    private readonly syncGateway: SyncGateway,
  ) {}

  async findActiveTickets(branchId: string) {
    return this.kitchenRepository.findActiveTicketsByBranch(branchId);
  }

  async sendOrderToKitchen(orderId: string) {
    const result = await this.kitchenRepository.createTicketsForOrder(orderId);

    // Broadcast change to branch so clients pull new kitchen state
    const branchId = await this.kitchenRepository.findBranchIdForOrder(orderId);
    if (branchId) {
      this.syncGateway.broadcastChange(branchId, {
        tipo: 'cambio',
        changes: [{ entity: 'kitchenOrders' }],
      });
    }

    return result;
  }

  async updateTicketStatus(id: string, status: 'pending' | 'preparing' | 'ready' | 'served') {
    const ticket = await this.kitchenRepository.findTicketById(id);
    if (!ticket) {
      throw new NotFoundException(`Kitchen ticket with ID ${id} not found.`);
    }

    const branchId = await this.kitchenRepository.findBranchIdForTicket(id);
    const result = await this.kitchenRepository.updateTicketStatus(id, status);

    // Broadcast change to branch so clients pull updated kitchen state
    if (branchId) {
      this.syncGateway.broadcastChange(branchId, {
        tipo: 'cambio',
        changes: [{ entity: 'kitchenOrders' }],
      });
    }

    return result;
  }
}
