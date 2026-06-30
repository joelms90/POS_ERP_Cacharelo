# Sync API - Detailed Code Structure & Examples

## File Organization

```
apps/sync_api/
├── src/
│   ├── main.ts                      # Bootstrap, runs migrations
│   ├── app.module.ts                # Root module
│   ├── app.controller.ts            # Health check
│   ├── app.service.ts
│   │
│   ├── database/
│   │   ├── schema.ts                # Drizzle schema definitions (ALL tables)
│   │   ├── connection.ts            # PostgreSQL pool setup
│   │   ├── database.module.ts       # DI module
│   │   └── migrate.ts               # Run migrations on startup
│   │
│   └── modules/
│       ├── auth/                    # JWT, device login
│       ├── sync/                    # ↓ DETAILED BELOW ↓
│       │   ├── sync.controller.ts
│       │   ├── sync.service.ts
│       │   ├── sync.module.ts
│       │   └── dto/
│       │       ├── push-sync.dto.ts
│       │       ├── pull-sync.dto.ts
│       │       └── ack-sync.dto.ts
│       │
│       ├── catalog/                 # ↓ DETAILED BELOW ↓
│       │   ├── products.controller.ts
│       │   ├── products.service.ts
│       │   ├── categories.controller.ts
│       │   ├── categories.service.ts
│       │   ├── catalog.module.ts
│       │   ├── dto/
│       │   │   ├── create-product.dto.ts
│       │   │   ├── update-product.dto.ts
│       │   │   ├── create-category.dto.ts
│       │   │   └── update-category.dto.ts
│       │   └── repositories/
│       │       ├── products.repository.ts
│       │       └── categories.repository.ts
│       │
│       ├── inventory/               # ↓ DETAILED BELOW ↓
│       │   ├── inventory.controller.ts
│       │   ├── inventory.service.ts
│       │   ├── inventory.module.ts
│       │   ├── dto/
│       │   │   ├── create-receipt.dto.ts
│       │   │   └── create-production-run.dto.ts
│       │   └── repositories/
│       │       └── inventory.repository.ts
│       │
│       ├── warehouses/
│       │   ├── warehouses.controller.ts
│       │   ├── warehouses.service.ts
│       │   ├── dto/
│       │   └── repositories/
│       │
│       ├── providers/
│       │   ├── providers.controller.ts
│       │   ├── providers.service.ts
│       │   ├── dto/
│       │   └── repositories/
│       │
│       ├── recipes/
│       │   ├── recipes.controller.ts
│       │   ├── recipes.service.ts
│       │   ├── dto/
│       │   └── repositories/
│       │
│       └── [orders, shifts, branches, users, kitchen, inquiries]
│
├── migrations/                      # Drizzle migrations
│   ├── 20260606000000_create_users_table.ts
│   └── meta/
│       └── _journal.json
│
├── test/
│   └── app.e2e-spec.ts
│
├── package.json
└── tsconfig.json
```

---

## Key Code Examples

### 1. Schema Definition

**File**: `/apps/sync_api/src/database/schema.ts`

Key table definitions:

```typescript
// Inventory-related tables (simplified)
export const stockLevels = pgTable('stock_levels', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  branchId: uuid('branch_id').references(() => branches.id),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id),
  quantity: decimal('quantity', { precision: 12, scale: 3 }).default('0.000').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  categoryId: uuid('category_id').references(() => categories.id).notNull(),
  providerId: uuid('provider_id').references(() => providers.id),
  name: varchar('name', { length: 150 }).notNull(),
  sku: varchar('sku', { length: 50 }),
  barcode: varchar('barcode', { length: 50 }),
  cost: decimal('cost', { precision: 10, scale: 2 }).default('0.00').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).default('0.00').notNull(),
  isSellable: boolean('is_sellable').default(true).notNull(),
  isIngredient: boolean('is_ingredient').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  version: integer('version').default(1).notNull(),
});

export const inventoryReceipts = pgTable('inventory_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').references(() => businesses.id).notNull(),
  providerId: uuid('provider_id').references(() => providers.id).notNull(),
  branchId: uuid('branch_id').references(() => branches.id),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id),
  documentNumber: varchar('document_number', { length: 50 }),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const recipes = pgTable('recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentProductId: uuid('parent_product_id').references(() => products.id).notNull(),
  ingredientProductId: uuid('ingredient_product_id').references(() => products.id).notNull(),
  quantityNeeded: decimal('quantity_needed', { precision: 12, scale: 3 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

**File location**: `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/database/schema.ts`

---

### 2. Inventory Service

**File**: `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/inventory/inventory.service.ts`

Key methods:

```typescript
@Injectable()
export class InventoryService {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  // Get stock levels across warehouse/branch
  async getStockLevels(businessId: string, warehouseId?: string, branchId?: string) {
    return this.inventoryRepository.getStockLevels(businessId, warehouseId, branchId);
  }

