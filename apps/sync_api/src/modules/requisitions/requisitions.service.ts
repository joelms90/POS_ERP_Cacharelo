import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { RequisitionsRepository } from './repositories/requisitions.repository';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { UpdateRequisitionStatusDto } from './dto/update-requisition-status.dto';

@Injectable()
export class RequisitionsService {
  constructor(private readonly requisitionsRepository: RequisitionsRepository) {}

  async create(createRequisitionDto: CreateRequisitionDto) {
    return this.requisitionsRepository.create(createRequisitionDto);
  }

  async findByBranch(branchId: string) {
    return this.requisitionsRepository.findByBranch(branchId);
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

  async updateStatus(id: string, updateStatusDto: UpdateRequisitionStatusDto) {
    const requisition = await this.requisitionsRepository.findById(id);
    if (!requisition) {
      throw new NotFoundException(`Requisition with ID ${id} not found`);
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
