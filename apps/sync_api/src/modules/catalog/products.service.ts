import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductsRepository } from './repositories/products.repository';
import { CategoriesRepository } from './repositories/categories.repository';
import { ProvidersRepository } from '../providers/repositories/providers.repository';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import * as schema from '../../database/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { read, utils } from 'xlsx';

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
              saleType: row.saleType || 'pieza',
              isSellable: true,
              isIngredient: providerId ? true : false,
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

            await tx
              .insert(schema.stockLevels)
              .values({
                productId: product.id,
                warehouseId: targetWh.id,
                quantity: row.existence.toString(),
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
        const sku = getRowValue(row, 'SKU');
        const barcode = getRowValue(row, 'Código Barras') || getRowValue(row, 'Codigo Barras') || getRowValue(row, 'Codigo de Barras') || getRowValue(row, 'Barcode');
        const internalCode = getRowValue(row, 'Código Interno') || getRowValue(row, 'Codigo Interno') || getRowValue(row, 'Codigo');
        const existence = parseFloat(cleanNumber(getRowValue(row, 'Existencia') || getRowValue(row, 'Existencias') || getRowValue(row, 'Cantidad') || getRowValue(row, 'Stock')));
        const providerName = getRowValue(row, 'Proveedor') || getRowValue(row, 'Proveedores');
        
        validRows.push({
          row,
          rowNumber,
          parsed: {
            name,
            catName,
            cost,
            price,
            priceWholesale,
            minStock,
            maxStock,
            saleType,
            sku,
            barcode,
            internalCode,
            existence,
            providerName,
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

          // C. Prepare and insert products in bulk
          const productsToInsert = validRows.map(vr => {
            const p = vr.parsed;
            const category = categories.find(c => c.name.toLowerCase() === p.catName.toLowerCase())!;
            const provider = p.providerName ? providers.find(prov => prov.name.toLowerCase() === p.providerName.toLowerCase()) : null;
            const providerId = provider ? provider.id : null;
            
            return {
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
              saleType: p.saleType,
              isSellable: true,
              isIngredient: providerId ? true : false,
              businessId,
            };
          });

          const insertedProducts = await tx.insert(schema.products).values(productsToInsert).returning();
          successCount = insertedProducts.length;

          // D. Prepare and insert stock levels in bulk
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

            const stockLevelsToInsert = [];
            for (let i = 0; i < validRows.length; i++) {
              const existence = validRows[i].parsed.existence;
              if (existence > 0) {
                stockLevelsToInsert.push({
                  productId: insertedProducts[i].id,
                  warehouseId: targetWh.id,
                  quantity: existence.toString(),
                });
              }
            }

            if (stockLevelsToInsert.length > 0) {
              await tx.insert(schema.stockLevels).values(stockLevelsToInsert);
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
