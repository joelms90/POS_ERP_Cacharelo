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
  const [activeTab, setActiveTab] = useState<'recipes' | 'assembly'>('assembly');
  
  // Data loading states
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Tab 1: Recipes Config State
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [currentRecipeItems, setCurrentRecipeItems] = useState<RecipeItem[]>([]);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState<boolean>(false);
  const [isSavingRecipe, setIsSavingRecipe] = useState<boolean>(false);
  const [recipeProductSearch, setRecipeProductSearch] = useState<string>('');
  
  // Adding component to recipe state
  const [newIngredientId, setNewIngredientId] = useState<string>('');
  const [newQuantityNeeded, setNewQuantityNeeded] = useState<string>('');
  const [newWastePercent, setNewWastePercent] = useState<string>('0');

  // Tab 2: Production Assembly Run State
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [selectedDestinationWarehouseId, setSelectedDestinationWarehouseId] = useState<string>('');
  const [selectedAssemblyProductId, setSelectedAssemblyProductId] = useState<string>('');
  const [qtyToProduce, setQtyToProduce] = useState<number>(1);
  const [assemblyMode, setAssemblyMode] = useState<'planned' | 'immediate'>('planned');
  const [assemblyNotes, setAssemblyNotes] = useState<string>('');
  const [isAssembling, setIsAssembling] = useState<boolean>(false);
  const [generatingOc, setGeneratingOc] = useState<boolean>(false);
  const [runsSearch, setRunsSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled'>('all');

  // Modal for completing an OP
  const [completingOp, setCompletingOp] = useState<ProductionRun | null>(null);
  const [completeActualQty, setCompleteActualQty] = useState<number>(1);
  const [completeDestWarehouseId, setCompleteDestWarehouseId] = useState<string>('');
  const [completeNotes, setCompleteNotes] = useState<string>('');
  const [isCompletingOp, setIsCompletingOp] = useState<boolean>(false);
  
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
        setSelectedDestinationWarehouseId(whs[0].id);
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
      wastePercent: parseFloat(newWastePercent || '0'),
      ingredientName: matchedProd.name,
      ingredientSku: matchedProd.sku,
    };

    setCurrentRecipeItems(prev => [...prev, newItem]);
    setNewIngredientId('');
    setNewQuantityNeeded('');
    setNewWastePercent('0');
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
          wastePercent: item.wastePercent != null ? parseFloat(item.wastePercent.toString()) : 0,
        })),
      });
      alert('Receta guardada exitosamente.');
    } catch (err: any) {
      alert(err.message || 'Error al guardar la receta.');
    } finally {
      setIsSavingRecipe(false);
    }
  };

  // Execute Production Assembly Run or Create Planned OP
  const handleExecuteAssembly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouseId || !selectedAssemblyProductId || qtyToProduce <= 0) return;

    try {
      setIsAssembling(true);
      const destWhId = selectedDestinationWarehouseId || selectedWarehouseId;
      await api.assembleProduct({
        warehouseId: selectedWarehouseId,
        destinationWarehouseId: destWhId,
        productId: selectedAssemblyProductId,
        quantityProduced: qtyToProduce,
        status: assemblyMode === 'planned' ? 'pending' : 'completed',
        notes: assemblyNotes.trim() || undefined,
      });
      
      alert(
        assemblyMode === 'planned'
          ? '¡Orden de producción planificada creada exitosamente (Estado: Pendiente)!'
          : '¡Ensamble procesado e inventario actualizado exitosamente!'
      );
      setQtyToProduce(1);
      setAssemblyNotes('');
      
      // Refresh logs & stock level
      fetchProductionRuns();
      fetchWarehouseStock(selectedWarehouseId);
      if (destWhId !== selectedWarehouseId) {
        fetchWarehouseStock(destWhId);
      }
    } catch (err: any) {
      alert(err.message || 'Error al procesar la orden de producción.');
    } finally {
      setIsAssembling(false);
    }
  };

  const handleStartOp = async (opId: string) => {
    try {
      await api.startProductionRun(opId);
      await fetchProductionRuns();
    } catch (err: any) {
      alert(err.message || 'Error al iniciar la orden de producción.');
    }
  };

  const handleOpenCompleteModal = (run: ProductionRun) => {
    setCompletingOp(run);
    setCompleteActualQty(parseFloat(run.quantityProduced) || 1);
    setCompleteDestWarehouseId(run.destinationWarehouseId || run.warehouseId || (warehouses[0]?.id ?? ''));
    setCompleteNotes(run.notes || '');
  };

  const handleConfirmCompleteOp = async () => {
    if (!completingOp || completeActualQty <= 0) return;
    try {
      setIsCompletingOp(true);
      await api.completeProductionRun(completingOp.id, {
        actualQuantityProduced: completeActualQty,
        destinationWarehouseId: completeDestWarehouseId || undefined,
        notes: completeNotes.trim() || undefined,
      });
      alert('¡Orden de producción completada y stock actualizado exitosamente!');
      setCompletingOp(null);
      await fetchProductionRuns();
      if (completingOp.warehouseId) {
        fetchWarehouseStock(completingOp.warehouseId);
      }
      if (completeDestWarehouseId && completeDestWarehouseId !== completingOp.warehouseId) {
        fetchWarehouseStock(completeDestWarehouseId);
      }
    } catch (err: any) {
      alert(err.message || 'Error al completar la orden de producción.');
    } finally {
      setIsCompletingOp(false);
    }
  };

  const handleCancelOp = async (opId: string) => {
    if (!window.confirm('¿Está seguro de que desea cancelar esta orden de producción?')) return;
    try {
      await api.cancelProductionRun(opId);
      await fetchProductionRuns();
    } catch (err: any) {
      alert(err.message || 'Error al cancelar la orden de producción.');
    }
  };

  // Generate a purchase order for the ingredients that are missing stock
  const handleGenerateOcForMissing = async () => {
    const missing = recipeChecks.filter((c) => !c.hasEnough);
    if (missing.length === 0) return;

    setGeneratingOc(true);
    try {
      const result = await api.generatePurchaseOrdersByProducts(
        missing.map((c) => ({
          productId: c.ingredientProductId,
          quantity: Math.max(0, c.requiredQty - c.availableQty),
        })),
        businessId,
      );
      const totalItems = result.purchaseOrders.reduce((sum, po) => sum + po.itemCount, 0);
      alert(`Se generaron ${result.purchaseOrders.length} OC con ${totalItems} insumos faltantes.`);
    } catch (err: any) {
      alert(err.message || 'Error al generar OC de faltantes.');
    } finally {
      setGeneratingOc(false);
    }
  };

  // Filter products for BOM: parents are FinishedGood or Wip; components are RawMaterial or Wip.
  const resolveItemType = (p: Product) =>
    p.itemType || (p.isIngredient ? 'raw_material' : (p.isSellable === false ? 'wip' : 'finished_good'));

  const assembledProductCandidates = products.filter(p => {
    const it = resolveItemType(p);
    return it === 'finished_good' || it === 'wip';
  });

  const ingredientCandidates = products.filter(p => {
    const it = resolveItemType(p);
    return it === 'raw_material' || it === 'wip';
  });

  const filteredParentProducts = assembledProductCandidates.filter((p) => {
    if (!recipeProductSearch.trim()) return true;
    const q = recipeProductSearch.toLowerCase().trim();
    return p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
  });

  const filteredRuns = productionRuns.filter((run) => {
    if (statusFilter !== 'all' && run.status !== statusFilter) {
      return false;
    }
    if (!runsSearch.trim()) return true;
    const q = runsSearch.toLowerCase().trim();
    return (
      (run.productName && run.productName.toLowerCase().includes(q)) ||
      (run.productSku && run.productSku.toLowerCase().includes(q)) ||
      (run.warehouseName && run.warehouseName.toLowerCase().includes(q)) ||
      (run.destinationWarehouseName && run.destinationWarehouseName.toLowerCase().includes(q)) ||
      (run.notes && run.notes.toLowerCase().includes(q))
    );
  });

  const pendingCount = productionRuns.filter((r) => r.status === 'pending').length;
  const inProgressCount = productionRuns.filter((r) => r.status === 'in_progress').length;
  const completedCount = productionRuns.filter((r) => r.status === 'completed').length;
  const cancelledCount = productionRuns.filter((r) => r.status === 'cancelled').length;

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
          onClick={() => setActiveTab('assembly')}
          className={`px-4 py-2 text-sm transition-all border-b-2 ${
            activeTab === 'assembly'
              ? 'border-champagne-gold text-champagne-gold font-medium'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Ensamble de Productos
        </button>
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
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs text-text-secondary uppercase tracking-widest font-semibold">
                1. Seleccione Producto
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-charcoal-surface text-champagne-gold border border-aged-bronze/30 font-mono">
                {filteredParentProducts.length} de {assembledProductCandidates.length}
              </span>
            </div>

            {/* Real-time search filter */}
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Buscar producto o SKU..."
                value={recipeProductSearch}
                onChange={(e) => setRecipeProductSearch(e.target.value)}
                className="w-full bg-charcoal-surface border border-aged-bronze/40 focus:border-champagne-gold text-xs text-text-primary pl-8 pr-7 py-2 rounded focus:outline-none placeholder:text-text-secondary/50 transition-all"
              />
              <svg className="w-4 h-4 text-text-secondary absolute left-2.5 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {recipeProductSearch && (
                <button
                  type="button"
                  onClick={() => setRecipeProductSearch('')}
                  className="absolute right-2 top-2 text-text-secondary hover:text-text-primary text-xs w-5 h-5 flex items-center justify-center rounded-full hover:bg-aged-bronze/20"
                  title="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto border border-aged-bronze/20 rounded divide-y divide-aged-bronze/10">
              {filteredParentProducts.length === 0 ? (
                <div className="p-4 text-center text-xs text-text-secondary italic">
                  No se encontraron productos que coincidan con &quot;{recipeProductSearch}&quot;
                </div>
              ) : (
                filteredParentProducts.map(p => (
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
                ))
              )}
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

                  <div className="w-full sm:w-28">
                    <label className="text-[10px] text-text-secondary block mb-1 uppercase tracking-wider font-semibold">Merma %</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={newWastePercent}
                      onChange={(e) => setNewWastePercent(e.target.value)}
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
                          <th className="p-3 font-semibold text-right">Merma %</th>
                          <th className="p-3 font-semibold text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-aged-bronze/10">
                        {currentRecipeItems.map((item, index) => (
                          <tr key={index} className="hover:bg-charcoal-surface/30 transition-colors">
                            <td className="p-3 font-medium text-text-primary">{item.ingredientName}</td>
                            <td className="p-3 text-text-secondary font-mono">{item.ingredientSku || '-'}</td>
                            <td className="p-3 text-right font-mono text-text-primary">{parseFloat(item.quantityNeeded.toString()).toFixed(3)}</td>
                            <td className="p-3 text-right font-mono text-text-secondary">{item.wastePercent != null ? parseFloat(item.wastePercent.toString()).toFixed(2) : '0.00'}</td>
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
          {/* Left / Main Workspace: Production Logs & OP Management */}
          <div className="flex-1 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-5 flex flex-col overflow-hidden shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div>
                <Heading level={2} className="!text-lg !border-none !pb-0 text-champagne-gold tracking-wide font-light">
                  Gestión de Órdenes de Producción (OP)
                </Heading>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Planifique, asigne y complete las órdenes de producción entre bodegas.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-48 sm:w-56">
                  <input
                    type="text"
                    placeholder="Filtrar por producto, bodega o SKU..."
                    value={runsSearch}
                    onChange={(e) => setRunsSearch(e.target.value)}
                    className="w-full bg-charcoal-surface border border-aged-bronze/40 focus:border-champagne-gold text-xs text-text-primary pl-8 pr-7 py-1.5 rounded focus:outline-none placeholder:text-text-secondary/50"
                  />
                  <svg className="w-3.5 h-3.5 text-text-secondary absolute left-2.5 top-2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {runsSearch && (
                    <button
                      type="button"
                      onClick={() => setRunsSearch('')}
                      className="absolute right-2 top-1.5 text-text-secondary hover:text-text-primary text-xs w-4 h-4 flex items-center justify-center rounded-full"
                      title="Limpiar filtro"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Status Filter Pills */}
            <div className="flex flex-wrap gap-2 mb-4 border-b border-aged-bronze/20 pb-3">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${
                  statusFilter === 'all'
                    ? 'bg-champagne-gold text-charcoal-surface font-semibold shadow-md'
                    : 'bg-charcoal-surface/60 text-text-secondary hover:text-text-primary border border-aged-bronze/30'
                }`}
              >
                Todas ({productionRuns.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-all flex items-center gap-1.5 ${
                  statusFilter === 'pending'
                    ? 'bg-champagne-gold/20 text-champagne-gold border border-champagne-gold font-semibold'
                    : 'bg-charcoal-surface/60 text-text-secondary hover:text-text-primary border border-aged-bronze/30'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-champagne-gold"></span>
                Pendientes ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('in_progress')}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-all flex items-center gap-1.5 ${
                  statusFilter === 'in_progress'
                    ? 'bg-aged-bronze/30 text-champagne-gold border border-aged-bronze font-semibold'
                    : 'bg-charcoal-surface/60 text-text-secondary hover:text-text-primary border border-aged-bronze/30'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-aged-bronze animate-pulse"></span>
                En Proceso ({inProgressCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-all flex items-center gap-1.5 ${
                  statusFilter === 'completed'
                    ? 'bg-success-green/20 text-success-green border border-success-green/50 font-semibold'
                    : 'bg-charcoal-surface/60 text-text-secondary hover:text-text-primary border border-aged-bronze/30'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-success-green"></span>
                Completadas ({completedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('cancelled')}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-all flex items-center gap-1.5 ${
                  statusFilter === 'cancelled'
                    ? 'bg-error-red/20 text-error-red border border-error-red/50 font-semibold'
                    : 'bg-charcoal-surface/60 text-text-secondary hover:text-text-primary border border-aged-bronze/30'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-error-red"></span>
                Canceladas ({cancelledCount})
              </button>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto border border-aged-bronze/20 rounded-md">
              {isLoadingRuns ? (
                <div className="flex h-48 items-center justify-center">
                  <svg className="animate-spin h-6 w-6 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : filteredRuns.length === 0 ? (
                <div className="flex flex-col h-48 items-center justify-center text-text-secondary text-xs italic">
                  {runsSearch || statusFilter !== 'all'
                    ? 'No se encontraron órdenes de producción que coincidan con los filtros aplicados.'
                    : 'No se han registrado órdenes de ensamble o producción.'}
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-charcoal-surface border-b border-aged-bronze/30 text-text-secondary uppercase text-[10px] tracking-wider sticky top-0 z-10">
                      <th className="p-3 font-semibold">Producto Terminado</th>
                      <th className="p-3 font-semibold">Ruta (Origen ➔ Destino)</th>
                      <th className="p-3 font-semibold text-right">Cant. (Plan / Real)</th>
                      <th className="p-3 font-semibold text-center">Estado</th>
                      <th className="p-3 font-semibold">Fecha / Hora</th>
                      <th className="p-3 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aged-bronze/10">
                    {filteredRuns.map((run) => {
                      const isPending = run.status === 'pending';
                      const isInProgress = run.status === 'in_progress';
                      const isCompleted = run.status === 'completed';
                      const isCancelled = run.status === 'cancelled';

                      return (
                        <tr key={run.id} className="hover:bg-charcoal-surface/30 transition-colors">
                          <td className="p-3">
                            <div className="font-medium text-text-primary">{run.productName}</div>
                            {run.productSku && (
                              <div className="text-[10px] text-text-secondary font-mono">SKU: {run.productSku}</div>
                            )}
                            {run.notes && (
                              <div className="text-[10px] text-text-secondary/70 italic truncate max-w-xs mt-0.5" title={run.notes}>
                                &quot;{run.notes}&quot;
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-text-secondary">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="text-text-primary">{run.warehouseName}</span>
                              <span className="text-champagne-gold">➔</span>
                              <span className="text-champagne-gold font-medium">
                                {run.destinationWarehouseName || run.warehouseName}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono">
                            <div className="text-text-primary font-medium">
                              {parseFloat(run.quantityProduced).toFixed(2)}
                            </div>
                            {run.actualQuantityProduced && isCompleted && (
                              <div className="text-[10px] text-success-green">
                                Real: {parseFloat(run.actualQuantityProduced).toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {isPending && <Badge variant="warning">Pendiente</Badge>}
                            {isInProgress && <Badge variant="gold">En Proceso</Badge>}
                            {isCompleted && <Badge variant="success">Completada</Badge>}
                            {isCancelled && <Badge variant="error">Cancelada</Badge>}
                          </td>
                          <td className="p-3 text-text-secondary text-[11px]">
                            {run.assembledAt
                              ? new Date(run.assembledAt).toLocaleString()
                              : run.createdAt
                              ? new Date(run.createdAt).toLocaleString()
                              : '-'}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isPending && (
                                <>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="!text-[10px] !py-1 !px-2"
                                    onClick={() => handleStartOp(run.id)}
                                    title="Marcar como En Proceso"
                                  >
                                    Iniciar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    className="!text-[10px] !py-1 !px-2"
                                    onClick={() => handleOpenCompleteModal(run)}
                                    title="Completar y descontar stock"
                                  >
                                    Completar
                                  </Button>
                                  <button
                                    type="button"
                                    onClick={() => handleCancelOp(run.id)}
                                    className="text-error-red hover:text-error-red/80 text-xs p-1"
                                    title="Cancelar Orden"
                                  >
                                    ✕
                                  </button>
                                </>
                              )}

                              {isInProgress && (
                                <>
                                  <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    className="!text-[10px] !py-1 !px-2.5"
                                    onClick={() => handleOpenCompleteModal(run)}
                                    title="Finalizar y entregar producción"
                                  >
                                    Finalizar
                                  </Button>
                                  <button
                                    type="button"
                                    onClick={() => handleCancelOp(run.id)}
                                    className="text-error-red hover:text-error-red/80 text-xs p-1"
                                    title="Cancelar Orden"
                                  >
                                    ✕
                                  </button>
                                </>
                              )}

                              {isCompleted && (
                                <span className="text-[10px] text-success-green font-medium flex items-center gap-1">
                                  ✓ Entregada
                                </span>
                              )}

                              {isCancelled && (
                                <span className="text-[10px] text-error-red italic">
                                  Cancelada
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right Panel: New Production Order Form */}
          <div className="w-full lg:w-96 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-6 flex flex-col overflow-y-auto shadow-xl flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base text-champagne-gold font-medium">
                Nueva Orden de Producción
              </h3>
            </div>

            {/* Mode selection toggle */}
            <div className="bg-charcoal-surface/60 p-1 rounded-lg border border-aged-bronze/30 flex gap-1 mb-4">
              <button
                type="button"
                onClick={() => setAssemblyMode('planned')}
                className={`flex-1 py-1.5 text-[11px] rounded font-medium transition-all text-center ${
                  assemblyMode === 'planned'
                    ? 'bg-champagne-gold text-charcoal-surface font-semibold shadow'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                📋 Planificar OP
              </button>
              <button
                type="button"
                onClick={() => setAssemblyMode('immediate')}
                className={`flex-1 py-1.5 text-[11px] rounded font-medium transition-all text-center ${
                  assemblyMode === 'immediate'
                    ? 'bg-champagne-gold text-charcoal-surface font-semibold shadow'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                ⚡ Ensamble Directo
              </button>
            </div>

            <p className="text-[10px] text-text-secondary mb-4 italic">
              {assemblyMode === 'planned'
                ? 'Crea una OP en estado "Pendiente" para que el equipo de cocina/taller la ejecute y descuente insumos al finalizar.'
                : 'Ejecuta el ensamble y descuenta los insumos del inventario inmediatamente en un solo paso.'}
            </p>

            <form onSubmit={handleExecuteAssembly} className="flex flex-col gap-4">
              <FormField label="Bodega Origen (Consumo de Insumos)" required>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => {
                    setSelectedWarehouseId(e.target.value);
                    if (!selectedDestinationWarehouseId) {
                      setSelectedDestinationWarehouseId(e.target.value);
                    }
                  }}
                  className="w-full bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold text-xs text-text-primary p-2.5 rounded focus:outline-none"
                  required
                >
                  <option value="">-- Seleccionar Bodega Origen --</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Bodega Destino (Entrega de Producto Terminado)" required>
                <select
                  value={selectedDestinationWarehouseId}
                  onChange={(e) => setSelectedDestinationWarehouseId(e.target.value)}
                  className="w-full bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold text-xs text-text-primary p-2.5 rounded focus:outline-none"
                  required
                >
                  <option value="">-- Seleccionar Bodega Destino --</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Producto a Producir" required>
                <Autocomplete
                  options={assembledProductCandidates.map(p => ({
                    id: p.id,
                    label: p.name,
                    sublabel: p.sku ? `SKU: ${p.sku}` : undefined,
                  }))}
                  value={selectedAssemblyProductId}
                  onChange={setSelectedAssemblyProductId}
                  placeholder="Buscar producto por nombre o SKU..."
                  required
                />
              </FormField>

              <FormField label="Cantidad a Producir" required>
                <Input
                  type="number"
                  min="0.001"
                  step="any"
                  placeholder="Ej. 10"
                  value={qtyToProduce}
                  onChange={(e) => setQtyToProduce(parseFloat(e.target.value) || 1)}
                  required
                />
              </FormField>

              <FormField label="Notas / Instrucciones de Producción">
                <textarea
                  placeholder="Instrucciones especiales para el operario/cocinero..."
                  value={assemblyNotes}
                  onChange={(e) => setAssemblyNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold text-text-primary rounded-md p-3 font-sans text-xs focus:outline-none transition-all resize-none"
                />
              </FormField>

              {/* Recipe Verification Stock Status */}
              {selectedAssemblyProductId && (
                <div className="mt-2 bg-charcoal-surface/30 border border-aged-bronze/25 rounded p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-text-secondary uppercase tracking-widest font-semibold block">
                      Disponibilidad en Bodega Origen
                    </span>
                    <span className="text-[10px] text-champagne-gold font-medium">
                      {warehouses.find(w => w.id === selectedWarehouseId)?.name || 'Bodega'}
                    </span>
                  </div>

                  {isLoadingStock ? (
                    <div className="flex py-4 justify-center">
                      <svg className="animate-spin h-5 w-5 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  ) : recipeChecks.length === 0 ? (
                    <div className="text-[10px] text-error-red italic">
                      Este producto no tiene ingredientes configurados en su receta. Configure la receta en la pestaña anterior.
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
                      {recipeChecks.some((c) => !c.hasEnough) && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={generatingOc}
                          onClick={handleGenerateOcForMissing}
                        >
                          {generatingOc ? 'Generando...' : 'Generar OC de faltantes'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                fullWidth
                className="mt-2"
                disabled={
                  isAssembling ||
                  !selectedWarehouseId ||
                  !selectedAssemblyProductId ||
                  qtyToProduce <= 0 ||
                  (assemblyMode === 'immediate' && !canAssemble)
                }
              >
                {isAssembling
                  ? 'Procesando...'
                  : assemblyMode === 'planned'
                  ? '📋 Crear Orden de Producción'
                  : '⚡ Procesar Ensamble Inmediato'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Completion Modal */}
      {completingOp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-onyx-surface border border-aged-bronze/60 rounded-lg p-6 max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-aged-bronze/20 pb-3">
              <div>
                <h3 className="text-base text-champagne-gold font-medium">
                  Finalizar Orden de Producción
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  {completingOp.productName} ({completingOp.productSku ? `SKU: ${completingOp.productSku}` : 'Sin SKU'})
                </p>
              </div>
              <button
                onClick={() => setCompletingOp(null)}
                className="text-text-secondary hover:text-text-primary text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="bg-charcoal-surface/60 p-3 rounded border border-aged-bronze/20 text-xs flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Bodega Origen (Insumos):</span>
                  <span className="text-text-primary font-medium">{completingOp.warehouseName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Cant. Planificada:</span>
                  <span className="text-champagne-gold font-mono font-medium">
                    {parseFloat(completingOp.quantityProduced).toFixed(3)}
                  </span>
                </div>
              </div>

              <FormField label="Cantidad Real Producida / Obtenida" required>
                <Input
                  type="number"
                  min="0.001"
                  step="any"
                  value={completeActualQty}
                  onChange={(e) => setCompleteActualQty(parseFloat(e.target.value) || 0)}
                  required
                />
              </FormField>

              <FormField label="Bodega Destino (Entrega de Producto Terminado)" required>
                <select
                  value={completeDestWarehouseId}
                  onChange={(e) => setCompleteDestWarehouseId(e.target.value)}
                  className="w-full bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold text-xs text-text-primary p-2.5 rounded focus:outline-none"
                  required
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Notas / Observaciones Finales">
                <textarea
                  placeholder="Observaciones de lote, mermas o rendimiento..."
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold text-text-primary rounded-md p-2.5 font-sans text-xs focus:outline-none resize-none"
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-3 border-t border-aged-bronze/20 pt-4 mt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setCompletingOp(null)}
                disabled={isCompletingOp}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleConfirmCompleteOp}
                disabled={isCompletingOp || completeActualQty <= 0}
              >
                {isCompletingOp ? 'Procesando...' : 'Confirmar y Descontar Insumos'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
