import React, { useState, useEffect, useCallback } from 'react';
import { api, Warehouse, RecipeItem } from '../services/api';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';

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
  }, [loadWarehouses, loadRecipe]);

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
      onToast(`Se generaron ${result.purchaseOrders.length} OC con ${totalItems} insumos.`);
    } catch (e: any) {
      onToast(e?.message || 'Error al generar OC de faltantes.', 'error');
    } finally {
      setGeneratingOc(false);
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
              <div className="text-[10px] text-error-red italic">
                Este producto no tiene receta configurada. Configúrela en Producción (Recetas).
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