  // Record inbound inventory
  async recordReceipt(createReceiptDto: CreateReceiptDto) {
    const { businessId, providerId, branchId, warehouseId, documentNumber, notes, items } = createReceiptDto;

    // Validation: must specify either branch OR warehouse, not both
    if (!branchId && !warehouseId) {
      throw new BadRequestException('Debe especificar un destino (Sucursal o Bodega)...');
    }
    if (branchId && warehouseId) {
      throw new BadRequestException('No puede ingresar inventario a una Sucursal y una Bodega...');
    }

    const db = this.inventoryRepository.getDb();
    
    // Verify provider
    const matchProvider = await db.select().from(schema.providers)
      .where(eq(schema.providers.id, providerId)).limit(1);
    if (matchProvider.length === 0) {
      throw new NotFoundException(`Proveedor con ID ${providerId} no encontrado`);
    }

    // TRANSACTION: Atomic insert + stock update
    return db.transaction(async (tx) => {
      // 1. Insert receipt document
      const [receipt] = await tx.insert(schema.inventoryReceipts)
        .values({ businessId, providerId, branchId: branchId || null, warehouseId: warehouseId || null, documentNumber, notes })
        .returning();

      // 2. Process each item
      const savedItems = [];
      for (const item of items) {
        const totalCost = (item.quantity * item.unitCost).toFixed(2);
        
        // Insert receipt item
        const [savedItem] = await tx.insert(schema.inventoryReceiptItems)
          .values({ receiptId: receipt.id, productId: item.productId, quantity: item.quantity.toString(), unitCost: item.unitCost.toString(), totalCost })
          .returning();
        savedItems.push(savedItem);

        // Update or insert stock level
        const conditions = [eq(schema.stockLevels.productId, item.productId)];
        if (warehouseId) {
          conditions.push(eq(schema.stockLevels.warehouseId, warehouseId));
        } else {
          conditions.push(eq(schema.stockLevels.branchId, branchId!));
        }

        const matchStock = await tx.select().from(schema.stockLevels)
          .where(and(...conditions)).limit(1);

        if (matchStock.length > 0) {
          const newQty = (parseFloat(matchStock[0].quantity) + item.quantity).toString();
          await tx.update(schema.stockLevels).set({ quantity: newQty, updatedAt: new Date() })
            .where(eq(schema.stockLevels.id, matchStock[0].id));
        } else {
          await tx.insert(schema.stockLevels)
            .values({ productId: item.productId, warehouseId: warehouseId || null, branchId: branchId || null, quantity: item.quantity.toString() });
        }
      }

      return { success: true, receiptId: receipt.id, itemsProcessed: savedItems.length };
    });
  }

