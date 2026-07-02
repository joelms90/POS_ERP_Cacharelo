import React, { useState, useEffect } from 'react';
import { api, Product, Warehouse, RecipeItem, ProductionRun } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { FormField } from '../components/molecules/FormField';
import { Badge } from '../components/atoms/Badge';
import { Autocomplete } from '../components/molecules/Autocomplete';

interface AssemblyPageProps {
  businessId: string;
}

export const AssemblyPage: React.FC<AssemblyPageProps> = ({ businessId }) => {
  const [activeTab, setActiveTab] = useState<'recipes' | 'assembly'>('recipes');
  
  // Data loading states
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Tab 1: Recipes Config State
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [currentRecipeItems, setCurrentRecipeItems] = useState<RecipeItem[]>([]);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState<boolean>(false);
  const [isSavingRecipe, setIsSavingRecipe] = useState<boolean>(false);
  
  // Adding component to recipe state
  const [newIngredientId, setNewIngredientId] = useState<string>('');
  const [newQuantityNeeded, setNewQuantityNeeded] = useState<string>('');

  // Tab 2: Production Assembly Run State
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [selectedAssemblyProductId, setSelectedAssemblyProductId] = useState<string>('');
  const [qtyToProduce, setQtyToProduce] = useState<number>(1);
  const [assemblyNotes, setAssemblyNotes] = useState<string>('');
  const [isAssembling, setIsAssembling] = useState<boolean>(false);
  
  // Real-time stock state for selected warehouse
  const [warehouseStock, setWarehouseStock] = useState<any[]>([]);
  const [isLoadingStock, setIsLoadingStock] = useState<boolean>(false);

  // Production Run logs state
  const [productionRuns, setProductionRuns] = useState<ProductionRun[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [prods, whs] = await Promise.all([
        api.getProducts(businessId),
        api.getWarehouses(businessId),
      ]);
      setProducts(prods);
      setWarehouses(whs);
      
      if (whs.length > 0) {
        setSelectedWarehouseId(whs[0].id);
      }
    } catch (err: any) {
      console.error(err);
      alert('Error al cargar datos del catálogo y bodegas.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecipe = async (productId: string) => {
    if (!productId) {
      setCurrentRecipeItems([]);
      return;
    }
    try {
      setIsLoadingRecipe(true);
      const items = await api.getRecipe(productId);
      setCurrentRecipeItems(items);
    } catch (err: any) {
      console.error(err);
      alert('No se pudo cargar la receta del producto.');
    } finally {
      setIsLoadingRecipe(false);
    }
  };

  const fetchWarehouseStock = async (whId: string) => {
    if (!whId) return;
    try {
      setIsLoadingStock(true);
      const stock = await api.getStockLevels(businessId, whId);
      setWarehouseStock(stock);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingStock(false);
    }
  };

  const fetchProductionRuns = async () => {
    try {
      setIsLoadingRuns(true);
      const runs = await api.getProductionRuns(businessId);
      setProductionRuns(runs);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingRuns(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [businessId]);

  useEffect(() => {
    if (activeTab === 'assembly') {
      fetchProductionRuns();
      if (selectedWarehouseId) {
        fetchWarehouseStock(selectedWarehouseId);
      }
    }
  }, [activeTab, selectedWarehouseId]);

  // Handle parent product change in recipes tab
  const handleParentProductChange = (productId: string) => {
    setSelectedParentId(productId);
    fetchRecipe(productId);
  };

  // Add component to active recipe in state (local)
  const handleAddComponentToRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngredientId || !newQuantityNeeded || parseFloat(newQuantityNeeded) <= 0) return;

    const matchedProd = products.find(p => p.id === newIngredientId);
    if (!matchedProd) return;

    // Check if ingredient is already in the recipe
    if (currentRecipeItems.some(item => item.ingredientProductId === newIngredientId)) {
      alert('Este ingrediente ya está en la receta.');
      return;
    }

    const newItem: RecipeItem = {
      parentProductId: selectedParentId,
      ingredientProductId: newIngredientId,
      quantityNeeded: parseFloat(newQuantityNeeded),
      ingredientName: matchedProd.name,
      ingredientSku: matchedProd.sku,
    };

    setCurrentRecipeItems(prev => [...prev, newItem]);
    setNewIngredientId('');
    setNewQuantityNeeded('');
  };

  // Remove component from recipe in local state
  const handleRemoveComponentFromRecipe = (ingredientId: string) => {
    setCurrentRecipeItems(prev => prev.filter(item => item.ingredientProductId !== ingredientId));
  };

  // Save recipe to server
  const handleSaveRecipe = async () => {
    if (!selectedParentId) return;
    try {
      setIsSavingRecipe(true);
      await api.setRecipe({
        parentProductId: selectedParentId,
        items: currentRecipeItems.map(item => ({
          ingredientProductId: item.ingredientProductId,
          quantityNeeded: parseFloat(item.quantityNeeded.toString()),
        })),
      });
      alert('Receta guardada exitosamente.');
    } catch (err: any) {
      alert(err.message || 'Error al guardar la receta.');
    } finally {
      setIsSavingRecipe(false);
    }
  };

  // Execute Production Assembly Run
  const handleExecuteAssembly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouseId || !selectedAssemblyProductId || qtyToProduce <= 0) return;

    try {
      setIsAssembling(true);
      await api.assembleProduct({
        warehouseId: selectedWarehouseId,
        productId: selectedAssemblyProductId,
        quantityProduced: qtyToProduce,
        notes: assemblyNotes.trim() || undefined,
      });
      
      alert('¡Ensamble procesado exitosamente!');
      setQtyToProduce(1);
      setAssemblyNotes('');
      
      // Refresh logs & stock level
      fetchProductionRuns();
      fetchWarehouseStock(selectedWarehouseId);
    } catch (err: any) {
      alert(err.message || 'Error al procesar el ensamble.');
    } finally {
      setIsAssembling(false);
    }
  };

  // Filter products for BOM: typically sellable dishes that are NOT raw ingredients
  const assembledProductCandidates = products.filter(p => p.isSellable !== false && p.isIngredient !== true);
  // Filter ingredients: products designated as ingredients
  const ingredientCandidates = products.filter(p => p.isIngredient === true);

  // Calculate ingredient validation stats for active assembly selection
  const [selectedAssemblyRecipe, setSelectedAssemblyRecipe] = useState<RecipeItem[]>([]);
  
  useEffect(() => {
    const loadAssemblyRecipe = async () => {
      if (selectedAssemblyProductId) {
        try {
          const recipe = await api.getRecipe(selectedAssemblyProductId);
          setSelectedAssemblyRecipe(recipe);
        } catch {
          setSelectedAssemblyRecipe([]);
        }
      } else {
        setSelectedAssemblyRecipe([]);
      }
    };
    loadAssemblyRecipe();
  }, [selectedAssemblyProductId]);

  // Check if warehouse has enough stock for selected assembly run
  const recipeChecks = selectedAssemblyRecipe.map(item => {
    const requiredQty = parseFloat(item.quantityNeeded.toString()) * qtyToProduce;
    const stockRow = warehouseStock.find(s => s.productId === item.ingredientProductId);
    const availableQty = stockRow ? parseFloat(stockRow.quantity) : 0;
    const hasEnough = availableQty >= requiredQty;

    return {
      ...item,
      requiredQty,
      availableQty,
      hasEnough,
    };
  });

  const canAssemble = recipeChecks.length > 0 && recipeChecks.every(check => check.hasEnough);

  return (
    <div className="w-full lg:h-full min-h-full bg-obsidian p-2 lg:p-6 font-sans overflow-y-auto lg:overflow-hidden flex flex-col">
      {/* Page Tabs */}
      <div className="flex gap-4 border-b border-aged-bronze/30 pb-3 mb-6">
        <button
          onClick={() => setActiveTab('recipes')}
          className={`px-4 py-2 text-sm transition-all border-b-2 ${
            activeTab === 'recipes'
              ? 'border-champagne-gold text-champagne-gold font-medium'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Gestión de Recetas (BOM)
        </button>
        <button
          onClick={() => setActiveTab('assembly')}
          className={`px-4 py-2 text-sm transition-all border-b-2 ${
            activeTab === 'assembly'
              ? 'border-champagne-gold text-champagne-gold font-medium'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Ensamble de Productos
        </button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : activeTab === 'recipes' ? (
        /* Tab 1: Recipes Config Panel */
        <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-220px)] overflow-hidden">
          {/* Left panel: Product Selection */}
          <div className="w-full lg:w-80 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-5 flex flex-col overflow-hidden shadow-xl">
            <span className="text-xs text-text-secondary uppercase tracking-widest font-semibold mb-4">
              1. Seleccione Producto Terminado
            </span>
            <div className="flex-1 overflow-y-auto border border-aged-bronze/20 rounded divide-y divide-aged-bronze/10">
              {assembledProductCandidates.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleParentProductChange(p.id)}
                  className={`w-full text-left p-3 text-xs transition-colors hover:bg-charcoal-surface/40 ${
                    selectedParentId === p.id ? 'bg-charcoal-surface text-champagne-gold border-r-2 border-champagne-gold font-medium' : 'text-text-primary'
                  }`}
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="text-[10px] text-text-secondary mt-0.5">SKU: {p.sku || '-'}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Right panel: BOM Config workspace */}
          <div className="flex-1 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-6 flex flex-col overflow-hidden shadow-xl">
            {selectedParentId ? (
              <>
                <div className="flex justify-between items-center border-b border-aged-bronze/20 pb-4 mb-4">
                  <div>
                    <h3 className="text-base text-champagne-gold font-medium">
                      Ingredientes de Receta / BOM: {products.find(p => p.id === selectedParentId)?.name}
                    </h3>
                    <p className="text-[10px] text-text-secondary mt-0.5">
                      Defina la proporción de ingredientes para producir 1 unidad de este artículo.
                    </p>
                  </div>
                  <Button
                    onClick={handleSaveRecipe}
                    variant="primary"
                    size="sm"
                    disabled={isSavingRecipe}
                  >
                    {isSavingRecipe ? 'Guardando...' : 'Guardar Receta'}
                  </Button>
                </div>

                {/* Add ingredient inline form */}
                <form onSubmit={handleAddComponentToRecipe} className="flex flex-col sm:flex-row gap-4 items-end bg-charcoal-surface/30 p-4 rounded-md border border-aged-bronze/20 mb-6">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-[10px] text-text-secondary block mb-1 uppercase tracking-wider font-semibold">Ingrediente Componente</label>
                    <Autocomplete
                      options={ingredientCandidates.map(ing => ({
                        id: ing.id,
                        label: ing.name,
                        sublabel: ing.sku ? `SKU: ${ing.sku}` : undefined,
                      }))}
                      value={newIngredientId}
                      onChange={setNewIngredientId}
                      placeholder="Buscar ingrediente..."
                      required
                    />
                  </div>
                  
                  <div className="w-full sm:w-36">
                    <label className="text-[10px] text-text-secondary block mb-1 uppercase tracking-wider font-semibold">Cant. Necesaria</label>
                    <Input
                      type="number"
                      step="0.001"
                      placeholder="Ej. 0.250"
                      value={newQuantityNeeded}
                      onChange={(e) => setNewQuantityNeeded(e.target.value)}
                      required
                    />
                  </div>

                  <Button type="submit" variant="secondary" size="md">
                    Añadir
                  </Button>
                </form>

                {/* Ingredients list table */}
                <div className="flex-1 overflow-y-auto border border-aged-bronze/20 rounded-md">
                  {isLoadingRecipe ? (
                    <div className="flex h-48 items-center justify-center">
                      <svg className="animate-spin h-6 w-6 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  ) : currentRecipeItems.length === 0 ? (
                    <div className="flex flex-col h-48 items-center justify-center text-text-secondary text-xs italic">
                      No hay ingredientes registrados en esta receta. Use el formulario superior para añadir insumos.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-charcoal-surface border-b border-aged-bronze/30 text-text-secondary uppercase text-[10px] tracking-wider">
                          <th className="p-3 font-semibold">Ingrediente</th>
                          <th className="p-3 font-semibold">SKU</th>
                          <th className="p-3 font-semibold text-right">Cantidad por Unidad</th>
                          <th className="p-3 font-semibold text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-aged-bronze/10">
                        {currentRecipeItems.map((item, index) => (
                          <tr key={index} className="hover:bg-charcoal-surface/30 transition-colors">
                            <td className="p-3 font-medium text-text-primary">{item.ingredientName}</td>
                            <td className="p-3 text-text-secondary font-mono">{item.ingredientSku || '-'}</td>
                            <td className="p-3 text-right font-mono text-text-primary">{parseFloat(item.quantityNeeded.toString()).toFixed(3)}</td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveComponentFromRecipe(item.ingredientProductId)}
                                className="text-error-red hover:text-error-red/80 p-1"
                                title="Quitar componente"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-text-secondary text-xs italic">
                Seleccione un producto en el menú de la izquierda para comenzar a configurar su receta de ingredientes (BOM).
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Tab 2: Production Run Panel */
        <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-220px)] overflow-hidden">
          {/* Left / Main Workspace: Production Logs */}
          <div className="flex-1 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-5 flex flex-col overflow-hidden shadow-xl">
            <Heading level={2} className="!text-lg !border-none !pb-0 text-champagne-gold tracking-wide font-light mb-6">
              Historial de Órdenes de Ensamble / Producción
            </Heading>

            <div className="flex-1 overflow-y-auto border border-aged-bronze/20 rounded-md">
              {isLoadingRuns ? (
                <div className="flex h-48 items-center justify-center">
                  <svg className="animate-spin h-6 w-6 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : productionRuns.length === 0 ? (
                <div className="flex flex-col h-48 items-center justify-center text-text-secondary text-xs italic">
                  No se han registrado órdenes de ensamble de producción.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-charcoal-surface border-b border-aged-bronze/30 text-text-secondary uppercase text-[10px] tracking-wider">
                      <th className="p-3 font-semibold">Producto Terminado</th>
                      <th className="p-3 font-semibold">Bodega</th>
                      <th className="p-3 font-semibold text-right">Cant. Producida</th>
                      <th className="p-3 font-semibold">Fecha Ensamble</th>
                      <th className="p-3 font-semibold">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aged-bronze/10">
                    {productionRuns.map((run) => (
                      <tr key={run.id} className="hover:bg-charcoal-surface/30 transition-colors">
                        <td className="p-3 font-medium text-text-primary">{run.productName}</td>
                        <td className="p-3 text-text-secondary">{run.warehouseName}</td>
                        <td className="p-3 text-right font-mono text-champagne-gold font-medium">
                          {parseFloat(run.quantityProduced).toFixed(3)}
                        </td>
                        <td className="p-3 text-text-secondary">
                          {run.assembledAt ? new Date(run.assembledAt).toLocaleString() : '-'}
                        </td>
                        <td className="p-3 text-text-secondary truncate max-w-xs" title={run.notes || ''}>
                          {run.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right Panel: Run Assembly Exec form */}
          <div className="w-full lg:w-96 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-6 flex flex-col overflow-y-auto shadow-xl flex-shrink-0">
            <h3 className="text-base text-champagne-gold font-medium mb-6">
              Nueva Orden de Producción
            </h3>

            <form onSubmit={handleExecuteAssembly} className="flex flex-col gap-4">
              <FormField label="Bodega de Producción" required>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold text-xs text-text-primary p-2.5 rounded focus:outline-none"
                  required
                >
                  <option value="">-- Seleccionar Bodega --</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Producto a Ensamblar" required>
                <select
                  value={selectedAssemblyProductId}
                  onChange={(e) => setSelectedAssemblyProductId(e.target.value)}
                  className="w-full bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold text-xs text-text-primary p-2.5 rounded focus:outline-none"
                  required
                >
                  <option value="">-- Seleccionar Producto --</option>
                  {assembledProductCandidates.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Cantidad a Producir" required>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Ej. 10"
                  value={qtyToProduce}
                  onChange={(e) => setQtyToProduce(parseInt(e.target.value) || 1)}
                  required
                />
              </FormField>

              <FormField label="Notas / Detalles">
                <textarea
                  placeholder="Notas opcionales..."
                  value={assemblyNotes}
                  onChange={(e) => setAssemblyNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold text-text-primary rounded-md p-3 font-sans text-xs focus:outline-none transition-all resize-none"
                />
              </FormField>

              {/* Recipe Verification Stock Status */}
              {selectedAssemblyProductId && (
                <div className="mt-2 bg-charcoal-surface/30 border border-aged-bronze/25 rounded p-3">
                  <span className="text-[10px] text-text-secondary uppercase tracking-widest font-semibold block mb-2">
                    Validación de Stock Insumos
                  </span>

                  {isLoadingStock ? (
                    <div className="flex py-4 justify-center">
                      <svg className="animate-spin h-5 w-5 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  ) : recipeChecks.length === 0 ? (
                    <div className="text-[10px] text-error-red italic">
                      Este producto no tiene ingredientes configurados en su receta. Configure la receta primero.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {recipeChecks.map((check, index) => (
                        <div key={index} className="flex justify-between items-center text-[10px] border-b border-aged-bronze/10 pb-1.5 last:border-b-0">
                          <div>
                            <span className="text-text-primary block font-medium">{check.ingredientName}</span>
                            <span className="text-text-secondary">Req: {check.requiredQty.toFixed(2)} | Disp: {check.availableQty.toFixed(2)}</span>
                          </div>
                          <div>
                            {check.hasEnough ? (
                              <Badge variant="success">OK</Badge>
                            ) : (
                              <Badge variant="error">Falta</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                fullWidth
                className="mt-2"
                disabled={isAssembling || !canAssemble}
              >
                {isAssembling ? 'Procesando Ensamble...' : 'Procesar Ensamble'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
