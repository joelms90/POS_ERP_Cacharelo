import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategoriesRepository } from './repositories/categories.repository';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsRepository } from './repositories/products.repository';
import { ProvidersModule } from '../providers/providers.module';
import { InventoryModule } from '../inventory/inventory.module';
import { JwtModule } from '@nestjs/jwt';
import { SupplierProductsController } from './supplier-products.controller';
import { SupplierProductsService } from './supplier-products.service';
import { SupplierProductsRepository } from './repositories/supplier-products.repository';
import { BranchCatalogService } from './branch-catalog.service';
import { BranchCatalogController } from './branch-catalog.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [ProvidersModule, InventoryModule, JwtModule.register({})],
  controllers: [CategoriesController, ProductsController, SupplierProductsController, BranchCatalogController],
  providers: [
    CategoriesService,
    CategoriesRepository,
    ProductsService,
    ProductsRepository,
    SupplierProductsService,
    SupplierProductsRepository,
    BranchCatalogService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    CategoriesService,
    CategoriesRepository,
    ProductsService,
    ProductsRepository,
    SupplierProductsService,
    SupplierProductsRepository,
    BranchCatalogService,
  ],
})
export class CatalogModule {}