  // BOM assembly (production run)
  async assembleProduct(createProductionRunDto: CreateProductionRunDto) {
    const { warehouseId, productId, quantityProduced, notes } = createProductionRunDto;
    const db = this.inventoryRepository.getDb();

    // 1. Get recipe components
    const recipe = await db.select({
      id: schema.recipes.id,
      ingredientProductId: schema.recipes.ingredientProductId,
      quantityNeeded: schema.recipes.quantityNeeded,
      ingredientName: schema.products.name,
    }).from(schema.recipes)
      .innerJoin(schema.products, eq(schema.recipes.ingredientProductId, schema.products.id))
      .where(eq(schema.recipes.parentProductId, productId));

    if (recipe.length === 0) {
      throw new BadRequestException('El producto no tiene receta configurada');
    }

    // 2. Validate stock for all ingredients
    for (const item of recipe) {
      const requiredQty = parseFloat(item.quantityNeeded) * quantityProduced;
      const [stock] = await db.select().from(schema.stockLevels)
        .where(and(
          eq(schema.stockLevels.productId, item.ingredientProductId),
          eq(schema.stockLevels.warehouseId, warehouseId)
        )).limit(1);

      const availableQty = stock ? parseFloat(stock.quantity) : 0;
      if (availableQty < requiredQty) {
        throw new BadRequestException(
          `Stock insuficiente para "${item.ingredientName}". Requerido: ${requiredQty}, Disponible: ${availableQty}`
        );
      }
    }

    // 3. Execute transaction
    return db.transaction(async (tx) => {
      // Decrement ingredients
      for (const item of recipe) {
        const decrementQty = parseFloat(item.quantityNeeded) * quantityProduced;
        const [stock] = await tx.select().from(schema.stockLevels)
          .where(and(
            eq(schema.stockLevels.productId, item.ingredientProductId),
            eq(schema.stockLevels.warehouseId, warehouseId)
          )).limit(1);

        const newQty = (parseFloat(stock.quantity) - decrementQty).toString();
        await tx.update(schema.stockLevels)
          .set({ quantity: newQty, updatedAt: new Date() })
          .where(eq(schema.stockLevels.id, stock.id));
      }

      // Increment parent product
      const [parentStock] = await tx.select().from(schema.stockLevels)
        .where(and(
          eq(schema.stockLevels.productId, productId),
          eq(schema.stockLevels.warehouseId, warehouseId)
        )).limit(1);

      if (parentStock) {
        const newQty = (parseFloat(parentStock.quantity) + quantityProduced).toString();
        await tx.update(schema.stockLevels)
          .set({ quantity: newQty, updatedAt: new Date() })
          .where(eq(schema.stockLevels.id, parentStock.id));
      } else {
        await tx.insert(schema.stockLevels)
          .values({ productId, warehouseId, quantity: quantityProduced.toString() });
      }

      // Log production run
      const [run] = await tx.insert(schema.productionRuns)
        .values({ warehouseId, productId, quantityProduced: quantityProduced.toString(), notes })
        .returning();

      return { success: true, productionRunId: run.id };
    });
  }
}
```

---

### 3. Inventory Repository

**File**: `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/inventory/repositories/inventory.repository.ts`

```typescript
@Injectable()
export class InventoryRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  getDb() {
    return this.db;
  }

  // Query stock levels with joins
  async getStockLevels(businessId: string, warehouseId?: string, branchId?: string) {
    const conditions = [];
    if (warehouseId) {
      conditions.push(eq(schema.stockLevels.warehouseId, warehouseId));
    }
    if (branchId) {
      conditions.push(eq(schema.stockLevels.branchId, branchId));
    }
    
    return this.db.select({
      id: schema.stockLevels.id,
      productId: schema.stockLevels.productId,
      productName: schema.products.name,
      isIngredient: schema.products.isIngredient,
      quantity: schema.stockLevels.quantity,
      updatedAt: schema.stockLevels.updatedAt,
      warehouseId: schema.stockLevels.warehouseId,
      branchId: schema.stockLevels.branchId,
    }).from(schema.stockLevels)
      .innerJoin(schema.products, eq(schema.stockLevels.productId, schema.products.id))
      .where(and(eq(schema.products.businessId, businessId), ...conditions));
  }

  async getReceipts(businessId: string) {
    return this.db.select({
      id: schema.inventoryReceipts.id,
      providerName: schema.providers.name,
      documentNumber: schema.inventoryReceipts.documentNumber,
      receivedAt: schema.inventoryReceipts.receivedAt,
      notes: schema.inventoryReceipts.notes,
      warehouseName: schema.warehouses.name,
      branchName: schema.branches.name,
    }).from(schema.inventoryReceipts)
      .innerJoin(schema.providers, eq(schema.inventoryReceipts.providerId, schema.providers.id))
      .leftJoin(schema.warehouses, eq(schema.inventoryReceipts.warehouseId, schema.warehouses.id))
      .leftJoin(schema.branches, eq(schema.inventoryReceipts.branchId, schema.branches.id))
      .where(eq(schema.inventoryReceipts.businessId, businessId));
  }

  async getProductionRuns(businessId: string) {
    return this.db.select({
      id: schema.productionRuns.id,
      warehouseName: schema.warehouses.name,
      productName: schema.products.name,
      quantityProduced: schema.productionRuns.quantityProduced,
      assembledAt: schema.productionRuns.assembledAt,
      notes: schema.productionRuns.notes,
    }).from(schema.productionRuns)
      .innerJoin(schema.warehouses, eq(schema.productionRuns.warehouseId, schema.warehouses.id))
      .innerJoin(schema.products, eq(schema.productionRuns.productId, schema.products.id))
      .where(eq(schema.warehouses.businessId, businessId))
      .orderBy(desc(schema.productionRuns.assembledAt));
  }
}
```

---

### 4. Sync Service

**File**: `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/sync/sync.service.ts`

```typescript
@Injectable()
export class SyncService {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // Push offline changes from tablet
  async push(pushSyncDto: PushSyncDto) {
    await this.db.transaction(async (tx) => {
      // Upsert orders (mutable)
      if (pushSyncDto.orders?.length > 0) {
        await tx.insert(schema.orders).values(pushSyncDto.orders)
          .onConflictDoUpdate({
            target: schema.orders.id,
            set: {
              branchId: sql`excluded.branch_id`,
              tableId: sql`excluded.table_id`,
              // ... other fields
              updatedAt: sql`excluded.updated_at`,
            },
          });
      }

      // Upsert payments (append-only, no update)
      if (pushSyncDto.payments?.length > 0) {
        await tx.insert(schema.payments).values(pushSyncDto.payments)
          .onConflictDoNothing();
      }
      
      // Similar for orderItems, cashShifts, cashTransactions
    });

    return { success: true };
  }

