import { Injectable, NotFoundException } from '@nestjs/common';
import { ProvidersRepository } from './repositories/providers.repository';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';

@Injectable()
export class ProvidersService {
  constructor(private readonly providersRepository: ProvidersRepository) {}

  async findAll(businessId?: string) {
    return this.providersRepository.findAll(businessId);
  }

  async findOne(id: string) {
    const provider = await this.providersRepository.findById(id);
    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }
    return provider;
  }

  async create(createProviderDto: CreateProviderDto) {
    return this.providersRepository.create({
      ...createProviderDto,
      contactName: createProviderDto.contactName || null,
      phone: createProviderDto.phone || null,
      email: createProviderDto.email || null,
      address: createProviderDto.address || null,
    });
  }

  async update(id: string, updateProviderDto: UpdateProviderDto) {
    const provider = await this.providersRepository.findById(id);
    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }
    return this.providersRepository.update(id, updateProviderDto);
  }

  async remove(id: string) {
    const provider = await this.providersRepository.findById(id);
    if (!provider) {
      throw new NotFoundException(`Provider with ID ${id} not found`);
    }
    await this.providersRepository.softDelete(id);
    return { success: true, message: 'Provider deleted successfully' };
  }
}
