import React, { useState, useEffect, useCallback } from 'react';
import { api, InventoryAlert, InventoryAlertSummary, Branch } from '../services/api';
import { Heading } from '../components/atoms/Heading';
import { Button } from '../components/atoms/Button';
import { ToastContainer } from '../components/molecules/ToastNotification';

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

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchData = useCallback(async (branch?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, branchesData] = await Promise.all([
        api.getInventoryAlertSummary(businessId, branch || undefined),
        api.getBranches(businessId),
      ]);
      setSummary(summaryData.summary);
      setAlerts(summaryData.alerts);
      setBranches(branchesData);
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

  const visibleAlerts = alerts.filter((a) => (hideResolved ? a.status !== 'resolved' : true));

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
          <SummaryCard label="Sin stock (crítico)" value={summary.outOfStock} tone="red" />
          <SummaryCard label="Bajo mínimo" value={summary.lowStock} tone="amber" />
          <SummaryCard label="Requisiciones pendientes" value={summary.pendingRequisitions} tone="gold" />
          <SummaryCard label="OC en borrador" value={summary.draftPurchaseOrders} tone="green" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <Heading level={5} className="!text-sm">Alertas ({visibleAlerts.length})</Heading>
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

      <div className="flex flex-col gap-2">
        {visibleAlerts.length === 0 && (
          <div className="bg-charcoal-surface/50 border border-aged-bronze/20 rounded p-6 text-center text-sm text-text-secondary">
            No hay alertas activas. El inventario está saludable.
          </div>
        )}

        {visibleAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`flex flex-col sm:flex-row sm:items-center gap-3 bg-charcoal-surface border rounded-lg p-4 ${
              alert.alertType === 'out_of_stock' ? 'border-error-red/40' : 'border-aged-bronze/30'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-text-primary truncate">{alert.productName}</span>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                  alert.alertType === 'out_of_stock' ? 'bg-error-red/20 text-error-red' : 'bg-aged-bronze/20 text-champagne-gold'
                }`}>
                  {alert.alertType === 'out_of_stock' ? 'Sin stock' : 'Bajo mínimo'}
                </span>
                {alert.status === 'resolved' && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Resuelta</span>
                )}
              </div>
              <div className="text-xs text-text-secondary mt-1">
                {alert.branchName} · Stock actual: <span className="text-text-primary">{alert.currentQty}</span> · Mínimo: <span className="text-text-primary">{alert.threshold}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {alert.status !== 'resolved' && (
                <>
                  <Button variant="secondary" size="sm" disabled={actionId === alert.id} onClick={() => handleGenerateRequisition(alert)}>
                    Generar Requisición
                  </Button>
                  <Button variant="primary" size="sm" disabled={actionId === alert.id} onClick={() => handleGeneratePurchaseOrder(alert)}>
                    Generar OC
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};
