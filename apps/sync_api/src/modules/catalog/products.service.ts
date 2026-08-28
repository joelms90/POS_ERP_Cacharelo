import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductsRepository } from './repositories/products.repository';
import { CategoriesRepository } from './repositories/categories.repository';
import { ProvidersRepository } from '../providers/repositories/providers.repository';
import { LedgerService } from '../inventory/ledger.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import * as schema from '../../database/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { read, utils } from 'xlsx';
import { Storage } from '@google-cloud/storage';

const ITEM_TYPE_FLAGS: Record<string, { isIngredient: boolean; isSellable: boolean }> = {
  raw_material: { isIngredient: true, isSellable: false },
  wip: { isIngredient: false, isSellable: false },
  finished_good: { isIngredient: false, isSellable: true },
  service: { isIngredient: false, isSellable: true },
};

function normalizeItemType(value: string | undefined): string | undefined {
  const s = (value || '').trim().toLowerCase();
  const map: Record<string, string> = {
    raw_material: 'raw_material', 'materia prima': 'raw_material', materia: 'raw_material',
    insumo: 'raw_material', ingrediente: 'raw_material', 'raw material': 'raw_material',
    wip: 'wip', 'producto en proceso': 'wip', 'en proceso': 'wip', 'producto en proceso (wip)': 'wip',
    finished_good: 'finished_good', 'producto terminado': 'finished_good', terminado: 'finished_good',
    'finished good': 'finished_good',
    service: 'service', servicio: 'service',
  };
  return s ? map[s] : undefined;
}

function normalizeProductionStrategy(value: string | undefined): string | undefined {
  const s = (value || '').trim().toLowerCase();
  const map: Record<string, string> = {
    none: 'none', ninguna: 'none', 'sin lógica automática': 'none', 'sin logica automatica': 'none',
    backflush: 'backflush',
    work_order: 'work_order', 'orden de trabajo': 'work_order', orden: 'work_order',
    'orden de trabajo (producción por lotes)': 'work_order',
  };
  return s ? map[s] : undefined;
}

function normalizeUom(value: string | undefined): string | undefined {
  const s = (value || '').trim().toLowerCase();
  const map: Record<string, string> = {
    piece: 'piece', pieza: 'piece', unidad: 'piece', pz: 'piece', 'pieza (unidad)': 'piece',
    kg: 'kg', kilogramo: 'kg', kilos: 'kg', 'kilogramo (kg)': 'kg',
    g: 'g', gramo: 'g', gramos: 'g', gr: 'g', 'gramo (g)': 'g',
    l: 'l', litro: 'l', litros: 'l', lt: 'l', 'litro (l)': 'l',
    ml: 'ml', mililitro: 'ml', mililitros: 'ml', 'mililitro (ml)': 'ml',
  };
  return s ? map[s] : undefined;
}

function resolveItemFlags(
  itemType: string | undefined,
  fallback: { isIngredient: boolean; isSellable: boolean },
): { isIngredient: boolean; isSellable: boolean } {
  return itemType && ITEM_TYPE_FLAGS[itemType] ? ITEM_TYPE_FLAGS[itemType] : fallback;
}

