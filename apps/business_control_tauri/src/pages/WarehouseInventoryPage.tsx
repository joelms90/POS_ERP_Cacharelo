import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api, Warehouse, WarehouseStockThreshold, ThresholdSuggestion } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { ToastContainer } from '../components/molecules/ToastNotification';

interface WarehouseInventoryPageProps {
  businessId: string;
}

interface StockLevel {
  id: string;
  productId: string;
  productName: string;
  sku?: string | null;
  internalCode?: string | null;
  itemType?: string;
  uom?: string;
  warehouseId: string | null;
  warehouseName: string | null;
  warehouseLocationType?: string | null;
  branchId: string | null;
  branchName: string | null;
  quantity: string;
  updatedAt?: string;
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  raw_material: 'Materia Prima',
  wip: 'En Proceso',
  finished_good: 'Terminado',
  service: 'Servicio',
};

const BULK_UOMS = ['kg', 'g', 'l', 'ml'];
const decimals = (uom?: string) => (uom && BULK_UOMS.includes(uom) ? 3 : 0);
const UOM_LABELS: Record<string, string> = {
  piece: 'pza',
  pack: 'paq',
  kg: 'kg',
  g: 'g',
  l: 'l',
  ml: 'ml',
};

type LocationType = 'warehouse' | 'factory' | 'branch' | 'transit';
type TypeFilter = 'all' | 'warehouse' | 'factory' | 'branch';

const effectiveType = (s: StockLevel): LocationType => {
  if (s.warehouseLocationType === 'transit') return 'transit';
  if (s.warehouseLocationType === 'factory') return 'factory';
  if (s.warehouseId == null) return 'branch';
  return 'warehouse';
};