  // Pull changes since last sync
  async pull(pullSyncDto: PullSyncDto) {
    const lastSyncedAt = pullSyncDto.lastSyncedAt ? new Date(pullSyncDto.lastSyncedAt) : new Date(0);
    const serverTimestamp = new Date();

    // Query changes since last sync
    const businesses = await this.db.select().from(schema.businesses).where(gt(schema.businesses.updatedAt, lastSyncedAt));
    const products = await this.db.select().from(schema.products).where(gt(schema.products.updatedAt, lastSyncedAt));
    const categories = await this.db.select().from(schema.categories).where(gt(schema.categories.updatedAt, lastSyncedAt));
    const payments = await this.db.select().from(schema.payments).where(gt(schema.payments.createdAt, lastSyncedAt));

    // Strip sensitive data
    const sanitizedUsers = users.map((u) => {
      const { passwordHash, pin, ...rest } = u;
      return rest;
    });

    return {
      timestamp: serverTimestamp.toISOString(),
      changes: {
        businesses,
        products,
        categories,
        payments,
        // ... all other tables
      },
    };
  }

  // Acknowledge sync receipt
  async ack(ackSyncDto: AckSyncDto) {
    const { deviceId, lastSyncedAt } = ackSyncDto;
    const syncTime = new Date(lastSyncedAt);

    const existing = await this.db.select().from(schema.deviceSyncCheckpoints)
      .where(eq(schema.deviceSyncCheckpoints.deviceId, deviceId));

    if (existing.length > 0) {
      await this.db.update(schema.deviceSyncCheckpoints)
        .set({ lastSyncedAt: syncTime, updatedAt: new Date() })
        .where(eq(schema.deviceSyncCheckpoints.deviceId, deviceId));
    } else {
      await this.db.insert(schema.deviceSyncCheckpoints)
        .values({ deviceId, lastSyncedAt: syncTime });
    }

    return { success: true };
  }
}
```

---

### 5. Products Service

**File**: `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/catalog/products.service.ts`

```typescript
@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly providersRepository: ProvidersRepository,
  ) {}

  async findAll(businessId?: string, categoryId?: string) {
    return this.productsRepository.findAll(businessId, categoryId);
  }

  async findOne(id: string) {
    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async create(createProductDto: CreateProductDto) {
    // Validate category
    const category = await this.categoriesRepository.findById(createProductDto.categoryId);
    if (!category) {
      throw new NotFoundException(`Category with ID ${createProductDto.categoryId} not found`);
    }

    // Validate provider if provided
    if (createProductDto.providerId) {
      const provider = await this.providersRepository.findById(createProductDto.providerId);
      if (!provider) {
        throw new NotFoundException(`Provider with ID ${createProductDto.providerId} not found`);
      }
    }

    return this.productsRepository.create({
      ...createProductDto,
      sku: createProductDto.sku || null,
      barcode: createProductDto.barcode || null,
      providerId: createProductDto.providerId || null,
      cost: createProductDto.cost || '0.00',
      price: createProductDto.price || '0.00',
      isSellable: createProductDto.isSellable ?? true,
      isIngredient: createProductDto.isIngredient ?? false,
    });
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    if (updateProductDto.categoryId) {
      const category = await this.categoriesRepository.findById(updateProductDto.categoryId);
      if (!category) {
        throw new NotFoundException(`Category not found`);
      }
    }

    return this.productsRepository.update(id, updateProductDto);
  }

  async remove(id: string) {
    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    await this.productsRepository.softDelete(id);
    return { success: true };
  }
}
```

---

### 6. DTOs

**File**: `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/inventory/dto/create-receipt.dto.ts`

```typescript
export class CreateReceiptItemDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @IsNumber()
  @IsNotEmpty()
  unitCost: number;
}

