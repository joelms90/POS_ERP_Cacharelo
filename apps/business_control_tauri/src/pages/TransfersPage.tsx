import React, { useState, useEffect, useCallback } from 'react';
import { api, Warehouse, BranchRequisition } from '../services/api';
import { Button } from '../components/atoms/Button';
import { Heading } from '../components/atoms/Heading';
import { Input } from '../components/atoms/Input';
import { Badge } from '../components/atoms/Badge';
import { ToastContainer } from '../components/molecules/ToastNotification';
import { Autocomplete } from '../components/molecules/Autocomplete';

interface TransfersPageProps {
  businessId: string;
}

export const TransfersPage: React.FC<TransfersPageProps> = ({ businessId }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'history' | 'report-summary' | 'report-detailed'>('create');
  
  // Data lists
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  
  // Report states
  const [reportSummary, setReportSummary] = useState<any[]>([]);
  const [reportDetailed, setReportDetailed] = useState<any[]>([]);
  
  // Filter states
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Default to start of month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]; // Today
  });
  const [selectedReportBranchId, setSelectedReportBranchId] = useState('');

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'warning' }>>([]);

  // Form states (Create Transfer)
  const [fromType, setFromType] = useState<'warehouse' | 'branch'>('warehouse');
  const [fromId, setFromId] = useState('');
  const [toType, setToType] = useState<'warehouse' | 'branch'>('branch');
  const [toId, setToId] = useState('');
  const [notes, setNotes] = useState('');
  const [itemsList, setItemsList] = useState<Array<{ productId: string; productName: string; quantity: number; cost: string }>>([]);
  
  // Requisition integration
  const [approvedRequisitions, setApprovedRequisitions] = useState<BranchRequisition[]>([]);
  const [selectedRequisitionId, setSelectedRequisitionId] = useState('');
  const [isLinkedToRequisition, setIsLinkedToRequisition] = useState(false);

  // Add item form states
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [whData, prodData, transData, branchData, reqData] = await Promise.all([
        api.getWarehouses(businessId),
        api.getProducts(businessId),
        api.getTransfers(businessId),
        api.getBranches(businessId),
        api.getAllRequisitions(businessId),
      ]);
      
      setWarehouses(whData);
      setProducts(prodData);
      setTransfers(transData);
      setBranches(branchData);
      setApprovedRequisitions(reqData.filter(r => r.status === 'approved'));

      if (whData.length > 0) {
        setFromId(whData[0].id);
      } else if (branchData.length > 0) {
        setFromType('branch');
        setFromId(branchData[0].id);
      }

      if (branchData.length > 0) {
        setToId(branchData[0].id);
        setSelectedReportBranchId(branchData[0].id);
      } else if (whData.length > 0) {
        setToType('warehouse');
        setToId(whData[0].id);
      }
      
      if (prodData.length > 0) setSelectedProductId(prodData[0].id);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar catálogos de traspaso.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [businessId, showToast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load summary report
  const fetchSummaryReport = async () => {
    setIsLoading(true);
    try {
      const data = await api.getTransfersSummaryReport(businessId, startDate, endDate);
      setReportSummary(data);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar reporte general.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Load detailed report
  const fetchDetailedReport = async () => {
    if (!selectedReportBranchId) {
      showToast('Seleccione un punto de venta destino.', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      const data = await api.getTransfersDetailedReport(businessId, selectedReportBranchId, startDate, endDate);
      setReportDetailed(data);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar reporte detallado.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'report-summary') {
      fetchSummaryReport();
    } else if (activeTab === 'report-detailed') {
      fetchDetailedReport();
    } else if (activeTab === 'history') {
      api.getTransfers(businessId).then(setTransfers).catch(() => {});
    }
  }, [activeTab, startDate, endDate, selectedReportBranchId]);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;
    
    const qty = parseFloat(itemQuantity);
    if (isNaN(qty) || qty <= 0) {
      showToast('La cantidad debe ser mayor a cero.', 'warning');
      return;
    }

    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    // Check duplicate
    if (itemsList.some(item => item.productId === selectedProductId)) {
      showToast('El producto ya está en la lista. Edite o elimine.', 'warning');
      return;
    }

    setItemsList(prev => [...prev, {
      productId: selectedProductId,
      productName: prod.name,
      quantity: qty,
      cost: prod.cost || '0.00'
    }]);

    setItemQuantity('1');
  };

  const handleRemoveItem = (index: number) => {
    setItemsList(prev => prev.filter((_, i) => i !== index));
  };

  const handleLoadRequisition = async (reqId: string) => {
    if (!reqId) {
      setIsLinkedToRequisition(false);
      return;
    }

    try {
      const req = await api.getRequisition(reqId);
      if (!req) return;

      setIsLinkedToRequisition(true);

      // Set source = warehouse (toWarehouseId in req)
      setFromType('warehouse');
      setFromId(req.toWarehouseId);

      // Set destination = branch (fromBranchId in req)
      setToType('branch');
      setToId(req.fromBranchId);

      // Load items with quantities
      if (req.items && req.items.length > 0) {
        const items = req.items.map((item) => {
          const prod = products.find(p => p.id === item.productId);
          const qty = item.approvedQuantity || item.requestedQuantity;
          return {
            productId: item.productId,
            productName: prod?.name || item.productName || 'Insumo',
            quantity: qty,
            cost: prod?.cost || '0',
          };
        });
        setItemsList(items);
        showToast(`Requisición cargada con ${items.length} productos.`, 'success');
      }
    } catch (err) {
      showToast('Error al cargar requisición.', 'error');
      setIsLinkedToRequisition(false);
    }
  };

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (itemsList.length === 0) {
      showToast('Debe agregar al menos un producto a la lista.', 'warning');
      return;
    }
    if (!fromId || !toId) {
      showToast('Especifique origen y destino para el traspaso.', 'warning');
      return;
    }
    if (fromType === toType && fromId === toId) {
      showToast('El origen y el destino no pueden ser idénticos.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        fromWarehouseId: fromType === 'warehouse' ? fromId : undefined,
        fromBranchId: fromType === 'branch' ? fromId : undefined,
        toWarehouseId: toType === 'warehouse' ? toId : undefined,
        toBranchId: toType === 'branch' ? toId : undefined,
        notes: notes.trim() || undefined,
        items: itemsList.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      };

      await api.recordTransfer(payload, businessId);

      // If linked to a requisition, mark it as completed
      if (isLinkedToRequisition && selectedRequisitionId) {
        try {
          await api.updateRequisitionStatus(selectedRequisitionId, { status: 'completed', notes: 'Traspaso ejecutado.' });
        } catch {
          // Non-critical: transfer succeeded even if requisition update fails
        }
      }

      showToast('Traspaso enviado con éxito. Stock actualizado.', 'success');
      
      // Reset form
      setItemsList([]);
      setNotes('');
      setSelectedRequisitionId('');
      setIsLinkedToRequisition(false);
      
      // Reload history
      const transData = await api.getTransfers(businessId);
      setTransfers(transData);
    } catch (err: any) {
      showToast(err.message || 'Error al procesar el traspaso.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate total draft transfer cost
  const totalDraftCost = itemsList.reduce((acc, item) => acc + (parseFloat(item.cost) * item.quantity), 0);

  return (
    <div className="flex flex-col h-full gap-6 animate-fade-in text-text-primary">
      <ToastContainer toasts={toasts} onClose={removeToast} />
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-aged-bronze/20 pb-4">
        <div>
          <Heading level={2} className="!border-none !pb-0 font-sans tracking-wide">
            Traspasos y Reportes de Sucursal
          </Heading>
          <p className="text-xs text-text-secondary mt-1">
            Envío de mercancía a puntos de venta y control de costos para oficina.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-aged-bronze/20 bg-onyx-surface p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('create')}
          className={`flex-1 py-2 px-4 rounded text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
            activeTab === 'create'
              ? 'bg-charcoal-surface text-champagne-gold border border-champagne-gold/20 shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Nuevo Envío
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 px-4 rounded text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
            activeTab === 'history'
              ? 'bg-charcoal-surface text-champagne-gold border border-champagne-gold/20 shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Historial de Envíos
        </button>
        <button
          onClick={() => setActiveTab('report-summary')}
          className={`flex-1 py-2 px-4 rounded text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
            activeTab === 'report-summary'
              ? 'bg-charcoal-surface text-champagne-gold border border-champagne-gold/20 shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Reporte General Costos
        </button>
        <button
          onClick={() => setActiveTab('report-detailed')}
          className={`flex-1 py-2 px-4 rounded text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
            activeTab === 'report-detailed'
              ? 'bg-charcoal-surface text-champagne-gold border border-champagne-gold/20 shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Detalle por Sucursal
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center py-12">
            <svg className="animate-spin h-8 w-8 text-champagne-gold" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}

        {!isLoading && activeTab === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create form */}
            <form onSubmit={handleSubmitTransfer} className="lg:col-span-1 bg-onyx-surface p-6 rounded-lg border border-aged-bronze/20 flex flex-col gap-4">
              {/* Requisition Loader */}
              <div className="bg-charcoal-surface/40 border border-aged-bronze/15 rounded p-3">
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Cargar desde Requisición (opcional)
                </label>
                <select
                  value={selectedRequisitionId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedRequisitionId(val);
                    handleLoadRequisition(val);
                  }}
                  className="w-full bg-charcoal border border-aged-bronze/45 rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-champagne-gold"
                >
                  <option value="">Sin requisición (manual)</option>
                  {approvedRequisitions.map((req) => {
                    const branchName = branches.find(b => b.id === req.fromBranchId)?.name || 'Sucursal';
                    return (
                      <option key={req.id} value={req.id}>
                        {branchName} — {req.itemCount || req.items?.length || 0} items
                      </option>
                    );
                  })}
                </select>
                {isLinkedToRequisition && (
                  <button
                    type="button"
                    onClick={() => { setSelectedRequisitionId(''); setIsLinkedToRequisition(false); setItemsList([]); }}
                    className="mt-2 text-xs text-champagne-gold hover:underline"
                  >
                    Desvincular requisición
                  </button>
                )}
              </div>

              <span className="text-sm font-semibold text-champagne-gold uppercase tracking-wider">
                Configuración del Traspaso
              </span>
              
              {/* Origen Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-secondary font-semibold">Origen del Traspaso</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFromType('warehouse');
                      if (warehouses.length > 0) setFromId(warehouses[0].id);
                    }}
                    className={`flex-1 py-1 rounded text-[10px] font-semibold uppercase tracking-wider border transition-all ${
                      fromType === 'warehouse'
                        ? 'bg-champagne-gold/20 text-champagne-gold border-champagne-gold/40'
                        : 'bg-charcoal-surface text-text-secondary border-aged-bronze/10'
                    }`}
                  >
                    Bodega
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFromType('branch');
                      if (branches.length > 0) setFromId(branches[0].id);
                    }}
                    className={`flex-1 py-1 rounded text-[10px] font-semibold uppercase tracking-wider border transition-all ${
                      fromType === 'branch'
                        ? 'bg-champagne-gold/20 text-champagne-gold border-champagne-gold/40'
                        : 'bg-charcoal-surface text-text-secondary border-aged-bronze/10'
                    }`}
                  >
                    Sucursal
                  </button>
                </div>
                <select
                  value={fromId}
                  onChange={(e) => setFromId(e.target.value)}
                  className="bg-charcoal-surface border border-aged-bronze text-text-primary rounded p-2.5 font-sans text-xs focus:outline-none focus:ring-1 focus:ring-champagne-gold cursor-pointer"
                  required
                >
                  {fromType === 'warehouse'
                    ? warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)
                    : branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)
                  }
                </select>
              </div>

              {/* Destino Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-secondary font-semibold">Destino del Traspaso</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setToType('warehouse');
                      if (warehouses.length > 0) setToId(warehouses[0].id);
                    }}
                    className={`flex-1 py-1 rounded text-[10px] font-semibold uppercase tracking-wider border transition-all ${
                      toType === 'warehouse'
                        ? 'bg-champagne-gold/20 text-champagne-gold border-champagne-gold/40'
                        : 'bg-charcoal-surface text-text-secondary border-aged-bronze/10'
                    }`}
                  >
                    Bodega
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setToType('branch');
                      if (branches.length > 0) setToId(branches[0].id);
                    }}
                    className={`flex-1 py-1 rounded text-[10px] font-semibold uppercase tracking-wider border transition-all ${
                      toType === 'branch'
                        ? 'bg-champagne-gold/20 text-champagne-gold border-champagne-gold/40'
                        : 'bg-charcoal-surface text-text-secondary border-aged-bronze/10'
                    }`}
                  >
                    Sucursal
                  </button>
                </div>
                <select
                  value={toId}
                  onChange={(e) => setToId(e.target.value)}
                  className="bg-charcoal-surface border border-aged-bronze text-text-primary rounded p-2.5 font-sans text-xs focus:outline-none focus:ring-1 focus:ring-champagne-gold cursor-pointer"
                  required
                >
                  {toType === 'warehouse'
                    ? warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)
                    : branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)
                  }
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-text-secondary">Notas / Observaciones</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Traspaso semanal de insumos..."
                  className="bg-charcoal-surface border border-aged-bronze text-text-primary rounded p-2.5 font-sans text-xs focus:outline-none focus:ring-1 focus:ring-champagne-gold resize-none h-20"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || itemsList.length === 0}
                className="w-full mt-2"
              >
                {isSubmitting ? 'Registrando...' : 'Registrar y Enviar Traspaso'}
              </Button>
            </form>

            {/* List and Item adder */}
            <div className="lg:col-span-2 flex flex-col gap-6 bg-onyx-surface p-6 rounded-lg border border-aged-bronze/20">
              <span className="text-sm font-semibold text-champagne-gold uppercase tracking-wider">
                Productos en el Traspaso
              </span>

              {/* Add item bar */}
              <form onSubmit={handleAddItem} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-charcoal-surface/40 p-4 rounded border border-aged-bronze/10">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-[10px] text-text-secondary uppercase">Buscar Insumo / Producto</label>
                  <Autocomplete
                    options={products.map((p) => ({
                      id: p.id,
                      label: p.name,
                      sublabel: `${p.internalCode ? `Código: ${p.internalCode}` : p.sku ? `SKU: ${p.sku}` : ''} - Costo: $${p.cost || '0.00'}`,
                    }))}
                    value={selectedProductId}
                    onChange={setSelectedProductId}
                    placeholder="Buscar insumo o producto..."
                  />
                </div>
                <div className="flex gap-2 items-end sm:col-span-1">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[10px] text-text-secondary uppercase">Cantidad</label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      className="!py-2"
                    />
                  </div>
                  <Button type="submit" variant="secondary" className="px-4 py-2 text-xs">
                    Agregar
                  </Button>
                </div>
              </form>

              {/* Items Table list */}
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-aged-bronze/20 text-xs font-semibold text-text-secondary uppercase">
                      <th className="py-2.5 px-3">Descripción</th>
                      <th className="py-2.5 px-3 text-right">Costo Unitario</th>
                      <th className="py-2.5 px-3 text-center">Cantidad</th>
                      <th className="py-2.5 px-3 text-right">Costo Total</th>
                      <th className="py-2.5 px-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aged-bronze/10 text-xs">
                    {itemsList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-text-secondary italic">
                          No hay productos añadidos al borrador del traspaso.
                        </td>
                      </tr>
                    ) : (
                      itemsList.map((item, index) => {
                        const total = parseFloat(item.cost) * item.quantity;
                        return (
                          <tr key={item.productId} className="hover:bg-charcoal-surface/20">
                            <td className="py-3 px-3 font-medium text-text-primary">{item.productName}</td>
                            <td className="py-3 px-3 text-right font-mono">${item.cost}</td>
                            <td className="py-3 px-3 text-center font-semibold font-mono">{item.quantity}</td>
                            <td className="py-3 px-3 text-right font-mono text-champagne-gold font-semibold">${total.toFixed(2)}</td>
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="text-red-400 hover:text-red-300 font-bold"
                              >
                                Quitar
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer draft total */}
              {itemsList.length > 0 && (
                <div className="border-t border-aged-bronze/20 pt-4 flex justify-between items-center">
                  <span className="text-xs text-text-secondary uppercase">Total Estimado del Traspaso</span>
                  <span className="text-lg font-bold font-mono text-champagne-gold">${totalDraftCost.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {!isLoading && activeTab === 'history' && (
          <div className="bg-onyx-surface p-6 rounded-lg border border-aged-bronze/20">
            <span className="text-sm font-semibold text-champagne-gold uppercase tracking-wider block mb-4">
              Historial de Envíos Realizados
            </span>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-aged-bronze/20 text-xs font-semibold text-text-secondary uppercase">
                    <th className="py-3 px-4">Fecha/Hora</th>
                    <th className="py-3 px-4">Origen</th>
                    <th className="py-3 px-4">Destino</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aged-bronze/10 text-xs">
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-text-secondary italic">
                        No se han registrado traspasos de mercancía todavía.
                      </td>
                    </tr>
                  ) : (
                    transfers.map((t) => (
                      <tr key={t.id} className="hover:bg-charcoal-surface/20">
                        <td className="py-3 px-4 font-mono">
                          {new Date(t.transferredAt).toLocaleString('es-MX', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4 text-text-secondary">{t.fromWarehouseName || t.fromBranchName || 'Desconocido'}</td>
                        <td className="py-3 px-4 text-text-primary font-medium">{t.toWarehouseName || t.toBranchName || 'Desconocido'}</td>
                        <td className="py-3 px-4">
                          <Badge variant="success">{t.status.toUpperCase()}</Badge>
                        </td>
                        <td className="py-3 px-4 text-text-secondary max-w-xs truncate" title={t.notes}>
                          {t.notes || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Report Summary Tab */}
        {!isLoading && activeTab === 'report-summary' && (
          <div className="flex flex-col gap-6">
            {/* Rango de Fechas Filter bar */}
            <div className="flex flex-col sm:flex-row gap-4 p-4 bg-onyx-surface rounded-lg border border-aged-bronze/20 items-end">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs text-text-secondary">Fecha Inicial</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-charcoal-surface border border-aged-bronze text-text-primary rounded p-2 text-xs focus:outline-none focus:ring-1 focus:ring-champagne-gold"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs text-text-secondary">Fecha Final</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-charcoal-surface border border-aged-bronze text-text-primary rounded p-2 text-xs focus:outline-none focus:ring-1 focus:ring-champagne-gold"
                />
              </div>
              <Button onClick={fetchSummaryReport} variant="secondary" className="px-6 py-2 text-xs font-semibold uppercase">
                Filtrar Reporte
              </Button>
            </div>

            {/* Financial Summary panel */}
            <div className="bg-onyx-surface p-6 rounded-lg border border-aged-bronze/20">
              <span className="text-sm font-semibold text-champagne-gold uppercase tracking-wider block mb-4">
                Valor Total Enviado por Punto de Venta (Consolidado)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {reportSummary.map((item) => (
                  <div key={item.branchId} className="bg-charcoal-surface/40 border border-aged-bronze/10 rounded-lg p-5 flex flex-col justify-between">
                    <span className="text-xs text-text-secondary uppercase font-semibold">{item.branchName}</span>
                    <span className="text-2xl font-bold font-mono text-champagne-gold mt-2">${parseFloat(item.totalCost).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                {reportSummary.length === 0 && (
                  <div className="col-span-3 py-6 text-center text-text-secondary italic">
                    No se encontró mercancía enviada en este periodo.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Report Detailed Tab */}
        {!isLoading && activeTab === 'report-detailed' && (
          <div className="flex flex-col gap-6">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 p-4 bg-onyx-surface rounded-lg border border-aged-bronze/20 items-end">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs text-text-secondary">Punto de Venta Destino</label>
                <select
                  value={selectedReportBranchId}
                  onChange={(e) => setSelectedReportBranchId(e.target.value)}
                  className="bg-charcoal-surface border border-aged-bronze text-text-primary rounded p-2.5 font-sans text-xs focus:outline-none cursor-pointer w-full"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs text-text-secondary">Fecha Inicial</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-charcoal-surface border border-aged-bronze text-text-primary rounded p-2 text-xs focus:outline-none focus:ring-1 focus:ring-champagne-gold"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs text-text-secondary">Fecha Final</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-charcoal-surface border border-aged-bronze text-text-primary rounded p-2 text-xs focus:outline-none focus:ring-1 focus:ring-champagne-gold"
                />
              </div>
              <Button onClick={fetchDetailedReport} variant="secondary" className="px-6 py-2 text-xs font-semibold uppercase">
                Generar Detalle
              </Button>
            </div>

            {/* Detailed Table */}
            <div className="bg-onyx-surface p-6 rounded-lg border border-aged-bronze/20">
              <span className="text-sm font-semibold text-champagne-gold uppercase tracking-wider block mb-4">
                Desglose Detallado de Mercancía Enviada
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-aged-bronze/20 text-xs font-semibold text-text-secondary uppercase">
                      <th className="py-3 px-4">Descripción del Producto</th>
                      <th className="py-3 px-4">Código Interno</th>
                      <th className="py-3 px-4 text-center">Unidades Enviadas</th>
                      <th className="py-3 px-4 text-right">Costo Total Acumulado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aged-bronze/10 text-xs">
                    {reportDetailed.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-text-secondary italic">
                          No hay registros detallados de mercancía para esta sucursal en el rango de fechas seleccionado.
                        </td>
                      </tr>
                    ) : (
                      reportDetailed.map((item) => (
                        <tr key={item.productId} className="hover:bg-charcoal-surface/20">
                          <td className="py-3 px-4 font-medium text-text-primary">{item.productName}</td>
                          <td className="py-3 px-4 font-mono text-text-secondary">{item.internalCode || item.sku || '-'}</td>
                          <td className="py-3 px-4 text-center font-bold font-mono">{item.totalQuantity}</td>
                          <td className="py-3 px-4 text-right font-semibold font-mono text-champagne-gold">
                            ${parseFloat(item.totalCost).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
