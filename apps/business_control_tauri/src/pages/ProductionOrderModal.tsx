import React, { useState, useEffect, useCallback } from 'react';
import { api, Warehouse, RecipeItem, Product } from '../services/api';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Autocomplete } from '../components/molecules/Autocomplete';

interface ProductionOrderModalProps {
  businessId: string;
  productId: string;
  productName: string;
  onClose: () => void;
  onToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

export const ProductionOrderModal: React.FC<ProductionOrderModalProps> = ({
  businessId,
  productId,
  productName,
  onClose,
  onToast,
}) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [qtyToProduce, setQtyToProduce] = useState(1);
  const [recipe, setRecipe] = useState<RecipeItem[]>([]);
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [producing, setProducing] = useState(false);
  const [generatingOc, setGeneratingOc] = useState(false);

  // Recipe builder (when no recipe exists)
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [draftItems, setDraftItems] = useState<Array<{ ingredientProductId: string; ingredientName: string; quantityNeeded: number; wastePercent: number }>>([]);
  const [newIngredientId, setNewIngredientId] = useState('');
  const [newIngredientQty, setNewIngredientQty] = useState('1');
  const [newIngredientWaste, setNewIngredientWaste] = useState('0');
  const [savingRecipe, setSavingRecipe] = useState(false);

  const loadWarehouses = useCallback(async () => {
    try {
      const whs = await api.getWarehouses(businessId);
      setWarehouses(whs);
      if (whs.length > 0 && !warehouseId) {
        setWarehouseId(whs[0].id);
      }
    } catch {
      onToast('Error al cargar bodegas.', 'error');
    }
  }, [businessId, warehouseId, onToast]);

  const loadRecipe = useCallback(async () => {
    try {
      const items = await api.getRecipe(productId);
      setRecipe(items);
    } catch {
      setRecipe([]);
    }
  }, [productId]);

  const loadProducts = useCallback(async () => {
    try {
      const prods = await api.getProducts(businessId);
      setAllProducts(prods);
    } catch {
      setAllProducts([]);
    }
  }, [businessId]);

  const loadStock = useCallback(async () => {
    if (!warehouseId) return;
    try {
      const stock = await api.getStockLevels(businessId, warehouseId, undefined);
      const map = new Map<string, number>();
      for (const s of stock) {
        if (s.productId) map.set(s.productId, parseFloat(s.quantity || '0'));
      }
      setStockMap(map);
    } catch {
      onToast('Error al cargar stock.', 'error');
    }
  }, [businessId, warehouseId, onToast]);

  useEffect(() => {
    loadWarehouses();
    loadRecipe();
    loadProducts();
  }, [loadWarehouses, loadRecipe, loadProducts]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  useEffect(() => {
    setLoading(false);
  }, [recipe, stockMap, warehouses]);

  const recipeChecks = recipe.map((item) => {
    const requiredQty = parseFloat(String(item.quantityNeeded)) * qtyToProduce;
    const available = stockMap.get(item.ingredientProductId) ?? 0;
    return {
      ...item,
      requiredQty,
      availableQty: available,
      hasEnough: available >= requiredQty,
    };
  });

  const missing = recipeChecks.filter((c) => !c.hasEnough);
  const canProduce = recipeChecks.length > 0 && recipeChecks.every((c) => c.hasEnough);

  const handleProduce = async () => {
    setProducing(true);
    try {
      await api.assembleProduct({
        warehouseId,
        productId,
        quantityProduced: qtyToProduce,
        notes: undefined,
      });
      onToast(`Ensamble de ${productName} procesado.`);
      onClose();
    } catch (e: any) {
      onToast(e?.message || 'Error al procesar el ensamble.', 'error');
    } finally {
      setProducing(false);
    }
  };

  const handleGenerateOc = async () => {
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
      const skippedCount = result.skipped?.length || 0;
      let msg = `Se generaron ${result.purchaseOrders.length} OC con ${totalItems} insumos.`;
      if (skippedCount > 0) {
        msg += ` ${skippedCount} insumo(s) sin proveedor registrado.`;
      }
      onToast(msg, skippedCount > 0 ? 'warning' : 'success');
    } catch (e: any) {
      onToast(e?.message || 'Error al generar OC de faltantes.', 'error');
    } finally {
      setGeneratingOc(false);
    }
  };

  const ingredientCandidates = allProducts.filter(
    (p) => p.id !== productId && (p.itemType === 'raw_material' || p.itemType === 'wip' || p.isIngredient === true),
  );

  const handleAddIngredient = () => {
    if (!newIngredientId) return;
    const qty = parseFloat(newIngredientQty);
    if (isNaN(qty) || qty <= 0) return;
    const waste = parseFloat(newIngredientWaste || '0') || 0;
    const prod = allProducts.find((p) => p.id === newIngredientId);
    if (!prod) return;
    if (draftItems.some((d) => d.ingredientProductId === newIngredientId)) return;

    setDraftItems((prev) => [
      ...prev,
      { ingredientProductId: newIngredientId, ingredientName: prod.name, quantityNeeded: qty, wastePercent: waste },
    ]);
    setNewIngredientId('');
    setNewIngredientQty('1');
    setNewIngredientWaste('0');
  };

