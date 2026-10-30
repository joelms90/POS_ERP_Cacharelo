import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { RequisitionsRepository } from './repositories/requisitions.repository';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { UpdateRequisitionStatusDto } from './dto/update-requisition-status.dto';
import { normalizeOperationalRole } from '../auth/roles';

@Injectable()
export class RequisitionsService {
  constructor(private readonly requisitionsRepository: RequisitionsRepository) {}

  async create(createRequisitionDto: {
    id?: string; businessId: string; fromBranchId: string; toWarehouseId: string; createdBy: string; notes?: string;
    items: Array<{ productId: string; quantityRequested: number }>;
  }) {
    return this.requisitionsRepository.create(createRequisitionDto);
  }

  async createForOperator(dto: CreateRequisitionDto, actor: any) {
    if (!dto.items?.length) throw new BadRequestException('Agrega al menos un producto a la requisición.');
    const operator = this.getOperator(actor);
    const roles = (Array.isArray(actor.roles) ? actor.roles : [actor.role || '']).map(normalizeOperationalRole);
    const isOwnerOrAdmin = roles.includes('owner') || roles.includes('inventory_admin') || roles.includes('support_tech');

    const businessId = (isOwnerOrAdmin && dto.businessId) ? dto.businessId : (operator.businessId || dto.businessId);
    const branchId = operator.branchId || dto.fromBranchId;
    const createdBy = operator.id || dto.createdBy;

    if (!businessId || !branchId) {
      throw new BadRequestException('Debe especificar un negocio y sucursal de origen válidos.');
    }

    if (dto.toWarehouseId) {
      return this.requisitionsRepository.create({
        id: dto.id,
        businessId,
        fromBranchId: branchId,
        toWarehouseId: dto.toWarehouseId,
        createdBy,
        notes: dto.notes,
        items: dto.items,
      });
    }

    return this.requisitionsRepository.createForBranch({
      id: dto.id,
      businessId,
      fromBranchId: branchId,
      createdBy,
      notes: dto.notes,
      items: dto.items,
    });
  }

  async findMine(actor: any, status?: string) {
    const operator = this.getOperator(actor);
    if (!operator.businessId || !operator.branchId) {
      throw new ForbiddenException('El operador debe estar asignado a un negocio y sucursal.');
    }
    return this.requisitionsRepository.findByRequester(
      operator.businessId,
      operator.branchId,
      operator.id,
      status,
    );
  }

  assertMayRead(actor: any, requisition: any) {
    const roles = (actor.roles || [actor.role]).map(normalizeOperationalRole);
    if (roles.includes('owner') || roles.includes('inventory_admin') || roles.includes('support_tech') || roles.includes('warehouse_purchasing_operator')) return;
    if (requisition.createdBy !== actor.sub || requisition.fromBranchId !== actor.branchId) {
      throw new ForbiddenException('Solo puedes consultar tus propias requisiciones.');
    }
  }

  private getOperator(actor: any) {
    if (!actor?.sub) throw new ForbiddenException('Operador no encontrado.');
    return { id: actor.sub, businessId: actor.businessId, branchId: actor.branchId };
  }

  async findByBranch(branchId: string, businessId?: string) {
    return this.requisitionsRepository.findByBranch(branchId, businessId);
  }

  async findPendingForBusiness(businessId: string) {
    return this.requisitionsRepository.findPendingForBusiness(businessId);
  }

  async findAll(businessId: string) {
    return this.requisitionsRepository.findAll(businessId);
  }

  async findOne(id: string) {
    const requisition = await this.requisitionsRepository.findByIdWithItems(id);
    if (!requisition) {
      throw new NotFoundException(`Requisition with ID ${id} not found`);
    }
    return requisition;
  }

  async updateStatus(id: string, updateStatusDto: UpdateRequisitionStatusDto, actorId = '', actorRoles: string[] = []) {
    const requisition = await this.requisitionsRepository.findById(id);
    if (!requisition) {
      throw new NotFoundException(`Requisition with ID ${id} not found`);
    }

    if (requisition.createdBy === actorId && !actorRoles.includes('owner')) {
      throw new BadRequestException('No puedes aprobar, rechazar o completar tu propia requisición.');
    }
    if (requisition.createdBy === actorId && actorRoles.includes('owner') && !updateStatusDto.notes?.trim()) {
      throw new BadRequestException('El propietario debe registrar un motivo para autorizar su propia requisición.');
    }

    // Validate status transitions
    if (requisition.status === 'approved' || requisition.status === 'rejected') {
      throw new BadRequestException(`Cannot modify requisition with status: ${requisition.status}`);
    }

    const updatedRequisition = await this.requisitionsRepository.updateStatus(
      id,
      updateStatusDto.status,
      updateStatusDto.notes,
    );

    return updatedRequisition;
  }
}
