import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PurchaseOrdersRepository } from './repositories/purchase-orders.repository';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly purchaseOrdersRepository: PurchaseOrdersRepository,
    private readonly inventoryService: InventoryService,
  ) {}

  async findAll(businessId: string) {
    return this.purchaseOrdersRepository.findAll(businessId);
  }

  async findOne(id: string) {
    const purchaseOrder = await this.purchaseOrdersRepository.findByIdWithItems(id);
    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }
    return purchaseOrder;
  }

  async create(createPurchaseOrderDto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersRepository.create(createPurchaseOrderDto);
  }

  async update(id: string, updatePurchaseOrderDto: UpdatePurchaseOrderDto) {
    const purchaseOrder = await this.purchaseOrdersRepository.findById(id);
    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }
    return this.purchaseOrdersRepository.update(id, updatePurchaseOrderDto);
  }

  async remove(id: string) {
    const purchaseOrder = await this.purchaseOrdersRepository.findById(id);
    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }
    await this.purchaseOrdersRepository.softDelete(id);
    return { success: true, message: 'Purchase order deleted successfully' };
  }

  async markAsSent(id: string) {
    const purchaseOrder = await this.purchaseOrdersRepository.findById(id);
    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }
    return this.purchaseOrdersRepository.updateStatus(id, 'sent');
  }

  async receiveOrder(
    id: string,
    receiptData: {
      items: Array<{ productId: string; quantityReceived: number; unitCostActual: number }>;
      notes?: string;
    },
  ) {
    const purchaseOrder = await this.purchaseOrdersRepository.findById(id);
    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }
    if (purchaseOrder.status !== 'sent' && purchaseOrder.status !== 'partially_received') {
      throw new BadRequestException(`Cannot receive purchase order with status: ${purchaseOrder.status}`);
    }
    return this.inventoryService.processPurchaseOrderReception(id, receiptData.items, receiptData.notes);
  }
}
