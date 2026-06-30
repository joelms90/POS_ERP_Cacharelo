import React, { useState, useEffect, useCallback } from 'react';
import { api, Category, Product, Provider } from '../services/api';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { Badge } from '../components/atoms/Badge';
import { Heading } from '../components/atoms/Heading';
import { ToastContainer } from '../components/molecules/ToastNotification';

interface InventoryPageProps {
  businessId: string;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({ businessId }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  
  // Toast notifications state
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'warning' }>>([]);
  
  // Edit/Create Product State
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState<boolean>(false);

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
      const [catsData, prodsData, provsData] = await Promise.all([
        api.getCategories(businessId),
        api.getProducts(businessId),
        api.getProviders(businessId).catch(() => [] as Provider[]),
      ]);
      setCategories(catsData);
      setProducts(prodsData);
      setProviders(provsData);
    } catch (error: any) {
      showToast(error.message || 'Error al sincronizar catálogo de inventario.', 'error');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [businessId, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);



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
        saleType: editingProduct.saleType || 'pieza',
        isSellable: editingProduct.isSellable ?? true,
        isIngredient: editingProduct.isIngredient ?? false,
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

  // Filter products based on search and category
  const filteredProducts = products.filter((p) => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = 
      selectedCategoryFilter === 'all' || p.categoryId === selectedCategoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col gap-8 h-full animate-fade-in relative font-sans">
      {/* Top Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-aged-bronze/10 pb-4">
        <div>
          <Heading level={2} className="!border-none !pb-0 font-light">
            Control de Inventario y Catálogo
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
                isSellable: true,
                isIngredient: false,
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
          {editingProduct ? (
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
                        <label className="text-xs font-medium text-text-secondary">Tipo de Venta</label>
                        <select
                          value={editingProduct.saleType || 'pieza'}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev, saleType: e.target.value }))}
                          disabled={isSavingProduct}
                          className="w-full px-4 py-2 bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold focus:ring-champagne-gold/50 rounded font-sans text-text-primary transition-all duration-300 focus:outline-none focus:ring-2 text-xs"
                        >
                          <option value="pieza">Por Pieza (Unidad)</option>
                          <option value="granel">A Granel (Granel)</option>
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
                      
                      {/* Is Sellable Checkbox */}
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={editingProduct.isSellable ?? true}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev, isSellable: e.target.checked }))}
                          disabled={isSavingProduct}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all duration-300 ${
                          (editingProduct.isSellable ?? true)
                            ? 'bg-champagne-gold border-champagne-gold text-obsidian'
                            : 'border-aged-bronze group-hover:border-champagne-gold/60 bg-onyx-surface'
                        }`}>
                          {(editingProduct.isSellable ?? true) && (
                            <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-text-primary group-hover:text-champagne-gold transition-colors">
                            Artículo de Venta Directa
                          </span>
                          <span className="text-[11px] text-text-secondary">
                            Aparece en el menú para tomar órdenes.
                          </span>
                        </div>
                      </label>

                      {/* Is Ingredient Checkbox */}
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={editingProduct.isIngredient ?? false}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev, isIngredient: e.target.checked }))}
                          disabled={isSavingProduct}
                          className="sr-only"
                        />
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all duration-300 ${
                          (editingProduct.isIngredient ?? false)
                            ? 'bg-champagne-gold border-champagne-gold text-obsidian'
                            : 'border-aged-bronze group-hover:border-champagne-gold/60 bg-onyx-surface'
                        }`}>
                          {(editingProduct.isIngredient ?? false) && (
                            <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-text-primary group-hover:text-champagne-gold transition-colors">
                            Insumo / Ingrediente
                          </span>
                          <span className="text-[11px] text-text-secondary">
                            Utilizado para componer recetas o controlar inventarios.
                          </span>
                        </div>
                      </label>
                    </div>

                    {/* Provider Selector for Ingredients */}
                    {(editingProduct.isIngredient ?? false) && (
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

                  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <span className="text-xs text-text-secondary whitespace-nowrap">Filtrar Categoría:</span>
                    <select
                      value={selectedCategoryFilter}
                      onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                      className="px-3 py-1.5 bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold rounded font-sans text-xs text-text-primary transition-all duration-300 focus:outline-none"
                    >
                      <option value="all">Todas las Categorías</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
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
                          <th className="px-6 py-4 text-right">Costo</th>
                          <th className="px-6 py-4 text-right">Precio</th>
                          <th className="px-6 py-4">Destino</th>
                          <th className="px-6 py-4 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-aged-bronze/20 text-sm">
                        {filteredProducts.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-text-secondary italic">
                              {categories.length === 0 
                                ? 'Registre una categoría a la izquierda antes de agregar productos.'
                                : 'No se encontraron artículos en el inventario que coincidan con la búsqueda.'}
                            </td>
                          </tr>
                        ) : (
                          filteredProducts.map((p) => {
                            const catName = categories.find(c => c.id === p.categoryId)?.name || 'Sin Categoría';
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
                                  <div className="flex flex-wrap gap-1.5">
                                    {p.isSellable !== false && (
                                      <Badge variant="success">Venta</Badge>
                                    )}
                                    {p.isIngredient && (
                                      <Badge variant="warning">Insumo</Badge>
                                    )}
                                    {p.isSellable === false && !p.isIngredient && (
                                      <span className="text-[10px] text-text-secondary italic">Inactivo</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <div className="inline-flex items-center justify-center gap-3">
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
    </div>
  );
};
