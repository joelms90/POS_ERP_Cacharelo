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
    receivedBy = 'operador',
  ) {
    const purchaseOrder = await this.purchaseOrdersRepository.findById(id);
    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }
    if (purchaseOrder.status !== 'sent' && purchaseOrder.status !== 'partially_received') {
      throw new BadRequestException(`Cannot receive purchase order with status: ${purchaseOrder.status}`);
    }
    if (!receiptData.items?.length) {
      throw new BadRequestException('La recepción debe incluir al menos un producto.');
    }

    const orderWithItems = await this.purchaseOrdersRepository.findByIdWithItems(id);
    const expectedByProduct = new Map(
      orderWithItems?.items.map((item) => [item.productId, item]) ?? [],
    );
    const hasMismatch = receiptData.items.some((item) => {
      const expected = expectedByProduct.get(item.productId);
      if (!expected) return true;
      return Number(expected.quantityOrdered) !== item.quantityReceived ||
        Number(expected.unitCostEstimated) !== item.unitCostActual;
    });
    if (hasMismatch && !receiptData.notes?.trim()) {
      throw new BadRequestException(
        'Debes registrar una nota cuando la cantidad o el costo recibido difiere de la orden de compra.',
      );
    }
    const auditedNotes = `${receiptData.notes?.trim() || 'Recepción sin discrepancias'}\nRecibido por: ${receivedBy}`;
    return this.inventoryService.processPurchaseOrderReception(id, receiptData.items, auditedNotes);
  }
}
