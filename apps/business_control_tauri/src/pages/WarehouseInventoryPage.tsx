import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api, Warehouse } from '../services/api';
import { Heading } from '../components/atoms/Heading';
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
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
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
      const [warehousesData, stockData] = await Promise.all([
        api.getWarehouses(businessId),
        api.getStockLevels(businessId),
      ]);
      setWarehouses(warehousesData);
      setStock(stockData);
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
                  <th className="px-6 py-4 text-right">Actualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aged-bronze/20 text-sm">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-text-secondary italic">
                      No hay existencias registradas para el filtro seleccionado.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="hover:bg-charcoal-surface/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-text-primary text-xs">{r.productName}</td>
                      <td className="px-6 py-4 text-text-secondary text-xs font-mono">{r.internalCode || r.sku || '—'}</td>
                      <td className="px-6 py-4 text-text-secondary text-xs">{ITEM_TYPE_LABELS[r.itemType || ''] || r.itemType || '—'}</td>
                      <td className="px-6 py-4 text-text-primary text-xs">{r.warehouseName || r.branchName || '—'}</td>
                      <td className="px-6 py-4 text-xs">{typeBadge(effectiveType(r))}</td>
                      <td className="px-6 py-4 text-right font-mono font-semibold text-champagne-gold text-xs">
                        {parseFloat(r.quantity || '0').toFixed(decimals(r.uom))} <span className="text-text-secondary text-[10px]">{r.uom || ''}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-text-secondary text-xs whitespace-nowrap">
                        {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  ))
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
    </div>
  );
};
