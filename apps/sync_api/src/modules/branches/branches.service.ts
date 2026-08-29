import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { BranchesRepository } from './repositories/branches.repository';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { SyncGateway } from '../sync/sync.gateway';

@Injectable()
export class BranchesService {
  constructor(
    private readonly branchesRepository: BranchesRepository,
    @Inject(forwardRef(() => SyncGateway))
    private readonly syncGateway: SyncGateway,
  ) {}

  async findAll(businessId?: string) {
    return this.branchesRepository.findAll(businessId);
  }

  async findOne(id: string) {
    const branch = await this.branchesRepository.findById(id);
    if (!branch) {
      throw new NotFoundException(`Sucursal con ID ${id} no encontrada`);
    }
    return branch;
  }

  async create(createBranchDto: CreateBranchDto) {
    return this.branchesRepository.create({
      ...createBranchDto,
      address: createBranchDto.address || null,
      phone: createBranchDto.phone || null,
      version: 1,
    });
  }

  async update(id: string, updateBranchDto: UpdateBranchDto) {
    const branch = await this.branchesRepository.findById(id);
    if (!branch) {
      throw new NotFoundException(`Sucursal con ID ${id} no encontrada`);
    }
    return this.branchesRepository.update(id, updateBranchDto);
  }

  async remove(id: string) {
    const branch = await this.branchesRepository.findById(id);
    if (!branch) {
      throw new NotFoundException(`Sucursal con ID ${id} no encontrada`);
    }

    // Check for associated records (mesas, pedidos, stock, receipts, transfers)
    const hasRecords = await this.branchesRepository.hasAssociatedRecords(id);
    if (hasRecords) {
      throw new BadRequestException(
        'No se puede eliminar la sucursal porque tiene registros asociados (mesas, pedidos, historial de insumos o niveles de stock).'
      );
    }

    await this.branchesRepository.softDelete(id);
    return { success: true, message: 'Sucursal eliminada con éxito' };
  }

  async findTables(branchId: string) {
    return this.branchesRepository.findTables(branchId);
  }

  async createTable(branchId: string, data: any) {
    return this.branchesRepository.createTable({
      branchId,
      label: data.label,
      capacity: data.capacity || 4,
      room: data.room || 'General',
      state: 'free',
      x: data.x,
      y: data.y,
      shape: data.shape || 'square',
      version: 1,
    });
  }

  async removeTable(tableId: string) {
    return this.branchesRepository.removeTable(tableId);
  }

  async updateTable(tableId: string, data: any) {
    const result = await this.branchesRepository.updateTable(tableId, data);
    if (data.state && result?.branchId) {
      this.syncGateway.broadcastChange(result.branchId, {
        tipo: 'cambio',
        changes: [
          { entity: 'branchTables', entityId: tableId, payload: { state: data.state } },
        ],
      });
    }
    return result;
  }

  async generateTables(branchId: string, mode: 'cafeteria' | 'mostrador') {
    return this.branchesRepository.generateTables(branchId, mode);
  }
}