export class CreateReceiptDto {
  @IsUUID()
  @IsNotEmpty()
  businessId: string;

  @IsUUID()
  @IsNotEmpty()
  providerId: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @IsString()
  @IsOptional()
  documentNumber?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReceiptItemDto)
  items: CreateReceiptItemDto[];
}
```

**File**: `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/catalog/dto/create-product.dto.ts`

```typescript
export class CreateProductDto {
  @IsUUID()
  @IsNotEmpty()
  businessId: string;

  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  name: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsUUID()
  @IsOptional()
  providerId?: string;

  @IsNumberString()
  @IsOptional()
  cost?: string;

  @IsNumberString()
  @IsOptional()
  price?: string;

  @IsBoolean()
  @IsOptional()
  isSellable?: boolean;

  @IsBoolean()
  @IsOptional()
  isIngredient?: boolean;
}
```

---

## Module Dependencies

### Catalog Module
```typescript
@Module({
  controllers: [ProductsController, CategoriesController],
  providers: [ProductsService, CategoriesService, ProductsRepository, CategoriesRepository],
  exports: [ProductsService, CategoriesService],
})
export class CatalogModule {}
```

### Inventory Module
```typescript
@Module({
  controllers: [InventoryController],
  providers: [InventoryService, InventoryRepository],
  exports: [InventoryService],
})
export class InventoryModule {}
```

---

## Database Connection Pattern

**File**: `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/database/connection.ts`

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
```

Then injected via DI:

```typescript
@Injectable()
export class SomeRepository {
  constructor(
    @Inject(DRIZZLE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}
}
```

---

## Query Pattern Examples

### Get Products for Business + Category
```typescript
this.db.select().from(schema.products)
  .where(and(
    eq(schema.products.businessId, businessId),
    eq(schema.products.categoryId, categoryId),
    isNull(schema.products.deletedAt),
  ));
```

### Upsert on Conflict
```typescript
await tx.insert(schema.orders).values(orderData)
  .onConflictDoUpdate({
    target: schema.orders.id,
    set: {
      state: sql`excluded.state`,
      updatedAt: sql`excluded.updated_at`,
    },
  });
```

### Transaction with Rollback
```typescript
return db.transaction(async (tx) => {
  // Multiple operations
  await tx.insert(schema.inventoryReceipts).values(...);
  await tx.update(schema.stockLevels).set(...);
  // If any fails, entire transaction rolls back
});
```

### Join Query
```typescript
this.db.select({
  receiptId: schema.inventoryReceipts.id,
  providerName: schema.providers.name,
}).from(schema.inventoryReceipts)
  .innerJoin(schema.providers, eq(schema.inventoryReceipts.providerId, schema.providers.id))
  .leftJoin(schema.warehouses, eq(schema.inventoryReceipts.warehouseId, schema.warehouses.id));
```

---

## Absolute File Paths

All key files referenced in this architecture:

- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/database/schema.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/database/connection.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/database/database.module.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/inventory/inventory.service.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/inventory/inventory.controller.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/inventory/repositories/inventory.repository.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/inventory/dto/create-receipt.dto.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/inventory/dto/create-production-run.dto.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/catalog/products.service.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/catalog/products.controller.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/catalog/repositories/products.repository.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/catalog/dto/create-product.dto.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/sync/sync.service.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/modules/sync/sync.controller.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/app.module.ts`
- `/Users/joelmorales/web/POS-ERP/apps/sync_api/src/main.ts`
