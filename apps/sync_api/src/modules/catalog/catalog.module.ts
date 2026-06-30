import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategoriesRepository } from './repositories/categories.repository';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsRepository } from './repositories/products.repository';
import { ProvidersModule } from '../providers/providers.module';
import { SupplierProductsController } from './supplier-products.controller';
import { SupplierProductsService } from './supplier-products.service';
import { SupplierProductsRepository } from './repositories/supplier-products.repository';

@Module({
  imports: [ProvidersModule],
  controllers: [CategoriesController, ProductsController, SupplierProductsController],
  providers: [
    CategoriesService,
    CategoriesRepository,
    ProductsService,
    ProductsRepository,
    SupplierProductsService,
    SupplierProductsRepository,
  ],
  exports: [
    CategoriesService,
    CategoriesRepository,
    ProductsService,
    ProductsRepository,
    SupplierProductsService,
    SupplierProductsRepository,
  ],
})
export class CatalogModule {}
