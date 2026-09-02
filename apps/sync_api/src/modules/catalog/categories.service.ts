import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoriesRepository } from './repositories/categories.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async findAll(businessId?: string) {
    return this.categoriesRepository.findAll(businessId);
  }

  async findOne(id: string) {
    const category = await this.categoriesRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async create(createCategoryDto: CreateCategoryDto) {
    return this.categoriesRepository.create({
      ...createCategoryDto,
      description: createCategoryDto.description || null,
      targetStation: createCategoryDto.targetStation || null,
    });
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.categoriesRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return this.categoriesRepository.update(id, updateCategoryDto);
  }

  async remove(id: string) {
    const category = await this.categoriesRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    await this.categoriesRepository.softDelete(id);
    return { success: true, message: 'Category deleted successfully' };
  }
}
