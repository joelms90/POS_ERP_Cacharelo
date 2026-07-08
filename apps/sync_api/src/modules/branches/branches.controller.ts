import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  async findAll(@Query('businessId') businessId?: string) {
    return this.branchesService.findAll(businessId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.branchesService.findOne(id);
  }

  @Post()
  async create(@Body() createBranchDto: CreateBranchDto) {
    return this.branchesService.create(createBranchDto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateBranchDto: UpdateBranchDto) {
    return this.branchesService.update(id, updateBranchDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.branchesService.remove(id);
  }

  @Get(':id/tables')
  async getTables(@Param('id') branchId: string) {
    return this.branchesService.findTables(branchId);
  }

  @Post(':id/tables')
  async createTable(
    @Param('id') branchId: string,
    @Body() body: { label: string; capacity?: number; room?: string },
  ) {
    return this.branchesService.createTable(branchId, body);
  }

  @Delete(':id/tables/:tableId')
  async removeTable(@Param('id') branchId: string, @Param('tableId') tableId: string) {
    return this.branchesService.removeTable(tableId);
  }

  @Patch(':id/tables/:tableId')
  async updateTable(
    @Param('id') branchId: string,
    @Param('tableId') tableId: string,
    @Body() body: { label?: string; capacity?: number; room?: string; x?: number; y?: number; shape?: string; state?: string },
  ) {
    return this.branchesService.updateTable(tableId, body);
  }

  @Post(':id/tables/generate')
  async generateTables(
    @Param('id') branchId: string,
    @Body() body: { mode: 'cafeteria' | 'mostrador' },
  ) {
    return this.branchesService.generateTables(branchId, body.mode);
  }
}
