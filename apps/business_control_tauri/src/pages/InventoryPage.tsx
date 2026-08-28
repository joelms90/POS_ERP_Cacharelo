import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, Category, Product, Provider } from '../services/api';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { Badge } from '../components/atoms/Badge';
import { Heading } from '../components/atoms/Heading';
import { ToastContainer } from '../components/molecules/ToastNotification';

const ITEM_TYPE_LABELS: Record<string, string> = {
  raw_material: 'Materia Prima',
  wip: 'En Proceso',
  finished_good: 'Terminado',
  service: 'Servicio',
};

const PRODUCTION_STRATEGY_LABELS: Record<string, string> = {
  none: 'Sin producción',
  backflush: 'Backflush',
  work_order: 'Orden de Trabajo',
};

interface InventoryPageProps {
  businessId: string;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({ businessId }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  
  // Toast notifications state
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'warning' }>>([]);
  
  // Edit/Create Product State
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState<boolean>(false);
  // Import History states
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'deprecated' | 'bulk'>('products');
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [selectedImportDetails, setSelectedImportDetails] = useState<any | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inventory Audit & Kardex Modal States
  const [auditProduct, setAuditProduct] = useState<any | null>(null);
  const [auditMovements, setAuditMovements] = useState<any[]>([]);
  const [auditLocations, setAuditLocations] = useState<any[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState<boolean>(false);

  const handleOpenAudit = async (product: any) => {
    setAuditProduct(product);
    setIsAuditLoading(true);
    try {
      const existenceReport = await api.getInventoryExistenceReport({
        businessId,
        productId: product.id,
        consolidated: false,
      });

      const movements = await api.getInventoryKardexReport({
        businessId,
        productId: product.id,
      });

      setAuditLocations(existenceReport.data || []);
      setAuditMovements(movements || []);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar datos de auditoría.', 'error');
    } finally {
      setIsAuditLoading(false);
    }
  };
 
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);
 
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
 