  const handleRemoveIngredient = (ingredientId: string) => {
    setDraftItems((prev) => prev.filter((d) => d.ingredientProductId !== ingredientId));
  };

  const handleSaveRecipe = async () => {
    if (draftItems.length === 0) {
      onToast('Añada al menos un insumo a la receta.', 'warning');
      return;
    }
    setSavingRecipe(true);
    try {
      await api.setRecipe({
        parentProductId: productId,
        items: draftItems.map((d) => ({
          ingredientProductId: d.ingredientProductId,
          quantityNeeded: d.quantityNeeded,
          wastePercent: d.wastePercent,
        })),
      });
      setDraftItems([]);
      await loadRecipe();
      onToast('Receta guardada correctamente.');
    } catch (e: any) {
      onToast(e?.message || 'Error al guardar la receta.', 'error');
    } finally {
      setSavingRecipe(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-onyx-surface border border-aged-bronze/40 rounded-lg shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-aged-bronze/20">
          <div>
            <h3 className="text-base font-display text-champagne-gold tracking-wide">Producir / Ensamble</h3>
            <p className="text-xs text-text-secondary mt-0.5">{productName}</p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-secondary">Bodega de Producción</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-surface border border-aged-bronze rounded text-xs text-text-primary focus:outline-none"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-secondary">Cantidad a Producir</label>
            <input
              type="number"
              min="1"
              step="1"
              value={qtyToProduce}
              onChange={(e) => setQtyToProduce(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 bg-charcoal-surface border border-aged-bronze rounded text-xs text-text-primary focus:outline-none"
            />
          </div>

          <div>
            <span className="text-[10px] text-text-secondary uppercase tracking-widest font-semibold block mb-2">
              Insumos de la Receta
            </span>
            {loading ? (
              <div className="py-6 text-center text-text-secondary text-xs">Cargando...</div>
            ) : recipeChecks.length === 0 ? (
              <div className="flex flex-col gap-3">
                <div className="text-[10px] text-error-red italic">
                  Este producto no tiene receta configurada. Añada los insumos:
                </div>

                <div className="flex flex-col gap-2 bg-charcoal-surface/30 border border-aged-bronze/20 rounded p-3">
                  <Autocomplete
                    options={ingredientCandidates.map((ing) => ({
                      id: ing.id,
                      label: ing.name,
                      sublabel: ing.sku ? `SKU: ${ing.sku}` : undefined,
                    }))}
                    value={newIngredientId}
                    onChange={setNewIngredientId}
                    placeholder="Buscar insumo..."
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] text-text-secondary uppercase mb-1">Cantidad</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={newIngredientQty}
                        onChange={(e) => setNewIngredientQty(e.target.value)}
                        className="w-full px-2 py-1.5 bg-charcoal-surface border border-aged-bronze rounded text-xs text-text-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-text-secondary uppercase mb-1">Merma %</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={newIngredientWaste}
                        onChange={(e) => setNewIngredientWaste(e.target.value)}
                        className="w-full px-2 py-1.5 bg-charcoal-surface border border-aged-bronze rounded text-xs text-text-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  <Button type="button" variant="secondary" size="sm" onClick={handleAddIngredient}>
                    + Añadir insumo
                  </Button>
                </div>

                {draftItems.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {draftItems.map((d) => (
                      <div key={d.ingredientProductId} className="flex justify-between items-center text-[11px] border-b border-aged-bronze/10 pb-1">
                        <span className="text-text-primary">{d.ingredientName}</span>
                        <span className="text-text-secondary">
                          {d.quantityNeeded}{d.wastePercent > 0 ? ` · merma ${d.wastePercent}%` : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(d.ingredientProductId)}
                          className="text-error-red hover:text-error-red/80 p-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  variant="primary"
                  size="sm"
                  disabled={savingRecipe || draftItems.length === 0}
                  onClick={handleSaveRecipe}
                >
                  {savingRecipe ? 'Guardando...' : 'Guardar Receta'}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recipeChecks.map((check, index) => (
                  <div key={index} className="flex justify-between items-center text-[11px] border-b border-aged-bronze/10 pb-1.5 last:border-b-0">
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
        </div>

        <div className="p-4 border-t border-aged-bronze/20 flex flex-col gap-2">
          <Button
            variant="primary"
            fullWidth
            disabled={producing || !canProduce}
            onClick={handleProduce}
          >
            {producing ? 'Procesando...' : 'Procesar Ensamble'}
          </Button>
          {missing.length > 0 && (
            <Button
              variant="secondary"
              fullWidth
              disabled={generatingOc}
              onClick={handleGenerateOc}
            >
              {generatingOc ? 'Generando...' : `Generar OC de faltantes (${missing.length})`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