export const WarehouseInventoryPage: React.FC<WarehouseInventoryPageProps> = ({ businessId }) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stock, setStock] = useState<StockLevel[]>([]);
  const [thresholds, setThresholds] = useState<WarehouseStockThreshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [draftThresholds, setDraftThresholds] = useState<Record<string, { min: string; max: string }>>({});
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestions, setSuggestions] = useState<ThresholdSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [applyingSuggest, setApplyingSuggest] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'warning' }>>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [warehousesData, stockData, thresholdsData] = await Promise.all([
        api.getWarehouses(businessId),
        api.getStockLevels(businessId),
        api.getWarehouseThresholds(businessId),
      ]);
      setWarehouses(warehousesData);
      setStock(stockData);
      setThresholds(thresholdsData);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar el inventario por bodega.', 'error');
    } finally {
      setLoading(false);
    }
  }, [businessId, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredWarehouses = useMemo(() => {
    if (typeFilter === 'all' || typeFilter === 'branch') return warehouses;
    return warehouses.filter((w) => (w.locationType || 'warehouse') === typeFilter);
  }, [warehouses, typeFilter]);

  useEffect(() => {
    if (selectedWarehouseId && !filteredWarehouses.some((w) => w.id === selectedWarehouseId)) {
      setSelectedWarehouseId('');
    }
  }, [filteredWarehouses, selectedWarehouseId]);

  const rows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return stock.filter((s) => {
      const type = effectiveType(s);
      if (type === 'transit') return false;
      if (selectedWarehouseId && s.warehouseId !== selectedWarehouseId) return false;
      if (typeFilter !== 'all' && type !== typeFilter) return false;
      if (!q) return true;
      return (
        (s.productName || '').toLowerCase().includes(q) ||
        (s.sku || '').toLowerCase().includes(q) ||
        (s.internalCode || '').toLowerCase().includes(q) ||
        (s.warehouseName || '').toLowerCase().includes(q) ||
        (s.branchName || '').toLowerCase().includes(q)
      );
    });
  }, [stock, selectedWarehouseId, typeFilter, searchQuery]);

  const totals = useMemo(() => {
    const totalUnits = rows.reduce((sum, r) => sum + parseFloat(r.quantity || '0'), 0);
    const distinctProducts = new Set(rows.map((r) => r.productId)).size;
    return { totalUnits, distinctProducts };
  }, [rows]);

  const locationCounts = useMemo(() => {
    const warehousesCount = warehouses.filter((w) => (w.locationType || 'warehouse') === 'warehouse').length;
    const factoriesCount = warehouses.filter((w) => w.locationType === 'factory').length;
    const branchesCount = new Set(
      stock.filter((s) => s.warehouseId == null && s.branchId != null).map((s) => s.branchId),
    ).size;
    return { warehousesCount, factoriesCount, branchesCount };
  }, [warehouses, stock]);

  const thresholdFor = useCallback((productId: string, warehouseId: string) => {
    return thresholds.find((t) => t.productId === productId && t.warehouseId === warehouseId);
  }, [thresholds]);

  const draftKey = (productId: string, warehouseId: string) => `${productId}|${warehouseId}`;

  const draftValue = (productId: string, warehouseId: string, field: 'min' | 'max'): string => {
    const key = draftKey(productId, warehouseId);
    if (draftThresholds[key]) return draftThresholds[key][field];
    const t = thresholdFor(productId, warehouseId);
    if (!t) return '';
    const val = field === 'min' ? parseFloat(t.minStock) : parseFloat(t.maxStock);
    return val > 0 ? String(val) : '';
  };

  const handleDraftChange = (productId: string, warehouseId: string, field: 'min' | 'max', value: string) => {
    const key = draftKey(productId, warehouseId);
    setDraftThresholds((prev) => ({
      ...prev,
      [key]: { min: prev[key]?.min ?? draftValue(productId, warehouseId, 'min'), max: prev[key]?.max ?? draftValue(productId, warehouseId, 'max'), [field]: value },
    }));
  };

  const saveThreshold = async (productId: string, warehouseId: string) => {
    const key = draftKey(productId, warehouseId);
    const draft = draftThresholds[key];
    if (!draft) return;
    const minStock = draft.min === '' ? 0 : parseFloat(draft.min);
    const maxStock = draft.max === '' ? 0 : parseFloat(draft.max);
    if (isNaN(minStock) || isNaN(maxStock)) return;
    try {
      await api.upsertWarehouseThreshold({ businessId, productId, warehouseId, minStock, maxStock });
      setDraftThresholds((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      const [updated] = await Promise.all([api.getWarehouseThresholds(businessId)]);
      setThresholds(updated);
      showToast('Mínimo/máximo guardado.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al guardar el umbral.', 'error');
    }
  };

  const openSuggest = async () => {
    setSuggestLoading(true);
    setShowSuggest(true);
    try {
      const data = await api.getThresholdSuggestions(businessId, 4);
      setSuggestions(data);
    } catch (err: any) {
      showToast(err.message || 'Error al calcular sugerencias.', 'error');
    } finally {
      setSuggestLoading(false);
    }
  };

  const applySuggestions = async () => {
    setApplyingSuggest(true);
    try {
      const suggestionByProduct = new Map(suggestions.map((s) => [s.productId, s]));
      let applied = 0;
      for (const s of suggestions) {
        const warehouseIds = new Set(
          stock
            .filter((r) => r.productId === s.productId && r.warehouseId != null)
            .map((r) => r.warehouseId as string),
        );
        const targets = selectedWarehouseId
          ? (warehouseIds.has(selectedWarehouseId) ? [selectedWarehouseId] : [])
          : Array.from(warehouseIds);
        for (const wh of targets) {
          const sug = suggestionByProduct.get(s.productId)!;
          await api.upsertWarehouseThreshold({
            businessId,
            productId: s.productId,
            warehouseId: wh,
            minStock: sug.suggestedMin,
            maxStock: sug.suggestedMax,
          });
          applied++;
        }
      }
      const [updated] = await Promise.all([api.getWarehouseThresholds(businessId)]);
      setThresholds(updated);
      setShowSuggest(false);
      showToast(`Se aplicaron ${applied} umbrales sugeridos.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al aplicar sugerencias.', 'error');
    } finally {
      setApplyingSuggest(false);
    }
  };

  const typeBadge = (type: LocationType) => {
    if (type === 'factory') {
      return <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-champagne-gold/15 text-champagne-gold">Fábrica</span>;
    }
    if (type === 'branch') {
      return <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-emerald-500/15 text-emerald-400">Sucursal</span>;
    }
    if (type === 'transit') {
      return <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-warning-yellow/15 text-warning-yellow">Tránsito</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-charcoal/60 text-text-secondary">Bodega</span>;
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-12">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-aged-bronze/25 pb-4">
        <div>
          <Heading level={1} className="!border-none !pb-0 tracking-wide font-light">
            Inventario en Bodegas y Sucursales
          </Heading>
          <p className="text-sm text-text-secondary mt-1">
            Consulta el stock de cada bodega, fábrica de ensamble y sucursal.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={openSuggest} disabled={suggestLoading}>
          Sugerir min/max (ventas semanales)
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-charcoal-surface border border-aged-bronze/20 rounded-lg p-4 flex flex-col gap-1">
          <span className="text-2xl font-display text-champagne-gold">{rows.length}</span>
          <span className="text-[10px] uppercase tracking-widest text-text-secondary">Líneas de stock</span>
        </div>
        <div className="bg-charcoal-surface border border-aged-bronze/20 rounded-lg p-4 flex flex-col gap-1">
          <span className="text-2xl font-display text-champagne-gold">{totals.distinctProducts}</span>
          <span className="text-[10px] uppercase tracking-widest text-text-secondary">Productos distintos</span>
        </div>
        <div className="bg-charcoal-surface border border-aged-bronze/20 rounded-lg p-4 flex flex-col gap-1">
          <span className="text-2xl font-display text-champagne-gold">{totals.totalUnits.toFixed(2)}</span>
          <span className="text-[10px] uppercase tracking-widest text-text-secondary">Unidades totales</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between bg-onyx-surface border border-aged-bronze/40 rounded p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary whitespace-nowrap">Tipo:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="px-3 py-1.5 bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold rounded font-sans text-xs text-text-primary transition-all duration-300 focus:outline-none cursor-pointer"
            >
              <option value="all">Todas las ubicaciones</option>
              <option value="warehouse">Solo Bodegas</option>
              <option value="factory">Solo Fábricas</option>
              <option value="branch">Solo Sucursales</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary whitespace-nowrap">Bodega:</span>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="px-3 py-1.5 bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold rounded font-sans text-xs text-text-primary transition-all duration-300 focus:outline-none cursor-pointer"
            >
              <option value="">Todas</option>
              {filteredWarehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="w-full md:w-72 relative">
          <Input
            type="text"
            placeholder="Buscar producto o código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          <svg className="w-4 h-4 text-text-secondary absolute left-3.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-onyx-surface border border-aged-bronze/40 rounded shadow-md shadow-black/20 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin h-6 w-6 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse select-text">
              <thead>
                <tr className="bg-charcoal-surface/60 border-b border-aged-bronze/35 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  <th className="px-6 py-4">Producto</th>
                  <th className="px-6 py-4">Código</th>
                  <th className="px-6 py-4">Tipo Producto</th>
                  <th className="px-6 py-4">Ubicación</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4 text-right">Stock</th>
                  <th className="px-6 py-4 text-right">Min</th>
                  <th className="px-6 py-4 text-right">Max</th>
                  <th className="px-6 py-4 text-right">Actualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aged-bronze/20 text-sm">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-text-secondary italic">
                      No hay existencias registradas para el filtro seleccionado.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const whId = r.warehouseId;
                    return (
                    <tr key={r.id} className="hover:bg-charcoal-surface/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-text-primary text-xs">{r.productName}</td>
                      <td className="px-6 py-4 text-text-secondary text-xs font-mono">{r.internalCode || r.sku || '—'}</td>
                      <td className="px-6 py-4 text-text-secondary text-xs">{ITEM_TYPE_LABELS[r.itemType || ''] || r.itemType || '—'}</td>
                      <td className="px-6 py-4 text-text-primary text-xs">{r.warehouseName || r.branchName || '—'}</td>
                      <td className="px-6 py-4 text-xs">{typeBadge(effectiveType(r))}</td>
                      <td className="px-6 py-4 text-right font-mono font-semibold text-champagne-gold text-xs">
                        {parseFloat(r.quantity || '0').toFixed(decimals(r.uom))} <span className="text-text-secondary text-[10px]">{UOM_LABELS[r.uom || ''] || r.uom || ''}</span>
                      </td>
                      {whId ? (
                        <>
                          <td className="px-3 py-4 text-right">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={draftValue(r.productId, whId, 'min')}
                              onChange={(e) => handleDraftChange(r.productId, whId, 'min', e.target.value)}
                              onBlur={() => saveThreshold(r.productId, whId)}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveThreshold(r.productId, whId); }}
                              className="w-20 bg-charcoal border border-aged-bronze/40 rounded px-2 py-1 text-right text-xs text-text-primary focus:outline-none focus:border-champagne-gold"
                            />
                          </td>
                          <td className="px-3 py-4 text-right">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={draftValue(r.productId, whId, 'max')}
                              onChange={(e) => handleDraftChange(r.productId, whId, 'max', e.target.value)}
                              onBlur={() => saveThreshold(r.productId, whId)}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveThreshold(r.productId, whId); }}
                              className="w-20 bg-charcoal border border-aged-bronze/40 rounded px-2 py-1 text-right text-xs text-text-primary focus:outline-none focus:border-champagne-gold"
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-4 text-right text-text-secondary/40 text-xs">—</td>
                          <td className="px-3 py-4 text-right text-text-secondary/40 text-xs">—</td>
                        </>
                      )}
                      <td className="px-6 py-4 text-right text-text-secondary text-xs whitespace-nowrap">
                        {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="bg-charcoal-surface/40 border-t border-aged-bronze/35 px-6 py-3 flex items-center justify-between text-xs text-text-secondary">
          <span>Mostrando {rows.length} líneas de stock</span>
          <span className="font-mono">Bodegas: {locationCounts.warehousesCount} · Fábricas: {locationCounts.factoriesCount} · Sucursales: {locationCounts.branchesCount}</span>
        </div>
      </div>

      {/* Suggestions Modal */}
      {showSuggest && (
        <div className="fixed inset-0 bg-obsidian/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-onyx-surface border border-aged-bronze/35 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-aged-bronze/25 flex items-center justify-between">
              <div>
                <Heading level={2} className="!text-champagne-gold !border-none !pb-0 font-light font-sans text-lg">
                  Sugerir mínimos y máximos
                </Heading>
                <p className="text-xs text-text-secondary mt-1">
                  Basado en el promedio de ventas semanales (últimas 4 semanas). Mínimo = 1 semana, Máximo = 2 semanas.
                </p>
              </div>
              <button onClick={() => setShowSuggest(false)} className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              {suggestLoading ? (
                <div className="py-12 text-center text-text-secondary text-xs">Calculando sugerencias...</div>
              ) : suggestions.length === 0 ? (
                <div className="py-12 text-center text-text-secondary/50 text-xs">
                  No hay ventas registradas en las últimas 4 semanas para sugerir umbrales.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-charcoal-surface/60 border-b border-aged-bronze/35 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3 text-right">Prom. semanal</th>
                      <th className="px-4 py-3 text-right">Min sugerido</th>
                      <th className="px-4 py-3 text-right">Max sugerido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aged-bronze/20">
                    {suggestions.map((s) => (
                      <tr key={s.productId} className="hover:bg-charcoal-surface/20">
                        <td className="px-4 py-3 font-medium text-text-primary">{s.productName}</td>
                        <td className="px-4 py-3 text-right font-mono text-text-secondary">{s.weeklyAverage}</td>
                        <td className="px-4 py-3 text-right font-mono text-champagne-gold">{s.suggestedMin}</td>
                        <td className="px-4 py-3 text-right font-mono text-champagne-gold">{s.suggestedMax}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-6 border-t border-aged-bronze/25 flex flex-col gap-2">
              <p className="text-[11px] text-text-secondary">
                {selectedWarehouseId
                  ? `Se aplicará a la bodega seleccionada (${warehouses.find((w) => w.id === selectedWarehouseId)?.name || '—'}).`
                  : 'Se aplicará a todas las bodegas que manejen cada producto.'}
              </p>
              <div className="flex gap-3">
                <Button onClick={applySuggestions} disabled={applyingSuggest || suggestions.length === 0} className="flex-1">
                  {applyingSuggest ? 'Aplicando...' : 'Aplicar sugerencias'}
                </Button>
                <Button variant="secondary" onClick={() => setShowSuggest(false)} className="flex-1">Cerrar</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