  // Fetch all data
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [catsData, prodsData, provsData, stockData] = await Promise.all([
        api.getCategories(businessId),
        api.getProducts(businessId),
        api.getProviders(businessId).catch(() => [] as Provider[]),
        api.getStockLevels(businessId).catch(() => []),
      ]);
      setCategories(catsData);
      setProducts(prodsData);
      setProviders(provsData);
      setStockLevels(stockData);
    } catch (error: any) {
      showToast(error.message || 'Error al sincronizar catálogo de inventario.', 'error');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [businessId, showToast]);

  const fetchHistory = useCallback(async () => {
    try {
      const history = await api.getBulkImportHistory(businessId);
      setImportHistory(history);
    } catch (err: any) {
      console.error('Error fetching import history:', err);
    }
  }, [businessId]);

  useEffect(() => {
    fetchData();
    fetchHistory();
  }, [fetchData, fetchHistory]);

  useEffect(() => {
    if (activeSubTab === 'bulk') {
      fetchHistory();
    }
  }, [activeSubTab, fetchHistory]);

  // Polling loop for active background uploads
  useEffect(() => {
    const hasActiveImport = importHistory.some(h => h.status === 'pending' || h.status === 'processing');
    if (!hasActiveImport) return;

    const timer = setInterval(() => {
      fetchHistory();
    }, 3000);

    return () => clearInterval(timer);
  }, [importHistory, fetchHistory]);



  // Handle Product Save (Create or Update)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (!editingProduct.name?.trim() || editingProduct.name.trim().length < 2) {
      showToast('El nombre del producto debe tener al menos 2 caracteres.', 'error');
      return;
    }

    if (!editingProduct.categoryId) {
      showToast('Debe seleccionar una categoría válida.', 'error');
      return;
    }

    // Validate and format numbers
    const priceVal = editingProduct.price ? parseFloat(editingProduct.price) : 0;
    const costVal = editingProduct.cost ? parseFloat(editingProduct.cost) : 0;
    const priceWholesaleVal = editingProduct.priceWholesale ? parseFloat(editingProduct.priceWholesale) : 0;
    const minStockVal = editingProduct.minStock ? parseFloat(editingProduct.minStock) : 0;
    const maxStockVal = editingProduct.maxStock ? parseFloat(editingProduct.maxStock) : 0;

    if (isNaN(priceVal) || priceVal < 0) {
      showToast('El precio debe ser un número positivo.', 'error');
      return;
    }

    if (isNaN(costVal) || costVal < 0) {
      showToast('El costo debe ser un número positivo o cero.', 'error');
      return;
    }

    if (isNaN(priceWholesaleVal) || priceWholesaleVal < 0) {
      showToast('El precio de mayoreo debe ser un número positivo o cero.', 'error');
      return;
    }

    if (isNaN(minStockVal) || minStockVal < 0) {
      showToast('El inventario mínimo debe ser un número positivo o cero.', 'error');
      return;
    }

    if (isNaN(maxStockVal) || maxStockVal < 0) {
      showToast('El inventario máximo debe ser un número positivo o cero.', 'error');
      return;
    }

    setIsSavingProduct(true);
    try {
      const itemType = editingProduct.itemType || 'finished_good';
      const productionStrategy = editingProduct.productionStrategy || 'none';
      const uom = editingProduct.uom || 'piece';

      const itemTypeFlags: Record<string, { isIngredient: boolean; isSellable: boolean }> = {
        raw_material: { isIngredient: true, isSellable: false },
        wip: { isIngredient: false, isSellable: false },
        finished_good: { isIngredient: false, isSellable: true },
        service: { isIngredient: false, isSellable: true },
      };
      const flags = itemTypeFlags[itemType] || { isIngredient: false, isSellable: true };
      const saleType = uom === 'piece' ? 'pieza' : 'granel';

      const payload = {
        categoryId: editingProduct.categoryId,
        name: editingProduct.name.trim(),
        sku: editingProduct.sku?.trim() || undefined,
        barcode: editingProduct.barcode?.trim() || undefined,
        internalCode: editingProduct.internalCode?.trim() || undefined,
        providerId: editingProduct.providerId || undefined,
        cost: costVal.toFixed(2),
        price: priceVal.toFixed(2),
        priceWholesale: priceWholesaleVal.toFixed(2),
        minStock: minStockVal.toFixed(3),
        maxStock: maxStockVal.toFixed(3),
        saleType,
        itemType,
        productionStrategy,
        uom,
        isSellable: flags.isSellable,
        isIngredient: flags.isIngredient,
        isActive: editingProduct.isActive ?? true,
        imageUrl: editingProduct.imageUrl || undefined,
      };

      if (editingProduct.id) {
        // Update product
        const updated = await api.updateProduct(editingProduct.id, payload);
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        showToast(`Producto "${updated.name}" actualizado con éxito.`, 'success');
      } else {
        // Create product
        const created = await api.addProduct(payload, businessId);
        setProducts((prev) => [...prev, created]);
        showToast(`Producto "${created.name}" registrado con éxito.`, 'success');
      }
      setEditingProduct(null);
    } catch (error: any) {
      showToast(error.message || 'Error al guardar el producto.', 'error');
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Handle Product Delete
  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`¿Está seguro de eliminar el producto "${name}"?`)) {
      return;
    }

    try {
      await api.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      showToast(`Producto "${name}" eliminado.`, 'warning');
    } catch (error: any) {
      showToast(error.message || 'No se pudo eliminar el producto.', 'error');
    }
  };

  // Quick toggle product active/inactive status
  const toggleProductActive = async (product: Product) => {
    const newActiveState = product.isActive === false ? true : false;
    const actionWord = newActiveState ? 'activar' : 'inactivar';
    if (!window.confirm(`¿Está seguro de que desea ${actionWord} el producto "${product.name}"?`)) {
      return;
    }
    try {
      const updated = await api.updateProduct(product.id, { isActive: newActiveState });
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      showToast(`Producto "${updated.name}" ${newActiveState ? 'activado' : 'inactivado'} con éxito.`, 'success');
    } catch (error: any) {
      showToast(error.message || 'No se pudo cambiar el estado del producto.', 'error');
    }
  };

  // Export products catalog to CSV format (compatible with re-import)
  const exportProductsToCSV = () => {
    try {
      if (filteredProducts.length === 0) {
        showToast('No hay productos disponibles para exportar.', 'warning');
        return;
      }

      // Check for products without categories and warn user
      const productsWithoutCategory = filteredProducts.filter(p => !p.categoryId || !categories.find(c => c.id === p.categoryId));
      if (productsWithoutCategory.length > 0) {
        console.warn(`${productsWithoutCategory.length} productos sin categoría válida serán exportados como "General"`, productsWithoutCategory.map(p => p.name));
      }

      // CSV Header Row - aligned with import template format
      // ID is included for reliable UPSERT (update existing products)
      const headers = [
        'ID',
        'Código Interno',
        'Nombre del Producto',
        'Categoría',
        'Costo',
        'Precio Venta',
        'Precio Mayoreo',
        'Inv Mínimo',
        'Inv Máximo',
        'Tipo de Artículo',
        'Estrategia de Producción',
        'Unidad de Medida',
        'SKU',
        'Código Barras',
        'Existencia',
        'Proveedor'
      ];

      // Format individual cell helper
      const formatCell = (val: any) => {
        if (val === null || val === undefined) return '';
        const strVal = String(val).trim().replace(/"/g, '""'); // escape double quotes
        // For empty strings after trim, return empty to avoid ""
        if (strVal === '') return '';
        return `"${strVal}"`;
      };

      // Map rows - compatible with re-import
      const rows = filteredProducts.map((p) => {
        // Ensure every product has a valid category name
        let catName = 'General';
        if (p.categoryId) {
          const foundCat = categories.find(c => c.id === p.categoryId);
          if (foundCat && foundCat.name && foundCat.name.trim()) {
            catName = foundCat.name.trim();
          }
        }

        const providerName = providers.find(pr => pr.id === p.providerId)?.name || '';

        return [
          p.id, // Product ID for exact matching on re-import
          p.internalCode || '',
          p.name || '',
          catName,
          p.cost || '0.00',
          p.price || '0.00',
          p.priceWholesale || '0.00',
          p.minStock || '0',
          p.maxStock || '0',
          p.itemType || 'finished_good',
          p.productionStrategy || 'none',
          p.uom || 'piece',
          p.sku || '',
          p.barcode || '',
          '', // Existencia - left empty for re-import
          providerName
        ].map(formatCell).join(',');
      });

      // Join headers & rows
      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n'); // Add UTF-8 BOM for Excel support

      // Create download blob
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `catalogo_productos_${businessId}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast('Catálogo exportado exitosamente.', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Error al exportar catálogo.', 'error');
    }
  };

  // Download CSV template for spreadsheet import
  const downloadCSVTemplate = () => {
    const headers = [
      'Código Interno',
      'Nombre del Producto',
      'Categoría',
      'Costo',
      'Precio Venta',
      'Precio Mayoreo',
      'Inv Mínimo',
      'Inv Máximo',
      'Tipo de Artículo',
      'Estrategia de Producción',
      'Unidad de Medida',
      'SKU',
      'Código Barras',
      'Existencia',
      'Proveedor'
    ];
    const row = [
      '1',
      'Paste Arroz c/Leche',
      'PASTES',
      '15.00',
      '15.00',
      '0.00',
      '10',
      '100',
      'finished_good',
      'none',
      'piece',
      'SKU-ARROZ',
      '123456789',
      '50',
      'PLANTA PRODUCCION'
    ];
    
    // Include BOM character for proper Spanish characters opening in Excel
    const csvContent = '\uFEFF' + [headers.join(','), row.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_inventario.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import spreadsheet products mapping categories and providers (handles both xlsx and csv natively!)
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    showToast('Subiendo archivo al servidor...', 'warning');
    try {
      await api.uploadBulkFile(businessId, file);
      showToast('Archivo subido con éxito. Procesando en segundo plano...', 'success');
      setActiveSubTab('bulk'); // automatically switch to history tab so they can see progress!
      fetchHistory();
    } catch (err: any) {
      showToast('Error al subir archivo: ' + err.message, 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Filter products based on search, category and status
  const filteredProducts = products.filter((p) => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = 
      selectedCategoryFilter === 'all' || p.categoryId === selectedCategoryFilter;
    
    const matchesTab = activeSubTab === 'deprecated'
      ? p.isActive === false
      : p.isActive !== false;
    
    return matchesSearch && matchesCategory && matchesTab;
  });

  return (
    <div className="flex flex-col gap-8 h-full animate-fade-in relative font-sans">
      {/* Top Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-aged-bronze/10 pb-4">
        <div>
          <Heading level={2} className="!border-none !pb-0 font-light">
            Control de Inventario y Catálogo (v2.4 - CDN Load)
          </Heading>
          <p className="text-sm text-text-secondary mt-1 font-sans">
            Administra las categorías de platillos, bebidas e ingredientes de tu local, así como los precios de venta y costos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 border border-aged-bronze/40 hover:border-champagne-gold/60 bg-onyx-surface hover:bg-charcoal-surface/60 rounded text-sm text-text-secondary hover:text-champagne-gold font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-98"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin text-champagne-gold' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 3v2m-2.837 5.828l-2.83-2.829m0 0l-3.07 3.07M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Sincronizar Catálogo</span>
          </button>

          {!editingProduct && (
            <>
              <button
                onClick={downloadCSVTemplate}
                className="flex items-center gap-2 px-3 py-1.5 bg-charcoal-surface border border-aged-bronze/40 hover:border-champagne-gold/60 rounded text-xs text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                title="Descargar plantilla de Excel/CSV para llenar"
              >
                <svg className="w-4 h-4 text-champagne-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Descargar Plantilla</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 bg-charcoal-surface border border-aged-bronze/40 hover:border-champagne-gold/60 rounded text-xs text-text-secondary hover:text-text-primary transition-all cursor-pointer font-sans"
                title="Subir archivo Excel o CSV lleno"
              >
                <svg className="w-4 h-4 text-champagne-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Importar Excel / CSV</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                className="hidden"
                onChange={handleFileImport}
              />
            </>
          )}

          {!editingProduct && (
            <Button
              onClick={() => setEditingProduct({
                categoryId: categories[0]?.id || '',
                name: '',
                sku: '',
                barcode: '',
                internalCode: '',
                cost: '0.00',
                price: '0.00',
                priceWholesale: '0.00',
                minStock: '0.000',
                maxStock: '0.000',
                saleType: 'pieza',
                itemType: 'finished_good',
                productionStrategy: 'none',
                uom: 'piece',
                isSellable: true,
                isIngredient: false,
                isActive: true,
                imageUrl: '',
              })}
              disabled={categories.length === 0}
              className="flex items-center gap-2"
              title={categories.length === 0 ? "Primero registre una categoría" : "Agregar nuevo producto"}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Nuevo Producto</span>
            </Button>
          )}
        </div>
      </div>

      {isLoading && products.length === 0 && categories.length === 0 ? (
        /* Loader screen */
        <div className="flex-1 flex flex-col items-center justify-center min-h-[350px] gap-4">
          <svg className="animate-spin h-10 w-10 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xs text-text-secondary tracking-widest uppercase font-sans">
            Sincronizando Catálogo...
          </span>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-6">
          {/* Sub tabs navigation */}
          {!editingProduct && (
            <div className="flex border-b border-aged-bronze/25 gap-6 mb-2">
              <button
                onClick={() => setActiveSubTab('products')}
                className={`pb-3 text-sm font-medium tracking-wide transition-all border-b-2 cursor-pointer ${
                  activeSubTab === 'products'
                    ? 'border-champagne-gold text-champagne-gold font-semibold'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                Artículos y Catálogo
              </button>
              <button
                onClick={() => setActiveSubTab('deprecated')}
                className={`pb-3 text-sm font-medium tracking-wide transition-all border-b-2 cursor-pointer ${
                  activeSubTab === 'deprecated'
                    ? 'border-champagne-gold text-champagne-gold font-semibold'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                Deprecados / Inactivos
              </button>
              <button
                onClick={() => setActiveSubTab('bulk')}
                className={`pb-3 text-sm font-medium tracking-wide transition-all border-b-2 cursor-pointer ${
                  activeSubTab === 'bulk'
                    ? 'border-champagne-gold text-champagne-gold font-semibold'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                Cargas Masivas (Excel/CSV)
              </button>
            </div>
          )}

          {activeSubTab === 'bulk' && !editingProduct ? (
            <div className="flex flex-col gap-6 font-sans">
              {/* Upload card */}
              <div className="bg-onyx-surface border border-aged-bronze/40 rounded p-6 shadow-md shadow-black/10 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <Heading level={3} className="!text-champagne-gold !border-none !pb-0 font-light font-sans text-base">Subir Plantilla de Artículos</Heading>
                  <p className="text-xs text-text-secondary mt-1 font-sans">
                    Selecciona tu archivo de Excel (.xlsx, .xls) o CSV (.csv) para procesar el catálogo en segundo plano.
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={downloadCSVTemplate}
                    className="flex items-center gap-2 px-4 py-2 bg-charcoal-surface border border-aged-bronze/40 hover:border-champagne-gold/60 rounded text-xs text-text-secondary hover:text-text-primary transition-all cursor-pointer font-sans"
                  >
                    Descargar Plantilla
                  </button>
                  
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-champagne-gold hover:bg-champagne-gold/90 disabled:opacity-50 text-onyx font-semibold rounded text-xs transition-all cursor-pointer shadow-lg font-sans"
                  >
                    {isUploading ? 'Subiendo...' : 'Seleccionar Archivo'}
                  </button>
                </div>
              </div>

              {/* History log list card */}
              <div className="bg-onyx-surface border border-aged-bronze/40 rounded shadow-md shadow-black/20 overflow-hidden">
                <div className="p-6 border-b border-aged-bronze/25 flex items-center justify-between">
                  <Heading level={3} className="!text-champagne-gold !border-none !pb-0 font-light font-sans text-base">Historial de Importaciones</Heading>
                  <button onClick={fetchHistory} className="text-xs text-text-secondary hover:text-champagne-gold transition-colors font-sans cursor-pointer">
                    Actualizar Lista
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-charcoal-surface/60 border-b border-aged-bronze/35 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                        <th className="px-6 py-4">Fecha</th>
                        <th className="px-6 py-4">Archivo</th>
                        <th className="px-6 py-4">Estado</th>
                        <th className="px-6 py-4 text-right font-sans">Filas Totales</th>
                        <th className="px-6 py-4 text-right font-sans">Agregados</th>
                        <th className="px-6 py-4 text-right font-sans">Errores</th>
                        <th className="px-6 py-4 text-right font-sans">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-aged-bronze/10 text-xs">
                      {importHistory.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-8 text-center text-text-secondary italic font-sans">
                            No hay historial de importaciones registradas.
                          </td>
                        </tr>
                      ) : (
                        importHistory.map((history) => {
                          let statusBadge = (
                            <Badge variant="charcoal">{history.status}</Badge>
                          );
                          if (history.status === 'pending') {
                            statusBadge = <Badge variant="charcoal" className="bg-gray-500/20 text-gray-400 font-sans">Pendiente</Badge>;
                          } else if (history.status === 'processing') {
                            statusBadge = <Badge variant="warning" className="animate-pulse font-sans">Procesando</Badge>;
                          } else if (history.status === 'completed') {
                            statusBadge = (
                              <Badge variant="success" className="font-sans">
                                {history.errorCount > 0 ? 'Con observaciones' : 'Completado'}
                              </Badge>
                            );
                          } else if (history.status === 'failed') {
                            statusBadge = <Badge variant="error" className="font-sans">Fallado</Badge>;
                          }

                          return (
                            <tr key={history.id} className="hover:bg-charcoal-surface/20 transition-all font-sans">
                              <td className="px-6 py-4 text-text-secondary whitespace-nowrap">
                                {new Date(history.createdAt).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-text-primary font-medium font-mono">
                                {history.filename}
                              </td>
                              <td className="px-6 py-4">
                                {statusBadge}
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-text-primary">
                                {history.totalRows}
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-success-green font-semibold">
                                {history.successCount}
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-error-red font-semibold">
                                {history.errorCount}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={async () => {
                                    try {
                                      const details = await api.getBulkImportDetails(history.id);
                                      setSelectedImportDetails(details);
                                    } catch (err: any) {
                                      showToast('Error al cargar detalles: ' + err.message, 'error');
                                    }
                                  }}
                                  className="px-3 py-1 bg-charcoal-surface border border-aged-bronze/40 hover:border-champagne-gold/60 text-text-secondary hover:text-text-primary rounded text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer font-sans"
                                >
                                  Detalles
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : editingProduct ? (
              /* Product Edit/Create Form View */
              <div className="bg-onyx-surface border border-aged-bronze/40 rounded p-6 shadow-md shadow-black/20 animate-fade-in">
                <div className="flex items-center justify-between border-b border-aged-bronze/20 pb-4 mb-6">
                  <div>
                    <h3 className="text-lg font-light text-champagne-gold tracking-wide">
                      {editingProduct.id ? 'Modificar Producto' : 'Registrar Nuevo Producto'}
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {editingProduct.id ? 'Actualiza los atributos del producto seleccionado en el catálogo.' : 'Completa el formulario para añadir un nuevo elemento.'}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingProduct(null)}
                    className="text-text-secondary hover:text-text-primary p-1 border border-transparent hover:border-aged-bronze/35 rounded transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSaveProduct} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column Fields */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-text-secondary">Nombre del Producto *</label>
                      <Input
                        type="text"
                        placeholder="Ej. Tacos al Pastor (3 pzs)"
                        value={editingProduct.name || ''}
                        onChange={(e) => setEditingProduct(prev => ({ ...prev, name: e.target.value }))}
                        disabled={isSavingProduct}
                        required
                        data-testid="product-name"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-text-secondary">Categoría *</label>
                      <select
                        value={editingProduct.categoryId || ''}
                        onChange={(e) => setEditingProduct(prev => ({ ...prev, categoryId: e.target.value }))}
                        disabled={isSavingProduct}
                        className="w-full px-4 py-2 bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold focus:ring-champagne-gold/50 rounded font-sans text-text-primary transition-all duration-300 focus:outline-none focus:ring-2"
                        required
                        data-testid="product-category"
                      >
                        <option value="" disabled>Seleccione categoría</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-text-secondary">Código SKU</label>
                        <Input
                          type="text"
                          placeholder="OPCIONAL"
                          value={editingProduct.sku || ''}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev, sku: e.target.value }))}
                          disabled={isSavingProduct}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-text-secondary">Código de Barras</label>
                        <Input
                          type="text"
                          placeholder="OPCIONAL"
                          value={editingProduct.barcode || ''}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev, barcode: e.target.value }))}
                          disabled={isSavingProduct}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-text-secondary">Código Interno</label>
                        <Input
                          type="text"
                          placeholder="OPCIONAL"
                          value={editingProduct.internalCode || ''}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev, internalCode: e.target.value }))}
                          disabled={isSavingProduct}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-text-secondary">Unidad de Medida</label>
                        <select
                          value={editingProduct.uom || 'piece'}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev, uom: e.target.value }))}
                          disabled={isSavingProduct}
                          className="w-full px-4 py-2 bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold focus:ring-champagne-gold/50 rounded font-sans text-text-primary transition-all duration-300 focus:outline-none focus:ring-2 text-xs"
                          data-testid="product-uom"
                        >
                          <option value="piece">Pieza (unidad)</option>
                          <option value="kg">Kilogramo (kg)</option>
                          <option value="g">Gramo (g)</option>
                          <option value="l">Litro (l)</option>
                          <option value="ml">Mililitro (ml)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 mt-2">
                      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Imagen del Producto</label>
                      <div className="flex items-center gap-4">
                        {editingProduct.imageUrl && (
                          <div className="w-16 h-16 rounded overflow-hidden border border-aged-bronze bg-charcoal-surface flex items-center justify-center flex-shrink-0">
                            <img
                              src={editingProduct.imageUrl}
                              alt="preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <label className="flex-1 flex flex-col items-center justify-center h-16 border border-dashed border-aged-bronze/40 hover:border-champagne-gold/60 rounded cursor-pointer bg-charcoal-surface transition-all">
                          <div className="flex flex-col items-center justify-center text-center px-2">
                            <svg className="w-5 h-5 text-text-gold mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                            <p className="text-[10px] text-text-secondary">Subir imagen (redimensionado automático)</p>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const dataUrl = event.target?.result as string;
                                const img = new Image();
                                img.onload = () => {
                                  const maxDim = 400;
                                  let targetW = img.width;
                                  let targetH = img.height;
                                  if (targetW > maxDim || targetH > maxDim) {
                                    if (targetW > targetH) {
                                      targetH = Math.round((targetH / targetW) * maxDim);
                                      targetW = maxDim;
                                    } else {
                                      targetW = Math.round((targetW / targetH) * maxDim);
                                      targetH = maxDim;
                                    }
                                  }

                                  const canvas = document.createElement('canvas');
                                  canvas.width = targetW;
                                  canvas.height = targetH;
                                  const ctx = canvas.getContext('2d');
                                  if (ctx) {
                                    ctx.drawImage(img, 0, 0, targetW, targetH);
                                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
                                    setEditingProduct(prev => prev ? ({ ...prev, imageUrl: compressedDataUrl }) : null);
                                  } else {
                                    setEditingProduct(prev => prev ? ({ ...prev, imageUrl: dataUrl }) : null);
                                  }
                                };
                                img.src = dataUrl;
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                        {editingProduct.imageUrl && (
                          <button
                            type="button"
                            onClick={() => setEditingProduct(prev => prev ? ({ ...prev, imageUrl: undefined }) : null)}
                            className="text-xs text-red-400 hover:text-red-300 font-semibold"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column Fields */}
                  <div className="flex flex-col justify-between gap-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-text-secondary">Precio Venta ($) *</label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={editingProduct.price || ''}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev, price: e.target.value }))}
                          disabled={isSavingProduct}
                          required
                          data-testid="product-price"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-text-secondary">Costo Insumo ($)</label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={editingProduct.cost || ''}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev, cost: e.target.value }))}
                          disabled={isSavingProduct}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-text-secondary">Precio Mayoreo ($)</label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={editingProduct.priceWholesale || ''}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev, priceWholesale: e.target.value }))}
                          disabled={isSavingProduct}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-text-secondary">Inventario Mínimo</label>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="0.000"
                          value={editingProduct.minStock || ''}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev, minStock: e.target.value }))}
                          disabled={isSavingProduct}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-text-secondary">Inventario Máximo</label>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="0.000"
                          value={editingProduct.maxStock || ''}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev, maxStock: e.target.value }))}
                          disabled={isSavingProduct}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 p-4 bg-charcoal-surface/40 border border-aged-bronze/20 rounded mt-2">
                      <span className="text-xs font-semibold text-champagne-gold uppercase tracking-wider mb-1 block">
                        Propiedades del Artículo
                      </span>
                      
                      {/* Tipo de Artículo */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-text-secondary">Tipo de Artículo</label>
                        <select
                          value={editingProduct.itemType || 'finished_good'}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev, itemType: e.target.value }))}
                          disabled={isSavingProduct}
                          className="w-full px-4 py-2 bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold focus:ring-champagne-gold/50 rounded font-sans text-text-primary transition-all duration-300 focus:outline-none focus:ring-2 text-xs"
                          data-testid="product-item-type"
                        >
                          <option value="finished_good">Producto Terminado (se vende)</option>
                          <option value="raw_material">Materia Prima (insumo)</option>
                          <option value="wip">Producto en Proceso (WIP)</option>
                          <option value="service">Servicio</option>
                        </select>
                      </div>

                      {/* Estrategia de Producción */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-text-secondary">Estrategia de Producción</label>
                        <select
                          value={editingProduct.productionStrategy || 'none'}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev, productionStrategy: e.target.value }))}
                          disabled={isSavingProduct}
                          className="w-full px-4 py-2 bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold focus:ring-champagne-gold/50 rounded font-sans text-text-primary transition-all duration-300 focus:outline-none focus:ring-2 text-xs"
                          data-testid="product-production-strategy"
                        >
                          <option value="none">Ninguna (sin lógica automática)</option>
                          <option value="backflush">Backflush (descarga insumos al vender)</option>
                          <option value="work_order">Orden de Trabajo (producción por lotes)</option>
                        </select>
                      </div>

                      {/* Is Active Checkbox */}
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={editingProduct.isActive ?? true}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev, isActive: e.target.checked }))}
                          disabled={isSavingProduct}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all duration-300 ${
                          (editingProduct.isActive ?? true)
                            ? 'bg-champagne-gold border-champagne-gold text-obsidian'
                            : 'border-aged-bronze group-hover:border-champagne-gold/60 bg-onyx-surface'
                        }`}>
                          {(editingProduct.isActive ?? true) && (
                            <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-text-primary group-hover:text-champagne-gold transition-colors">
                            Producto Activo
                          </span>
                          <span className="text-[11px] text-text-secondary">
                            Si se desactiva, no aparecerá en reportes de venta ni en el POS.
                          </span>
                        </div>
                      </label>
                    </div>

                    {/* Provider Selector for Ingredients */}
                    {(editingProduct.itemType === 'raw_material') && (
                      <div className="flex flex-col gap-1.5 mt-2">
                        <label className="text-xs text-text-secondary font-medium tracking-wide">
                          Proveedor Principal
                        </label>
                        <select
                          value={editingProduct.providerId || ''}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev, providerId: e.target.value || undefined }))}
                          disabled={isSavingProduct}
                          className="bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold text-text-primary rounded-md p-3 font-sans text-xs focus:outline-none transition-all cursor-pointer"
                        >
                          <option value="">-- Sin Proveedor --</option>
                          {providers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="flex gap-4 items-center justify-end mt-4">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setEditingProduct(null)}
                        disabled={isSavingProduct}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSavingProduct}
                        data-testid="product-submit"
                      >
                        {isSavingProduct ? 'Guardando...' : 'Guardar Artículo'}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            ) : (
              /* Product Listing Table View */
              <div className="flex flex-col gap-4">
                
                {/* Search and Filters Bar */}
                <div className="flex flex-col md:flex-row gap-4 bg-onyx-surface border border-aged-bronze/40 rounded p-4 shadow-md shadow-black/10 items-center justify-between">
                  <div className="w-full md:w-72 relative">
                    <Input
                      type="text"
                      placeholder="Buscar por nombre, SKU o código..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                    <svg className="w-4 h-4 text-text-secondary absolute left-3.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary whitespace-nowrap">Filtrar Categoría:</span>
                      <select
                        value={selectedCategoryFilter}
                        onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                        className="px-3 py-1.5 bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold rounded font-sans text-xs text-text-primary transition-all duration-300 focus:outline-none cursor-pointer"
                      >
                        <option value="all">Todas las Categorías</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={exportProductsToCSV}
                      className="flex items-center gap-1.5 cursor-pointer font-semibold uppercase tracking-wider text-[10px]"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Exportar CSV
                    </Button>
                  </div>
                </div>

                {/* Products Table Card */}
                <div className="bg-onyx-surface border border-aged-bronze/40 rounded shadow-md shadow-black/20 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse select-text">
                      <thead>
                        <tr className="bg-charcoal-surface/60 border-b border-aged-bronze/35 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                          <th className="px-6 py-4">Producto</th>
                          <th className="px-6 py-4">Categoría</th>
                          <th className="px-6 py-4">Códigos SKU / EAN</th>
                          <th className="px-6 py-4 text-right">Existencia</th>
                          <th className="px-6 py-4 text-right">Costo</th>
                          <th className="px-6 py-4 text-right">Precio</th>
                          <th className="px-6 py-4">Destino</th>
                          <th className="px-6 py-4 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-aged-bronze/20 text-sm">
                        {filteredProducts.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-text-secondary italic">
                              {categories.length === 0 
                                ? 'Registre una categoría a la izquierda antes de agregar productos.'
                                : 'No se encontraron artículos en el inventario que coincidan con la búsqueda.'}
                            </td>
                          </tr>
                        ) : (
                          filteredProducts.map((p) => {
                            const catName = categories.find(c => c.id === p.categoryId)?.name || 'Sin Categoría';
                            
                            // Calculate total existence
                            const prodStock = stockLevels
                              .filter(sl => sl.productId === p.id)
                              .reduce((sum, sl) => sum + parseFloat(sl.quantity || '0'), 0);
                            
                            const minStock = parseFloat(p.minStock || '0');
                            const isLowStock = minStock > 0 && prodStock < minStock;
                            const displayStock = p.isIngredient ? prodStock.toFixed(3) : prodStock.toFixed(0);

                            return (
                              <tr key={p.id} className="hover:bg-charcoal-surface/20 transition-colors">
                                <td className="px-6 py-4 font-medium text-text-primary">
                                  <div className="flex items-center gap-3">
                                    {p.imageUrl ? (
                                      <img
                                        src={p.imageUrl}
                                        alt={p.name}
                                        className="w-8 h-8 rounded object-cover border border-aged-bronze/35 bg-charcoal-surface flex-shrink-0"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded border border-dashed border-aged-bronze/30 bg-charcoal-surface flex items-center justify-center text-text-secondary text-[9px] flex-shrink-0">
                                        N/A
                                      </div>
                                    )}
                                    <span>{p.name}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-text-secondary text-xs">
                                  <Badge variant="charcoal">{catName}</Badge>
                                </td>
                                <td className="px-6 py-4 text-xs font-mono text-text-secondary">
                                  <div className="flex flex-col gap-0.5">
                                    {p.sku && <span>SKU: {p.sku}</span>}
                                    {p.barcode && <span>EAN: {p.barcode}</span>}
                                    {p.internalCode && <span>Int: {p.internalCode}</span>}
                                    {p.providerId && (
                                      <span className="text-[10px] text-champagne-gold/75 mt-0.5 font-sans">
                                        Prov: {providers.find(prov => prov.id === p.providerId)?.name || 'Cargando...'}
                                      </span>
                                    )}
                                    {!p.sku && !p.barcode && !p.internalCode && !p.providerId && <span className="text-[10px] italic">-</span>}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-xs">
                                  <span className={isLowStock ? 'text-error-red font-bold animate-pulse' : 'text-text-primary font-medium'}>
                                    {displayStock}
                                  </span>
                                  {isLowStock && (
                                    <span className="text-[9px] text-error-red block font-sans font-normal">
                                      mín: {minStock}
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-xs text-text-secondary">
                                  ${p.cost || '0.00'}
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-xs text-text-secondary">
                                  <div className="flex flex-col items-end">
                                    <span className="font-semibold text-champagne-gold">${p.price || '0.00'}</span>
                                    {p.priceWholesale && parseFloat(p.priceWholesale) > 0 && (
                                      <span className="text-[10px] text-text-secondary font-normal font-sans">
                                        Mayoreo: ${p.priceWholesale}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-xs">
                                   <div className="flex flex-wrap gap-1.5 font-sans">
                                     {p.isActive === false ? (
                                       <Badge variant="error" className="bg-red-500/10 text-error-red border border-error-red/20">Deprecado</Badge>
                                     ) : (
                                       <>
                                         {(() => {
                                           const itemType = p.itemType || (p.isIngredient ? 'raw_material' : (p.isSellable === false ? 'wip' : 'finished_good'));
                                           return (
                                             <Badge variant="charcoal">
                                               {ITEM_TYPE_LABELS[itemType] || 'Producto'}
                                             </Badge>
                                           );
                                         })()}
                                         {p.productionStrategy && p.productionStrategy !== 'none' && (
                                           <Badge variant="warning">
                                             {PRODUCTION_STRATEGY_LABELS[p.productionStrategy] || p.productionStrategy}
                                           </Badge>
                                         )}
                                       </>
                                     )}
                                   </div>
                                 </td>
                                 <td className="px-6 py-4 text-center">
                                   <div className="inline-flex items-center justify-center gap-3">
                                      <button
                                        onClick={() => handleOpenAudit(p)}
                                        className="p-1 hover:text-champagne-gold text-text-secondary transition-colors focus:outline-none"
                                        title="Ver Auditoría y Kardex"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                        </svg>
                                      </button>
                                     <button
                                       onClick={() => setEditingProduct(p)}
                                       className="p-1 hover:text-champagne-gold text-text-secondary transition-colors focus:outline-none"
                                       title="Editar artículo"
                                     >
                                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                       </svg>
                                     </button>
                                     <button
                                       onClick={() => toggleProductActive(p)}
                                       className={`p-1 transition-colors focus:outline-none ${
                                         p.isActive === false
                                           ? 'hover:text-success-green text-text-secondary'
                                           : 'hover:text-warning-yellow/80 text-text-secondary'
                                       }`}
                                       title={p.isActive === false ? "Activar artículo" : "Inactivar artículo"}
                                     >
                                       {p.isActive === false ? (
                                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                         </svg>
                                       ) : (
                                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                         </svg>
                                       )}
                                     </button>
                                     <button
                                       onClick={() => handleDeleteProduct(p.id, p.name)}
                                       className="p-1 hover:text-error-red text-text-secondary transition-colors focus:outline-none"
                                       title="Eliminar artículo"
                                     >
                                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                       </svg>
                                     </button>
                                   </div>
                                 </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Table Footer Stats Bar */}
                  <div className="bg-charcoal-surface/40 border-t border-aged-bronze/35 px-6 py-3 flex items-center justify-between text-xs text-text-secondary">
                    <span>Mostrando {filteredProducts.length} de {products.length} productos</span>
                    <span className="font-mono">
                      Costo Promedio: ${
                        (products.reduce((acc, p) => acc + parseFloat(p.cost || '0'), 0) / (products.length || 1)).toFixed(2)
                      }
                    </span>
                  </div>
                </div>

              </div>
            )}
        </div>
      )}

      {/* Toast Notifications Queue */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Selected Import Details Modal */}
      {selectedImportDetails && (
        <div className="fixed inset-0 bg-obsidian/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-onyx-surface border border-aged-bronze/35 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-aged-bronze/25 flex items-center justify-between">
              <div>
                <Heading level={2} className="!text-champagne-gold !border-none !pb-0 font-light font-sans text-lg">
                  Reporte de Importación
                </Heading>
                <p className="text-xs text-text-secondary mt-1 font-mono">{selectedImportDetails.filename}</p>
              </div>
              <button 
                onClick={() => setSelectedImportDetails(null)}
                className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Metrics */}
            <div className="px-6 py-4 bg-charcoal-surface/30 border-b border-aged-bronze/10 grid grid-cols-3 gap-4 text-center">
              <div className="p-2 border border-aged-bronze/10 rounded">
                <span className="text-[10px] text-text-secondary uppercase block font-sans">Leídos</span>
                <span className="text-lg font-bold font-mono text-champagne-gold">{selectedImportDetails.totalRows}</span>
              </div>
              <div className="p-2 border border-success-green/20 bg-success-green/5 rounded">
                <span className="text-[10px] text-success-green uppercase block font-sans">Guardados</span>
                <span className="text-lg font-bold font-mono text-success-green">{selectedImportDetails.successCount}</span>
              </div>
              <div className="p-2 border border-error-red/20 bg-error-red/5 rounded">
                <span className="text-[10px] text-error-red uppercase block font-sans">Errores</span>
                <span className="text-lg font-bold font-mono text-error-red">{selectedImportDetails.errorCount}</span>
              </div>
            </div>

            {/* Errors List */}
            <div className="p-6 overflow-y-auto flex-1 text-xs">
              <Heading level={3} className="!text-text-primary !border-none !pb-2 font-normal font-sans text-sm">Bitácora de Observaciones</Heading>
              
              {!selectedImportDetails.errorDetails || selectedImportDetails.errorDetails.length === 0 ? (
                <div className="p-4 bg-success-green/10 border border-success-green/20 rounded text-success-green flex items-center gap-2 font-sans">
                  <span>✓</span> Todos los artículos se importaron correctamente sin observaciones.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {selectedImportDetails.errorDetails.map((detail: any, i: number) => (
                    <div key={i} className="p-2 bg-charcoal-surface border-l-2 border-error-red flex gap-3 text-text-primary font-sans text-xs">
                      <span className="font-mono text-text-secondary font-bold whitespace-nowrap">Fila {detail.rowNumber || '-'}:</span>
                      <span>{detail.error || String(detail)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-aged-bronze/25 flex justify-end">
              <Button onClick={() => setSelectedImportDetails(null)} className="font-sans text-xs">
                Cerrar Reporte
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Audit & Kardex Modal */}
      {auditProduct && (
        <div className="fixed inset-0 bg-obsidian/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-onyx-surface border border-aged-bronze/35 rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-aged-bronze/25 flex items-center justify-between">
              <div>
                <Heading level={2} className="!text-champagne-gold !border-none !pb-0 font-light font-sans text-lg">
                  Auditoría de Stock y Kardex de Movimientos
                </Heading>
                <p className="text-xs text-text-secondary mt-1 font-sans">
                  Producto: <span className="text-text-primary font-semibold">{auditProduct.name}</span>
                  {auditProduct.sku && ` (SKU: ${auditProduct.sku})`}
                  {auditProduct.internalCode && ` (Código: ${auditProduct.internalCode})`}
                </p>
              </div>
              <button 
                onClick={() => setAuditProduct(null)}
                className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              {isAuditLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <svg className="animate-spin h-8 w-8 text-champagne-gold" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-xs text-text-secondary">Cargando bitácora de movimientos...</span>
                </div>
              ) : (
                <>
                  {/* Integrity and Breakdown Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Catalog Summary */}
                    <div className="p-4 bg-charcoal-surface/30 border border-aged-bronze/10 rounded-lg flex flex-col gap-1">
                      <span className="text-[10px] text-text-secondary uppercase">Stock Consolidado (Catálogo)</span>
                      <span className="text-xl font-bold font-mono text-champagne-gold">
                        {(stockLevels
                          .filter(sl => sl.productId === auditProduct.id)
                          .reduce((sum, sl) => sum + parseFloat(sl.quantity || '0'), 0)
                        ).toFixed(auditProduct.isIngredient ? 3 : 0)}
                      </span>
                    </div>

                    {/* Physical Locations Sum */}
                    <div className="p-4 bg-charcoal-surface/30 border border-aged-bronze/10 rounded-lg flex flex-col gap-1">
                      <span className="text-[10px] text-text-secondary uppercase">Suma de Existencias Física</span>
                      <span className="text-xl font-bold font-mono text-text-primary">
                        {(auditLocations.reduce((sum, loc) => sum + loc.quantity, 0)).toFixed(auditProduct.isIngredient ? 3 : 0)}
                      </span>
                    </div>

                    {/* Integrity Validation Status */}
                    <div className={`p-4 border rounded-lg flex flex-col justify-center gap-1 ${
                      Math.abs(
                        (stockLevels
                          .filter(sl => sl.productId === auditProduct.id)
                          .reduce((sum, sl) => sum + parseFloat(sl.quantity || '0'), 0)
                        ) - auditLocations.reduce((sum, loc) => sum + loc.quantity, 0)
                      ) < 0.001
                        ? 'border-success-green/20 bg-success-green/5 text-success-green'
                        : 'border-warning-yellow/20 bg-warning-yellow/5 text-warning-yellow'
                    }`}>
                      <span className="text-[10px] uppercase opacity-75">Estado de Integridad</span>
                      <span className="text-sm font-bold flex items-center gap-1.5 font-sans">
                        {Math.abs(
                          (stockLevels
                            .filter(sl => sl.productId === auditProduct.id)
                            .reduce((sum, sl) => sum + parseFloat(sl.quantity || '0'), 0)
                          ) - auditLocations.reduce((sum, loc) => sum + loc.quantity, 0)
                        ) < 0.001 ? (
                          <>✓ Existencias Cuadradas</>
                        ) : (
                          <>⚠ Discrepancia Detectada</>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Existence Breakdown by Location */}
                  <div className="flex flex-col gap-2.5">
                    <h3 className="text-xs font-semibold text-champagne-gold uppercase tracking-wider">
                      Desglose de existencias por Ubicación
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {auditLocations.length === 0 ? (
                        <span className="text-xs text-text-secondary italic">No hay existencias registradas en ninguna bodega o sucursal.</span>
                      ) : (
                        auditLocations.map((loc, i) => (
                          <div key={i} className="p-3 bg-charcoal-surface border border-aged-bronze/15 rounded flex justify-between items-center">
                            <span className="text-xs text-text-primary font-medium">{loc.warehouseName || loc.branchName || 'Ubicación'}</span>
                            <span className="text-xs font-bold font-mono text-champagne-gold">
                              {loc.quantity.toFixed(auditProduct.isIngredient ? 3 : 0)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Movements Ledger (Kardex) */}
                  <div className="flex flex-col gap-2.5 flex-1">
                    <h3 className="text-xs font-semibold text-champagne-gold uppercase tracking-wider">
                      Ledger de Auditoría (Kardex)
                    </h3>
                    <div className="overflow-x-auto border border-aged-bronze/10 rounded max-h-[30vh]">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-aged-bronze/20 bg-charcoal-surface text-[10px] font-semibold text-text-secondary uppercase">
                            <th className="py-2 px-3">Fecha</th>
                            <th className="py-2 px-3">Ubicación</th>
                            <th className="py-2 px-3">Movimiento</th>
                            <th className="py-2 px-3 text-right">Variación</th>
                            <th className="py-2 px-3 text-right">S. Anterior</th>
                            <th className="py-2 px-3 text-right">S. Final</th>
                            <th className="py-2 px-3">Usuario</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-aged-bronze/5 text-[11px] font-sans">
                          {auditMovements.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-text-secondary italic">
                                No se registran movimientos históricos en el Kardex para este producto.
                              </td>
                            </tr>
                          ) : (
                            auditMovements.map((m) => {
                              const isPositive = m.quantity > 0;
                              const isInternal = m.type === 'transfer_out' || m.type === 'transfer_in';
                              
                              let typeLabel = m.type;
                              if (m.type === 'receipt') typeLabel = 'Compra Prov';
                              else if (m.type === 'sale') typeLabel = 'Venta POS';
                              else if (m.type === 'production_input') typeLabel = 'Consumo Ensamble';
                              else if (m.type === 'production_output') typeLabel = 'Entrada Ensamble';
                              else if (m.type === 'transfer_out') typeLabel = 'Traspaso Env';
                              else if (m.type === 'transfer_in') typeLabel = 'Traspaso Rec';
                              else if (m.type === 'adjustment') typeLabel = 'Ajuste Manual';
                              else if (m.type === 'initial') typeLabel = 'Inventario Inicial';

                              return (
                                <tr key={m.id} className="hover:bg-charcoal-surface/10">
                                  <td className="py-2 px-3 font-mono text-text-secondary whitespace-nowrap">
                                    {new Date(m.createdAt).toLocaleString('es-MX', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </td>
                                  <td className="py-2 px-3 text-text-primary whitespace-nowrap">
                                    {m.warehouseName || m.branchName || 'N/A'}
                                  </td>
                                  <td className="py-2 px-3 font-medium">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider ${
                                      isInternal 
                                        ? 'bg-warning-yellow/10 text-warning-yellow'
                                        : isPositive 
                                          ? 'bg-success-green/10 text-success-green'
                                          : 'bg-error-red/10 text-error-red'
                                    }`}>
                                      {typeLabel}
                                    </span>
                                  </td>
                                  <td className={`py-2 px-3 text-right font-mono font-bold ${
                                    isInternal 
                                      ? 'text-warning-yellow' 
                                      : isPositive 
                                        ? 'text-success-green' 
                                        : 'text-error-red'
                                  }`}>
                                    {isPositive ? '+' : ''}{m.quantity.toFixed(auditProduct.isIngredient ? 3 : 0)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-text-secondary">
                                    {m.previousBalance.toFixed(auditProduct.isIngredient ? 3 : 0)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-semibold text-text-primary">
                                    {m.finalBalance.toFixed(auditProduct.isIngredient ? 3 : 0)}
                                  </td>
                                  <td className="py-2 px-3 text-text-secondary truncate max-w-[120px]" title={m.createdByName}>
                                    {m.createdByName || 'Sistema'}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-aged-bronze/25 flex justify-end">
              <Button onClick={() => setAuditProduct(null)} className="font-sans text-xs">
                Cerrar Auditoría
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
