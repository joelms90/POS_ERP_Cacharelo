import React, { useState, useEffect, useCallback } from 'react';
import { api, Branch, Product, BranchCatalogEntry } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { Badge } from '../components/atoms/Badge';
import { ToastContainer } from '../components/molecules/ToastNotification';

const ITEM_TYPE_LABELS: Record<string, string> = {
  raw_material: 'Materia Prima',
  wip: 'En Proceso',
  finished_good: 'Terminado',
  service: 'Servicio',
};

interface BranchCatalogPageProps {
  businessId: string;
}

export const BranchCatalogPage: React.FC<BranchCatalogPageProps> = ({ businessId }) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [overrides, setOverrides] = useState<Map<string, BranchCatalogEntry>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'warning' }>>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadBranches = useCallback(async () => {
    const branchesData = await api.getBranches(businessId);
    setBranches(branchesData);
    if (branchesData.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branchesData[0].id);
    }
  }, [businessId, selectedBranchId]);

  const loadData = useCallback(async (branchId: string) => {
    setLoading(true);
    try {
      const [productsData, overridesData] = await Promise.all([
        api.getProducts(businessId, branchId),
        api.getBranchCatalog(branchId),
      ]);
      setProducts(productsData);
      setOverrides(new Map(overridesData.map((o) => [o.productId, o])));
    } catch (e: any) {
      showToast(e?.message || 'Error al cargar el catálogo.', 'error');
    } finally {
      setLoading(false);
    }
  }, [businessId, showToast]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    if (selectedBranchId) {
      loadData(selectedBranchId);
    }
  }, [selectedBranchId, loadData]);

  const handleToggle = async (product: Product, sellable: boolean) => {
    setSavingId(product.id);
    try {
      await api.upsertBranchCatalog({
        businessId,
        branchId: selectedBranchId,
        productId: product.id,
        isSellable: sellable,
      });
      await loadData(selectedBranchId);
    } catch (e: any) {
      showToast(e?.message || 'Error al actualizar el catálogo.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleReset = async (overrideId: string) => {
    setSavingId(overrideId);
    try {
      await api.deleteBranchCatalog(overrideId);
      showToast('Producto restablecido al valor global.', 'success');
      await loadData(selectedBranchId);
    } catch (e: any) {
      showToast(e?.message || 'Error al restablecer.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const filtered = products.filter(
    (p) =>
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Heading level={2} className="!text-lg sm:!text-2xl">Catálogo por Sucursal</Heading>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="bg-charcoal-surface border border-aged-bronze/35 rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none"
          data-testid="catalog-branch-select"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <div className="w-full md:w-72">
        <Input
          type="text"
          placeholder="Buscar producto..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="catalog-search"
        />
      </div>

      {loading ? (
        <div className="py-16 text-center text-text-secondary text-sm uppercase tracking-widest">Cargando catálogo...</div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((p) => {
            const override = overrides.get(p.id);
            const hasOverride = !!override;
            const sellable = p.isSellable !== false;
            return (
              <div
                key={p.id}
                data-testid={`catalog-row-${p.id}`}
                className="flex flex-col sm:flex-row sm:items-center gap-3 bg-charcoal-surface border border-aged-bronze/25 rounded-lg p-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-text-primary truncate">{p.name}</span>
                    <Badge variant="charcoal">{ITEM_TYPE_LABELS[p.itemType || 'finished_good'] || 'Producto'}</Badge>
                    {hasOverride && (
                      <Badge variant="warning">Personalizado</Badge>
                    )}
                  </div>
                  <div className="text-xs text-text-secondary mt-1">
                    Global: {p.isSellable === false ? 'No vendible' : 'Vendible'} · SKU: {p.sku || '-'}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sellable}
                      disabled={savingId === p.id}
                      onChange={(e) => handleToggle(p, e.target.checked)}
                      data-testid={`catalog-toggle-${p.id}`}
                      className="accent-champagne-gold w-4 h-4"
                    />
                    Vender aquí
                  </label>
                  {hasOverride && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={savingId === override.id}
                      onClick={() => handleReset(override.id)}
                      data-testid={`catalog-reset-${p.id}`}
                    >
                      Restablecer
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="bg-charcoal-surface/50 border border-aged-bronze/20 rounded p-6 text-center text-sm text-text-secondary">
              No hay productos que coincidan.
            </div>
          )}
        </div>
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};