function resolveSaleType(uom: string | undefined, fallback: string): string {
  if (!uom) return fallback;
  return uom === 'piece' ? 'pieza' : 'granel';
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly providersRepository: ProvidersRepository,
    private readonly ledgerService: LedgerService,
  ) {}

  async findAll(businessId?: string, categoryId?: string, branchId?: string) {
    const products = await this.productsRepository.findAll(businessId, categoryId);

    if (branchId && products.length > 0) {
      // Override isSellable using the per-branch catalog (branch_products)
      const rows = await this.productsRepository
        .getDb()
        .select()
        .from(schema.branchProducts)
        .where(
          and(
            eq(schema.branchProducts.branchId, branchId),
            eq(schema.branchProducts.isActive, true),
          ),
        );

      const overrideMap = new Map(rows.map((r) => [r.productId, r.isSellable]));

      return products.map((p) => {
        const override = overrideMap.get(p.id);
        return override === undefined ? p : { ...p, isSellable: override };
      });
    }

    return products;
  }

  async findOne(id: string) {
    const product = await this.productsRepository.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async create(createProductDto: CreateProductDto) {
    const category = await this.categoriesRepository.findById(createProductDto.categoryId);
    if (!category) {
      throw new NotFoundException(`Category with ID ${createProductDto.categoryId} not found`);
    }

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
      internalCode: createProductDto.internalCode || null,
      providerId: createProductDto.providerId || null,
      cost: createProductDto.cost || '0.00',
      price: createProductDto.price || '0.00',
      priceWholesale: createProductDto.priceWholesale || '0.00',
      minStock: createProductDto.minStock || '0.000',
      maxStock: createProductDto.maxStock || '0.000',
      saleType: createProductDto.saleType || 'pieza',
      itemType: createProductDto.itemType || 'finished_good',
      productionStrategy: createProductDto.productionStrategy || 'none',
      uom: createProductDto.uom || 'piece',
      isSellable: createProductDto.isSellable ?? true,
      isIngredient: createProductDto.isIngredient ?? false,
      isActive: createProductDto.isActive ?? true,
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
        throw new NotFoundException(`Category with ID ${updateProductDto.categoryId} not found`);
      }
    }

    if (updateProductDto.providerId) {
      const provider = await this.providersRepository.findById(updateProductDto.providerId);
      if (!provider) {
        throw new NotFoundException(`Provider with ID ${updateProductDto.providerId} not found`);
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
    return { success: true, message: 'Product deleted successfully' };
  }

  async validateImport(businessId: string, rows: any[]) {
    const db = this.productsRepository.getDb();
    
    const dbCategories = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.businessId, businessId));
      
    const dbProviders = await db
      .select()
      .from(schema.providers)
      .where(eq(schema.providers.businessId, businessId));

    return rows.map((row, idx) => {
      const name = row['Nombre del Producto']?.toString().trim() || '';
      const catName = row['Categoría']?.toString().trim() || '';
      
      const cleanNumber = (val: any): string => {
        if (val === undefined || val === null) return '0.00';
        const cleaned = val.toString().trim().replace(/[$\s,]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? '0.00' : parsed.toString();
      };

      const cost = cleanNumber(row['Costo']);
      const price = cleanNumber(row['Precio Venta']);
      const priceWholesale = cleanNumber(row['Precio Mayoreo']);
      const minStock = cleanNumber(row['Inv Mínimo']);
      const maxStock = cleanNumber(row['Inv Máximo']);
      const saleType = (row['Tipo de Venta']?.toString().trim() || 'pieza').toLowerCase() === 'granel' ? 'granel' : 'pieza';
      const itemType = normalizeItemType(row['Tipo de Artículo']?.toString());
      const productionStrategy = normalizeProductionStrategy(row['Estrategia de Producción']?.toString());
      const uom = normalizeUom(row['Unidad de Medida']?.toString());
      const sku = row['SKU']?.toString().trim() || '';
      const barcode = row['Código Barras']?.toString().trim() || '';
      const internalCode = row['Código Interno']?.toString().trim() || '';
      const existence = parseFloat(cleanNumber(row['Existencia']));
      const providerName = row['Proveedor']?.toString().trim() || '';

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!name) errors.push('Falta el nombre del producto.');
      if (!catName) errors.push('Falta la categoría.');

      const catExists = dbCategories.some(c => c && c.name && c.name.toLowerCase() === catName.toLowerCase());
      if (catName && !catExists) {
        warnings.push(`Creará nueva categoría: "${catName}"`);
      }

      if (providerName) {
        const provExists = dbProviders.some(p => p && p.name && p.name.toLowerCase() === providerName.toLowerCase());
        if (!provExists) {
          warnings.push(`Creará nuevo proveedor: "${providerName}"`);
        }
      }

      return {
        rowNumber: idx + 2,
        name,
        catName,
        cost,
        price,
        priceWholesale,
        minStock,
        maxStock,
        saleType,
        itemType,
        productionStrategy,
        uom,
        sku,
        barcode,
        internalCode,
        existence,
        providerName,
        errors,
        warnings,
        isValid: errors.length === 0,
      };
    });
  }

  async bulkImport(businessId: string, rows: any[]) {
    const db = this.productsRepository.getDb();
    
    return db.transaction(async (tx) => {
      let successCount = 0;
      let errorCount = 0;

      const categories = await tx
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.businessId, businessId));
        
      const providers = await tx
        .select()
        .from(schema.providers)
        .where(eq(schema.providers.businessId, businessId));
        
      const warehouses = await tx
        .select()
        .from(schema.warehouses)
        .where(eq(schema.warehouses.businessId, businessId));

      for (const row of rows) {
        if (!row.isValid) continue;

        try {
          // 1. Resolve Category
          let category = categories.find(c => c.name.toLowerCase() === row.catName.toLowerCase());
          if (!category) {
            const [createdCat] = await tx
              .insert(schema.categories)
              .values({
                name: row.catName,
                description: 'Creada por importación masiva',
                businessId,
              })
              .returning();
            category = createdCat;
            categories.push(category);
          }

          // 2. Resolve Provider
          let providerId: string | null = null;
          if (row.providerName) {
            const provider = providers.find(p => p.name.toLowerCase() === row.providerName.toLowerCase());
            if (provider) {
              providerId = provider.id;
            } else {
              const [createdProv] = await tx
                .insert(schema.providers)
                .values({
                  name: row.providerName,
                  businessId,
                })
                .returning();
              providerId = createdProv.id;
              providers.push(createdProv);
            }
          }

          // 3. Create Product
          const flags = resolveItemFlags(row.itemType, {
            isIngredient: providerId ? true : false,
            isSellable: true,
          });

          const [product] = await tx
            .insert(schema.products)
            .values({
              categoryId: category.id,
              name: row.name,
              sku: row.sku || null,
              barcode: row.barcode || null,
              internalCode: row.internalCode || null,
              providerId,
              cost: row.cost || '0.00',
              price: row.price || '0.00',
              priceWholesale: row.priceWholesale || '0.00',
              minStock: row.minStock || '0.000',
              maxStock: row.maxStock || '0.000',
              saleType: resolveSaleType(row.uom, row.saleType || 'pieza'),
              itemType: row.itemType || (providerId ? 'raw_material' : 'finished_good'),
              productionStrategy: row.productionStrategy || 'none',
              uom: row.uom || 'piece',
              isSellable: flags.isSellable,
              isIngredient: flags.isIngredient,
              businessId,
            })
            .returning();

          // 4. Handle initial stock level balance
          if (row.existence && row.existence > 0) {
            let targetWh = warehouses[0];
            if (!targetWh) {
              const [createdWh] = await tx
                .insert(schema.warehouses)
                .values({
                  name: 'Bodega Central',
                  code: 'BC',
                  businessId,
                })
                .returning();
              targetWh = createdWh;
              warehouses.push(createdWh);
            }

            await this.ledgerService.applyMovement(tx, {
              businessId,
              productId: product.id,
              quantityDelta: row.existence,
              eventType: 'initial',
              warehouseId: targetWh.id,
              notes: 'Stock inicial (importación)',
            });
          }

          successCount++;
        } catch (err) {
          console.error('Error importing row in backend:', row, err);
          errorCount++;
        }
      }

      return { success: true, successCount, errorCount };
    });
  }

  async startBulkImport(businessId: string, file: any) {
    if (!file) {
      throw new BadRequestException('No se ha subido ningún archivo');
    }

    const db = this.productsRepository.getDb();
    
    // 1. Create a bulk import record
    const [importRecord] = await db
      .insert(schema.bulkImports)
      .values({
        businessId,
        filename: file.originalname,
        status: 'pending',
        successCount: 0,
        errorCount: 0,
        totalRows: 0,
      })
      .returning();

    // 2. Process file synchronously (awaiting) to prevent Cloud Run CPU throttling
    await this.processBulkImportBackground(businessId, importRecord.id, file.buffer);

    // 3. Return the completed/failed import record
    return this.getBulkImportDetails(importRecord.id);
  }

  async getBulkUploadUrl(businessId: string, filename: string) {
    const db = this.productsRepository.getDb();
    
    // 1. Create a bulk import record
    const [importRecord] = await db
      .insert(schema.bulkImports)
      .values({
        businessId,
        filename,
        status: 'pending',
        successCount: 0,
        errorCount: 0,
        totalRows: 0,
      })
      .returning();

    // 2. Generate signed URL for GCS direct upload
    const storage = new Storage();
    const bucketName = 'bulk-uploads-fresh-sensor-497515-d3';
    const gcsFileName = `${importRecord.id}-${filename}`;

    // Ensure bucket has a 7-day retention/lifecycle policy
    try {
      await storage.bucket(bucketName).setMetadata({
        lifecycle: {
          rule: [
            {
              action: { type: 'Delete' },
              condition: { age: 7 },
            },
          ],
        },
      });
    } catch (e) {
      console.warn(`Failed to set GCS lifecycle metadata on bucket ${bucketName}:`, e);
    }
    
    const [url] = await storage
      .bucket(bucketName)
      .file(gcsFileName)
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

    return {
      id: importRecord.id,
      url,
      gcsFileName,
    };
  }

  async processBulkImportGcs(businessId: string, importId: string, gcsFileName: string) {
    const storage = new Storage();
    const bucketName = 'bulk-uploads-fresh-sensor-497515-d3';
    
    // 1. Download file from GCS
    const [fileBuffer] = await storage
      .bucket(bucketName)
      .file(gcsFileName)
      .download();

    // 2. Process file synchronously
    await this.processBulkImportBackground(businessId, importId, fileBuffer);

    // 3. Clean up the file from GCS after processing (keeps bucket clean)
    try {
      await storage.bucket(bucketName).file(gcsFileName).delete();
    } catch (e) {
      console.warn(`Failed to delete temp file ${gcsFileName} from GCS:`, e);
    }

    // 4. Return the completed/failed import record
    return this.getBulkImportDetails(importId);
  }

  async getBulkHistory(businessId: string) {
    const db = this.productsRepository.getDb();
    return db
      .select()
      .from(schema.bulkImports)
      .where(eq(schema.bulkImports.businessId, businessId))
      .orderBy(desc(schema.bulkImports.createdAt));
  }

  async getBulkImportDetails(id: string) {
    const db = this.productsRepository.getDb();
    const results = await db
      .select()
      .from(schema.bulkImports)
      .where(eq(schema.bulkImports.id, id));
      
    if (results.length === 0) {
      throw new NotFoundException(`Importación masiva con ID ${id} no encontrada`);
    }
    return results[0];
  }

  async processBulkImportBackground(businessId: string, importId: string, buffer: Buffer) {
    const db = this.productsRepository.getDb();

    // Helper to find a value by key case-insensitively and diacritic-insensitively
    const normalizeKey = (str: string): string => {
      return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/\s+/g, ''); // remove spaces
    };

    const getRowValue = (rowObj: Record<string, any>, targetKey: string): string => {
      const keys = Object.keys(rowObj);
      const normTarget = normalizeKey(targetKey);
      
      // 1. Exact normalized match
      let foundKey = keys.find(k => normalizeKey(k) === normTarget);
      
      // 2. Fuzzy prefix match fallback
      if (!foundKey) {
        foundKey = keys.find(k => {
          const normK = normalizeKey(k);
          return normK.startsWith(normTarget) || normTarget.startsWith(normK);
        });
      }
      
      return foundKey ? rowObj[foundKey]?.toString().trim() || '' : '';
    };

    // Helper to clean numeric values
    const cleanNumber = (val: any): string => {
      if (val === undefined || val === null) return '0.00';
      const cleaned = val.toString().trim().replace(/[$\s,]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? '0.00' : parsed.toString();
    };

    try {
      // Update status to processing
      await db
        .update(schema.bulkImports)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(schema.bulkImports.id, importId));

      // Validate that the buffer is not empty or corrupted (xlsx zip structure is at least a few KB)
      if (!buffer || buffer.length < 100) {
        await db
          .update(schema.bulkImports)
          .set({ 
            status: 'failed', 
            errorDetails: [{ error: 'El archivo subido está vacío, dañado o es inválido.' }],
            updatedAt: new Date() 
          })
          .where(eq(schema.bulkImports.id, importId));
        return;
      }

      // Parse SheetJS in-memory using read from 'xlsx'
      const workbook = read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      recalculateSheetRange(worksheet);
      const rows = utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      if (rows.length === 0) {
        await db
          .update(schema.bulkImports)
          .set({ 
            status: 'failed', 
            errorDetails: [{ error: 'El archivo está vacío o no contiene filas de datos.' }],
            updatedAt: new Date() 
          })
          .where(eq(schema.bulkImports.id, importId));
        return;
      }

      // Pre-fetch categories, providers, and warehouses
      const categories = await db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.businessId, businessId));
        
      const providers = await db
        .select()
        .from(schema.providers)
        .where(eq(schema.providers.businessId, businessId));
        
      const warehouses = await db
        .select()
        .from(schema.warehouses)
        .where(eq(schema.warehouses.businessId, businessId));

      let successCount = 0;
      let errorCount = 0;
      const errorDetails: any[] = [];

      // 1. Initial Validation and Row Extraction
      const validRows: { row: Record<string, any>; rowNumber: number; parsed: any }[] = [];
      
      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const rowNumber = idx + 2; // header is row 1

        // Extract product ID if present (for UPSERT)
        const productId = getRowValue(row, 'ID');
        const name = getRowValue(row, 'Nombre del Producto') || getRowValue(row, 'Nombre');
        const catName = getRowValue(row, 'Categoría') || getRowValue(row, 'Categoria');
        
        if (!name) {
          errorCount++;
          errorDetails.push({ rowNumber, error: 'Falta el nombre del producto.' });
          continue;
        }
        if (!catName) {
          errorCount++;
          errorDetails.push({ rowNumber, error: 'Falta la categoría.' });
          continue;
        }
        
        const cost = cleanNumber(getRowValue(row, 'Costo'));
        const price = cleanNumber(getRowValue(row, 'Precio Venta') || getRowValue(row, 'Precio'));
        const priceWholesale = cleanNumber(getRowValue(row, 'Precio Mayoreo') || getRowValue(row, 'Mayoreo'));
        const minStock = cleanNumber(getRowValue(row, 'Inv Mínimo') || getRowValue(row, 'Minimo') || getRowValue(row, 'Stock Minimo'));
        const maxStock = cleanNumber(getRowValue(row, 'Inv Máximo') || getRowValue(row, 'Maximo') || getRowValue(row, 'Stock Maximo'));
        const saleType = (getRowValue(row, 'Tipo de Venta') || 'pieza').toLowerCase() === 'granel' ? 'granel' : 'pieza';
        const itemType = normalizeItemType(getRowValue(row, 'Tipo de Artículo') || getRowValue(row, 'Tipo de Articulo'));
        const productionStrategy = normalizeProductionStrategy(getRowValue(row, 'Estrategia de Producción') || getRowValue(row, 'Estrategia de Produccion'));
        const uom = normalizeUom(getRowValue(row, 'Unidad de Medida') || getRowValue(row, 'Unidad Medida'));
        const sku = getRowValue(row, 'SKU');
        const barcode = getRowValue(row, 'Código Barras') || getRowValue(row, 'Codigo Barras') || getRowValue(row, 'Codigo de Barras') || getRowValue(row, 'Barcode');
        const internalCode = getRowValue(row, 'Código Interno') || getRowValue(row, 'Codigo Interno') || getRowValue(row, 'Codigo');
        const existence = parseFloat(cleanNumber(getRowValue(row, 'Existencia') || getRowValue(row, 'Existencias') || getRowValue(row, 'Cantidad') || getRowValue(row, 'Stock')));
        const providerName = getRowValue(row, 'Proveedor') || getRowValue(row, 'Proveedores');
        const paraVentaValue = getRowValue(row, 'Para Venta') || getRowValue(row, 'Venta') || getRowValue(row, 'Es Venta');
        const paraVentaStr = paraVentaValue ? paraVentaValue.toString().toLowerCase().trim() : '';
        const paraVenta = ['si', 's', 'yes', 'y', 'true', '1'].includes(paraVentaStr);
        
        validRows.push({
          row,
          rowNumber,
          parsed: {
            productId, // Include product ID for exact matching
            name,
            catName,
            cost,
            price,
            priceWholesale,
            minStock,
            maxStock,
            saleType,
            itemType,
            productionStrategy,
            uom,
            sku,
            barcode,
            internalCode,
            existence,
            providerName,
            paraVenta,
          }
        });
      }

      // 2. Perform DB operations inside transaction context in bulk
      if (validRows.length > 0) {
        await db.transaction(async (tx) => {
          // A. Insert missing categories in bulk
          const uniqueCatNames = Array.from(new Set(validRows.map(vr => vr.parsed.catName)));
          const newCatsToInsert = uniqueCatNames
            .filter(name => !categories.some(c => c.name.toLowerCase() === name.toLowerCase()))
            .map(name => ({
              name,
              description: 'Creada por importación masiva',
              businessId,
            }));
            
          if (newCatsToInsert.length > 0) {
            const insertedCats = await tx.insert(schema.categories).values(newCatsToInsert).returning();
            categories.push(...insertedCats);
          }

          // B. Insert missing providers in bulk
          const uniqueProvNames = Array.from(
            new Set(
              validRows
                .map(vr => vr.parsed.providerName)
                .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
            )
          );
          const newProvsToInsert = uniqueProvNames
            .filter(name => !providers.some(p => p.name.toLowerCase() === name.toLowerCase()))
            .map(name => ({
              name,
              businessId,
            }));
            
          if (newProvsToInsert.length > 0) {
            const insertedProvs = await tx.insert(schema.providers).values(newProvsToInsert).returning();
            providers.push(...insertedProvs);
          }

          // C. Prepare and upsert products (update existing or insert new)
          const insertedProducts = [];
          let updatedCount = 0;

          for (const vr of validRows) {
            const p = vr.parsed;
            const category = categories.find(c => c.name.toLowerCase() === p.catName.toLowerCase())!;
            const provider = p.providerName ? providers.find(prov => prov.name.toLowerCase() === p.providerName.toLowerCase()) : null;
            const providerId = provider ? provider.id : null;

            const flags = resolveItemFlags(p.itemType, {
              isIngredient: !p.paraVenta,
              isSellable: p.paraVenta,
            });

            const productData = {
              categoryId: category.id,
              name: p.name,
              sku: p.sku || null,
              barcode: p.barcode || null,
              internalCode: p.internalCode || null,
              providerId,
              cost: p.cost,
              price: p.price,
              priceWholesale: p.priceWholesale,
              minStock: p.minStock,
              maxStock: p.maxStock,
              saleType: resolveSaleType(p.uom, p.saleType),
              itemType: p.itemType || (p.paraVenta ? 'finished_good' : 'raw_material'),
              productionStrategy: p.productionStrategy || 'none',
              uom: p.uom || 'piece',
              isSellable: flags.isSellable,
              isIngredient: flags.isIngredient,
              businessId,
              updatedAt: new Date(),
            };

            // Try to find existing product - prioritize exact ID match, then fallback to fuzzy matching
            let existingProduct = null;

            // 1. Try exact match by Product ID (most reliable)
            if (p.productId) {
              existingProduct = await tx
                .select()
                .from(schema.products)
                .where(and(
                  eq(schema.products.id, p.productId),
                  eq(schema.products.businessId, businessId),
                  isNull(schema.products.deletedAt)
                ))
                .limit(1);
            }

            // 2. Fallback to internal code matching
            if (!existingProduct || existingProduct.length === 0) {
              if (p.internalCode) {
                existingProduct = await tx
                  .select()
                  .from(schema.products)
                  .where(and(
                    eq(schema.products.businessId, businessId),
                    eq(schema.products.internalCode, p.internalCode),
                    isNull(schema.products.deletedAt)
                  ))
                  .limit(1);
              }
            }

            // 3. Fallback to SKU matching
            if (!existingProduct || existingProduct.length === 0) {
              if (p.sku) {
                existingProduct = await tx
                  .select()
                  .from(schema.products)
                  .where(and(
                    eq(schema.products.businessId, businessId),
                    eq(schema.products.sku, p.sku),
                    isNull(schema.products.deletedAt)
                  ))
                  .limit(1);
              }
            }

            // 4. Last resort: match by name
            if (!existingProduct || existingProduct.length === 0) {
              existingProduct = await tx
                .select()
                .from(schema.products)
                .where(and(
                  eq(schema.products.businessId, businessId),
                  eq(schema.products.name, p.name),
                  isNull(schema.products.deletedAt)
                ))
                .limit(1);
            }

            if (existingProduct && existingProduct.length > 0) {
              // UPDATE existing product
              const [updated] = await tx
                .update(schema.products)
                .set(productData)
                .where(eq(schema.products.id, existingProduct[0].id))
                .returning();
              insertedProducts.push(updated);
              updatedCount++;
            } else {
              // INSERT new product
              const [inserted] = await tx
                .insert(schema.products)
                .values(productData)
                .returning();
              insertedProducts.push(inserted);
            }
          }

          successCount = insertedProducts.length;

          // D. Upsert stock levels for products with existence > 0
          let targetWh = warehouses[0];
          if (validRows.some(vr => vr.parsed.existence > 0)) {
            if (!targetWh) {
              const [createdWh] = await tx
                .insert(schema.warehouses)
                .values({
                  name: 'Bodega Central',
                  code: 'BC',
                  businessId,
                })
                .returning();
              targetWh = createdWh;
              warehouses.push(targetWh);
            }

            // Upsert stock levels (update if exists, insert if new)
            for (let i = 0; i < validRows.length; i++) {
              const existence = validRows[i].parsed.existence;
              if (existence > 0) {
                const productId = insertedProducts[i].id;

                const currentStock = await this.ledgerService.getStockLevel(
                  tx,
                  productId,
                  targetWh.id,
                  null,
                );

                const delta = existence - currentStock;
                if (delta !== 0) {
                  await this.ledgerService.applyMovement(tx, {
                    businessId,
                    productId,
                    quantityDelta: delta,
                    eventType: currentStock === 0 ? 'initial' : 'adjustment',
                    warehouseId: targetWh.id,
                    notes: 'Ajuste de stock por importación (existencias)',
                  });
                }
              }
            }
          }
        });
      }

      // Update task record with results
      await db
        .update(schema.bulkImports)
        .set({
          status: 'completed',
          successCount,
          errorCount,
          totalRows: rows.length,
          errorDetails: errorDetails.length > 0 ? errorDetails : null,
          updatedAt: new Date(),
        })
        .where(eq(schema.bulkImports.id, importId));

    } catch (err: any) {
      console.error('Error processing bulk import background task:', err);
      try {
        await db
          .update(schema.bulkImports)
          .set({
            status: 'failed',
            errorDetails: [{ error: 'Error interno de procesamiento: ' + err.message }],
            updatedAt: new Date(),
          })
          .where(eq(schema.bulkImports.id, importId));
      } catch (dbErr) {
        console.error('Failed to log failed state to database:', dbErr);
      }
    }
  }
}

function recalculateSheetRange(sheet: any) {
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  const colLetterToIndex = (col: string) => {
    let index = 0;
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + (col.charCodeAt(i) - 64);
    }
    return index - 1;
  };

  const indexToColLetter = (index: number) => {
    let col = '';
    while (index >= 0) {
      col = String.fromCharCode((index % 26) + 65) + col;
      index = Math.floor(index / 26) - 1;
    }
    return col;
  };

  for (const key in sheet) {
    if (key.startsWith('!')) continue;
    
    const match = key.match(/^([A-Z]+)([0-9]+)$/);
    if (!match) continue;
    
    const colStr = match[1];
    const rowStr = match[2];
    
    const col = colLetterToIndex(colStr);
    const row = parseInt(rowStr, 10);
    
    if (col < minCol) minCol = col;
    if (col > maxCol) maxCol = col;
    if (row < minRow) minRow = row;
    if (row > maxRow) maxRow = row;
  }

  if (maxRow === -Infinity) {
    sheet['!ref'] = 'A1:A1';
  } else {
    const minColStr = indexToColLetter(minCol);
    const maxColStr = indexToColLetter(maxCol);
    sheet['!ref'] = `${minColStr}${minRow}:${maxColStr}${maxRow}`;
  }
}
