import React, { useState, useEffect, useCallback } from 'react';
import { api, InventoryAlert, InventoryAlertSummary, Branch, Provider } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { ToastContainer } from '../components/molecules/ToastNotification';
import { ProductionOrderModal } from './ProductionOrderModal';

interface InventoryDashboardPageProps {
  businessId: string;
}

type Toast = { id: string; message: string; type: 'success' | 'error' | 'warning' };

export const InventoryDashboardPage: React.FC<InventoryDashboardPageProps> = ({ businessId }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<InventoryAlertSummary['summary'] | null>(null);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [hideResolved, setHideResolved] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [productionProduct, setProductionProduct] = useState<InventoryAlert | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [alertAwaitingProvider, setAlertAwaitingProvider] = useState<InventoryAlert | null>(null);
  const [providerSearch, setProviderSearch] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [newProviderName, setNewProviderName] = useState('');
  const [isAssigningProvider, setIsAssigningProvider] = useState(false);

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchData = useCallback(async (branch?: string) => {
    if (!businessId) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryData, branchesData, providersData] = await Promise.all([
        api.getInventoryAlertSummary(businessId, branch || undefined),
        api.getBranches(businessId),
        api.getProviders(businessId).catch(() => [] as Provider[]),
      ]);
      setSummary(summaryData.summary);
      setAlerts(summaryData.alerts);
      setBranches(branchesData);
      setProviders(providersData);
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar el panel de inventario.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshInventoryAlerts(businessId);
      await fetchData(branchFilter);
      showToast('Alertas de inventario actualizadas.');
    } catch (e: any) {
      showToast(e?.message || 'Error al actualizar alertas.', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleBranchFilter = (branchId: string) => {
    setBranchFilter(branchId);
    fetchData(branchId || undefined);
  };

  const handleGenerateRequisition = async (alert: InventoryAlert) => {
    setActionId(alert.id);
    try {
      const result = await api.generateRequisitionFromAlert(alert.id);
      if (result.skipped) {
        showToast('Ya existe una requisición pendiente para este producto.', 'warning');
      } else {
        showToast('Requisición generada correctamente.');
      }
      await fetchData(branchFilter);
    } catch (e: any) {
      showToast(e?.message || 'Error al generar requisición.', 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleGeneratePurchaseOrder = async (alert: InventoryAlert) => {
    setActionId(alert.id);
    try {
      const result = await api.generatePurchaseOrderFromAlert(alert.id);
      showToast(`Orden de compra ${result.poNumber} generada.`);
      await fetchData(branchFilter);
    } catch (e: any) {
      showToast(e?.message || 'Error al generar orden de compra.', 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleAutoPo = async () => {
    setRefreshing(true);
    try {
      const result = await api.runAutoPurchaseOrders(businessId);
      showToast(`Se generaron ${result.created} órdenes de compra automáticas.`);
      await fetchData(branchFilter);
    } catch (e: any) {
      showToast(e?.message || 'Error al generar órdenes automáticas.', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const openProviderAssignment = (alert: InventoryAlert) => {
    setAlertAwaitingProvider(alert);
    setProviderSearch('');
    setSelectedProviderId('');
    setNewProviderName('');
  };

  const handleProviderAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!alertAwaitingProvider) return;

    const providerName = newProviderName.trim();
    if (!selectedProviderId && !providerName) {
      showToast('Seleccione o registre un proveedor para continuar.', 'warning');
      return;
    }

    setIsAssigningProvider(true);
    try {
      let providerId = selectedProviderId;
      let providerLabel = providers.find((provider) => provider.id === providerId)?.name;

      if (!providerId) {
        const createdProvider = await api.addProvider({ name: providerName }, businessId);
        setProviders((current) => [...current, createdProvider]);
        providerId = createdProvider.id;
        providerLabel = createdProvider.name;
      }

      await api.updateProduct(alertAwaitingProvider.productId, { providerId });
      showToast(`${providerLabel || 'Proveedor'} asignado a "${alertAwaitingProvider.productName}".`);
      setAlertAwaitingProvider(null);
      await fetchData(branchFilter);
    } catch (e: any) {
      showToast(e?.message || 'No se pudo asignar el proveedor.', 'error');
    } finally {
      setIsAssigningProvider(false);
    }
  };

  const handleBulkGenerateOc = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      showToast('Seleccione al menos un producto.', 'warning');
      return;
    }
    setBulkGenerating(true);
    try {
      const result = await api.generatePurchaseOrdersFromAlerts(ids);
      const totalItems = result.purchaseOrders.reduce((sum, po) => sum + po.itemCount, 0);
      showToast(`Se generaron ${result.purchaseOrders.length} OC con ${totalItems} productos.`);
      setSelectedIds(new Set());
      await fetchData(branchFilter);
    } catch (e: any) {
      showToast(e?.message || 'Error al generar órdenes de compra.', 'error');
    } finally {
      setBulkGenerating(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canBuy = (a: InventoryAlert) => a.itemType === 'raw_material' && !!a.hasProvider;

  const selectableAlerts = alerts.filter(
    (a) =>
      !a.branchId &&
      canBuy(a) &&
      (a.status === 'active' || a.status === 'acknowledged'),
  );
  const allSelected = selectableAlerts.length > 0 && selectableAlerts.every((a) => selectedIds.has(a.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableAlerts.map((a) => a.id)));
    }
  };

  const visibleAlerts = alerts.filter((a) => (hideResolved ? a.status !== 'resolved' : true));
  const matchingProviders = providers.filter((provider) =>
    provider.name.toLocaleLowerCase().includes(providerSearch.trim().toLocaleLowerCase())
  );

  const SummaryCard: React.FC<{ label: string; value: number; tone: 'red' | 'amber' | 'green' | 'gold' }> = ({ label, value, tone }) => {
    const tones = {
      red: 'border-error-red/50 text-error-red',
      amber: 'border-aged-bronze text-champagne-gold',
      green: 'border-emerald-500/50 text-emerald-400',
      gold: 'border-champagne-gold/50 text-champagne-gold',
    };
    return (
      <div className={`bg-charcoal-surface border ${tones[tone]} rounded-lg p-4 flex flex-col gap-1`}>
        <span className="text-3xl font-display">{value}</span>
        <span className="text-[10px] uppercase tracking-widest text-text-secondary">{label}</span>
      </div>
    );
  };

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-text-secondary text-sm uppercase tracking-widest">Cargando panel...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Heading level={2} className="!text-lg sm:!text-2xl">Panel de Inventario</Heading>
        <div className="flex items-center gap-2">
          <select
            value={branchFilter}
            onChange={(e) => handleBranchFilter(e.target.value)}
            className="bg-charcoal-surface border border-aged-bronze/35 rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none"
          >
            <option value="">Todas las sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Actualizando...' : 'Actualizar alertas'}
          </Button>
          <Button variant="primary" size="sm" onClick={handleAutoPo} disabled={refreshing}>
            Generar OC automáticas
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-error-red/10 border border-error-red/40 text-error-red rounded p-3 text-sm">{error}</div>
      )}

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Sin stock (global)" value={summary.outOfStock} tone="red" />
          <SummaryCard label="Bajo mínimo (global)" value={summary.lowStock} tone="amber" />
          <SummaryCard label="Requisiciones sugeridas" value={summary.branchAlerts} tone="gold" />
          <SummaryCard label="OC en borrador" value={summary.draftPurchaseOrders} tone="green" />
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <Heading level={5} className="!text-sm">Alertas ({visibleAlerts.length})</Heading>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="accent-champagne-gold"
              data-testid="alert-select-all"
            />
            Seleccionar todos
          </label>
          {selectedIds.size > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleBulkGenerateOc}
              disabled={bulkGenerating}
              data-testid="alert-bulk-generate-oc"
            >
              {bulkGenerating ? 'Generando...' : `Generar OC (${selectedIds.size})`}
            </Button>
          )}
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={hideResolved}
              onChange={(e) => setHideResolved(e.target.checked)}
              className="accent-champagne-gold"
            />
            Ocultar resueltas
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {visibleAlerts.length === 0 && (
          <div className="bg-charcoal-surface/50 border border-aged-bronze/20 rounded p-6 text-center text-sm text-text-secondary">
            No hay alertas activas. El inventario está saludable.
          </div>
        )}

        {visibleAlerts.map((alert) => {
          const isGlobal = !alert.branchId;
          const hasTransferable = (alert.transferableQty ?? 0) > 0;
          const isRawMaterial = alert.itemType === 'raw_material';
          const isRequisition = !isGlobal && hasTransferable;
          const buyable = isRawMaterial && !!alert.hasProvider;
          return (
          <div
            key={alert.id}
            data-testid={`alert-row-${alert.id}`}
            className={`flex flex-col sm:flex-row sm:items-center gap-3 bg-charcoal-surface border rounded-lg p-4 ${
              alert.alertType === 'out_of_stock' ? 'border-error-red/40' : 'border-aged-bronze/30'
            }`}
          >
            {isGlobal && alert.status !== 'resolved' && canBuy(alert) && (
              <input
                type="checkbox"
                checked={selectedIds.has(alert.id)}
                onChange={() => toggleSelect(alert.id)}
                className="accent-champagne-gold w-4 h-4 flex-shrink-0"
                data-testid={`alert-select-${alert.id}`}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-text-primary truncate">{alert.productName}</span>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                  alert.alertType === 'out_of_stock' ? 'bg-error-red/20 text-error-red' : 'bg-aged-bronze/20 text-champagne-gold'
                }`}>
                  {alert.alertType === 'out_of_stock' ? 'Sin stock' : 'Bajo mínimo'}
                </span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-charcoal-surface/60 border border-aged-bronze/20 text-text-secondary">
                  {isRequisition
                    ? 'Requisición sugerida'
                    : isRawMaterial
                      ? 'Compra sugerida'
                      : 'Producción sugerida'}
                </span>
                {alert.status === 'resolved' && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Resuelta</span>
                )}
              </div>
              <div className="text-xs text-text-secondary mt-1">
                {isGlobal
                  ? 'Todo el negocio (stock global)'
                  : hasTransferable
                    ? `${alert.branchName} (${alert.transferableQty} disponible para traspasar)`
                    : `${alert.branchName} (sin stock para traspasar)`}{' '}
                · Stock actual: <span className="text-text-primary">{alert.currentQty}</span> · Mínimo: <span className="text-text-primary">{alert.threshold}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {alert.status !== 'resolved' && (
                isRequisition ? (
                  <Button variant="secondary" size="sm" data-testid={`alert-generate-req-${alert.id}`} disabled={actionId === alert.id} onClick={() => handleGenerateRequisition(alert)}>
                    Generar Requisición
                  </Button>
                ) : buyable ? (
                  <Button variant="primary" size="sm" data-testid={`alert-generate-oc-${alert.id}`} disabled={actionId === alert.id} onClick={() => handleGeneratePurchaseOrder(alert)}>
                    Generar OC
                  </Button>
                ) : isRawMaterial ? (
                  <button
                    type="button"
                    onClick={() => openProviderAssignment(alert)}
                    className="inline-flex items-center gap-1.5 rounded border border-warning-yellow/35 px-2.5 py-1.5 text-[10px] font-semibold text-warning-yellow transition-colors hover:border-warning-yellow hover:bg-warning-yellow/10"
                    data-testid={`alert-assign-provider-${alert.id}`}
                  >
                    <span className="text-sm leading-none">+</span> Asignar proveedor
                  </button>
                ) : (
                  <Button variant="secondary" size="sm" data-testid={`alert-produce-${alert.id}`} onClick={() => setProductionProduct(alert)}>
                    Producir
                  </Button>
                )
              )}
            </div>
          </div>
          );
        })}
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />

      {alertAwaitingProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/85 p-4 backdrop-blur-sm animate-fade-in font-sans">
          <form
            onSubmit={handleProviderAssignment}
            className="w-full max-w-lg overflow-hidden rounded-xl border border-aged-bronze/35 bg-onyx-surface shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-aged-bronze/25 p-5">
              <div>
                <Heading level={2} className="!border-none !pb-0 !text-lg font-light text-champagne-gold">
                  Asignar proveedor
                </Heading>
                <p className="mt-1 text-xs text-text-secondary">
                  Insumo: <span className="font-semibold text-text-primary">{alertAwaitingProvider.productName}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAlertAwaitingProvider(null)}
                disabled={isAssigningProvider}
                className="rounded p-1 text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
                aria-label="Cerrar"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-4 p-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Buscar proveedor registrado</label>
                <Input
                  type="search"
                  value={providerSearch}
                  onChange={(event) => setProviderSearch(event.target.value)}
                  placeholder="Escriba el nombre del proveedor..."
                  disabled={isAssigningProvider}
                  data-testid="alert-provider-search"
                />
              </div>

              <div className="max-h-40 overflow-y-auto rounded border border-aged-bronze/30 bg-charcoal-surface/40">
                {matchingProviders.length > 0 ? matchingProviders.map((provider) => (
                  <label
                    key={provider.id}
                    className="flex cursor-pointer items-center gap-3 border-b border-aged-bronze/15 px-3 py-2.5 text-sm last:border-b-0 hover:bg-charcoal-surface"
                  >
                    <input
                      type="radio"
                      name="alert-provider"
                      value={provider.id}
                      checked={selectedProviderId === provider.id}
                      onChange={() => {
                        setSelectedProviderId(provider.id);
                        setNewProviderName('');
                      }}
                      disabled={isAssigningProvider}
                      className="accent-champagne-gold"
                    />
                    <span className="text-text-primary">{provider.name}</span>
                    {provider.contactName && <span className="text-xs text-text-secondary">{provider.contactName}</span>}
                  </label>
                )) : (
                  <p className="px-3 py-3 text-xs italic text-text-secondary">No se encontraron proveedores registrados.</p>
                )}
              </div>

              <div className="border-t border-aged-bronze/20 pt-4">
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">O registrar un proveedor nuevo</label>
                <Input
                  type="text"
                  value={newProviderName}
                  onChange={(event) => {
                    setNewProviderName(event.target.value);
                    if (event.target.value.trim()) setSelectedProviderId('');
                  }}
                  placeholder="Nombre del nuevo proveedor"
                  disabled={isAssigningProvider}
                  data-testid="alert-new-provider-name"
                />
                <p className="mt-1.5 text-[11px] text-text-secondary">Se registrará y se asignará como proveedor principal de este insumo.</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-aged-bronze/25 p-5">
              <Button type="button" variant="secondary" onClick={() => setAlertAwaitingProvider(null)} disabled={isAssigningProvider}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isAssigningProvider} data-testid="alert-save-provider-assignment">
                {isAssigningProvider ? 'Guardando...' : newProviderName.trim() ? 'Registrar y asignar' : 'Asignar proveedor'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {productionProduct && (
        <ProductionOrderModal
          businessId={businessId}
          productId={productionProduct.productId}
          productName={productionProduct.productName}
          onClose={() => setProductionProduct(null)}
          onToast={showToast}
        />
      )}
    </div>
  );
};
