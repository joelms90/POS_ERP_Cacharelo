import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategoriesRepository } from './repositories/categories.repository';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsRepository } from './repositories/products.repository';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [ProvidersModule],
  controllers: [CategoriesController, ProductsController],
  providers: [
    CategoriesService,
    CategoriesRepository,
    ProductsService,
    ProductsRepository,
  ],
  exports: [
    CategoriesService,
    CategoriesRepository,
    ProductsService,
    ProductsRepository,
  ],
})
export class CatalogModule {}
