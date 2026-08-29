import React, { useState, useEffect, useCallback } from 'react';
import { api, Warehouse, Branch, Product } from '../services/api';
import { Button } from '../components/atoms/Button';
import { Heading } from '../components/atoms/Heading';
import { Input } from '../components/atoms/Input';
import { FormField } from '../components/molecules/FormField';
import { Autocomplete } from '../components/molecules/Autocomplete';
import { ToastContainer } from '../components/molecules/ToastNotification';

interface TransfersPageProps {
  businessId: string;
}

interface TransferLineItem {
  productId: string;
  productName: string;
  quantity: number;
}

interface TransferRow {
  id: string;
  fromWarehouseId?: string | null;
  fromBranchId?: string | null;
  toWarehouseId?: string | null;
  toBranchId?: string | null;
  fromWarehouseName?: string | null;
  fromBranchName?: string | null;
  toWarehouseName?: string | null;
  toBranchName?: string | null;
  status: string;
  notes?: string | null;
  transferredAt?: string | null;
  itemCount?: number;
  items?: Array<{ productId: string; productName: string; quantity: string; unitCost?: string; totalCost?: string }>;
}

export const TransfersPage: React.FC<TransfersPageProps> = ({ businessId }) => {
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [fromType, setFromType] = useState<'warehouse' | 'branch'>('warehouse');
  const [fromId, setFromId] = useState('');
  const [toType, setToType] = useState<'warehouse' | 'branch'>('branch');
  const [toId, setToId] = useState('');
  const [notes, setNotes] = useState('');
  const [itemsList, setItemsList] = useState<TransferLineItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [viewingTransfer, setViewingTransfer] = useState<TransferRow | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

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
    setError(null);
    try {
      const [whData, branchData, prodData, transData] = await Promise.all([
        api.getWarehouses(businessId),
        api.getBranches(businessId),
        api.getProducts(businessId),
        api.getTransfers(businessId),
      ]);
      setWarehouses(whData);
      setBranches(branchData);
      setProducts(prodData);
      setTransfers(transData);

      if (whData.length > 0) setFromId(whData[0].id);
      if (branchData.length > 0) setToId(branchData[0].id);
      if (prodData.length > 0) setSelectedProductId(prodData[0].id);
    } catch (err: any) {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setIsCreating(false);
    setFromType('warehouse');
    setFromId(warehouses.length > 0 ? warehouses[0].id : '');
    setToType('branch');
    setToId(branches.length > 0 ? branches[0].id : '');
    setNotes('');
    setItemsList([]);
    setItemQuantity('1');
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      showToast('Seleccione un producto.', 'warning');
      return;
    }
    const qty = parseFloat(itemQuantity);
    if (isNaN(qty) || qty <= 0) {
      showToast('La cantidad debe ser mayor a cero.', 'warning');
      return;
    }
    const prod = products.find((p) => p.id === selectedProductId);
    const productName = prod ? prod.name : 'Producto';

    const existing = itemsList.find((it) => it.productId === selectedProductId);
    if (existing) {
      const newItems = itemsList.map((it) =>
        it.productId === selectedProductId ? { ...it, quantity: it.quantity + qty } : it,
      );
      setItemsList(newItems);
    } else {
      setItemsList((prev) => [...prev, { productId: selectedProductId, productName, quantity: qty }]);
    }
    setItemQuantity('1');
  };

  const removeItem = (index: number) => setItemsList(itemsList.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromId || !toId) {
      showToast('Especifique origen y destino.', 'warning');
      return;
    }
    if (fromType === toType && fromId === toId) {
      showToast('El origen y el destino no pueden ser idénticos.', 'warning');
      return;
    }
    if (itemsList.length === 0) {
      showToast('Agregue al menos un producto.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.recordTransfer(
        {
          fromWarehouseId: fromType === 'warehouse' ? fromId : undefined,
          fromBranchId: fromType === 'branch' ? fromId : undefined,
          toWarehouseId: toType === 'warehouse' ? toId : undefined,
          toBranchId: toType === 'branch' ? toId : undefined,
          notes: notes.trim() || undefined,
          items: itemsList.map((it) => ({ productId: it.productId, quantity: it.quantity })),
        },
        businessId,
      );
      showToast('Traspaso enviado. Stock en tránsito.', 'success');
      resetForm();
      await fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error al procesar el traspaso.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleView = async (id: string) => {
    try {
      const full = await api.getTransfer(id);
      setViewingTransfer(full);
    } catch {
      showToast('Error al cargar el traspaso.', 'error');
    }
  };

  const handleShip = async (id: string) => {
    setActioningId(id);
    try {
      await api.shipTransfer(id);
      showToast('Traspaso enviado.', 'success');
      setViewingTransfer(null);
      await fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error al enviar el traspaso.', 'error');
    } finally {
      setActioningId(null);
    }
  };

  const handleReceive = async (id: string) => {
    setActioningId(id);
    try {
      await api.receiveTransfer(id);
      showToast('Traspaso recibido. Stock actualizado en destino.', 'success');
      setViewingTransfer(null);
      await fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error al recibir el traspaso.', 'error');
    } finally {
      setActioningId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      pending: 'bg-gray-500/20 text-gray-300',
      in_transit: 'bg-blue-500/20 text-blue-300',
      received: 'bg-green-500/20 text-green-300',
      completed: 'bg-green-500/20 text-green-300',
      cancelled: 'bg-red-500/20 text-red-300',
    };
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      in_transit: 'En Tránsito',
      received: 'Recibido',
      completed: 'Completado',
      cancelled: 'Cancelado',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badges[status] || badges.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  const originLabel = (t: TransferRow) => t.fromWarehouseName || t.fromBranchName || '—';
  const destLabel = (t: TransferRow) => t.toWarehouseName || t.toBranchName || '—';

  const filtered = transfers.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || originLabel(t).toLowerCase().includes(q) || destLabel(t).toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="w-full lg:h-full min-h-full bg-obsidian p-2 lg:p-6 font-sans overflow-y-auto lg:overflow-hidden">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className="flex flex-col lg:flex-row gap-6 min-h-fit lg:h-full max-w-7xl mx-auto w-full">
        {/* Left Side: Transfers List */}
        <div className="flex-1 flex flex-col gap-4 lg:h-full overflow-hidden">
          <div className="flex justify-between items-center">
            <Heading level={2} className="!text-lg sm:!text-2xl !border-none !pb-0 text-champagne-gold">
              Traspasos
            </Heading>
            <Button onClick={() => { setIsCreating(true); resetForm(); }} disabled={isCreating}>
              + Nuevo Traspaso
            </Button>
          </div>

          {error && (
            <div className="bg-error-red/10 border border-error-red/30 text-error-red rounded p-3 text-xs">{error}</div>
          )}

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <svg className="animate-spin h-6 w-6 text-champagne-gold" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : transfers.length === 0 && !isCreating ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-secondary text-xs">
              <span>No hay traspasos registrados</span>
            </div>
          ) : (
            <>
              {/* Search and Filters Bar */}
              <div className="flex flex-col md:flex-row gap-4 bg-onyx-surface border border-aged-bronze/40 rounded p-4 shadow-md shadow-black/10 items-center justify-between">
                <div className="w-full md:w-72 relative">
                  <Input
                    type="text"
                    placeholder="Buscar por origen o destino..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                  <svg className="w-4 h-4 text-text-secondary absolute left-3.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary whitespace-nowrap">Estado:</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-1.5 bg-charcoal-surface border border-aged-bronze focus:border-champagne-gold rounded font-sans text-xs text-text-primary transition-all duration-300 focus:outline-none cursor-pointer"
                    >
                      <option value="all">Todos los Estados</option>
                      <option value="pending">Pendiente</option>
                      <option value="in_transit">En Tránsito</option>
                      <option value="received">Recibido</option>
                      <option value="completed">Completado</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Transfers Table Card */}
              <div className="flex-1 bg-onyx-surface border border-aged-bronze/40 rounded shadow-md shadow-black/20 overflow-hidden flex flex-col min-h-0">
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse select-text">
                    <thead>
                      <tr className="bg-charcoal-surface/60 border-b border-aged-bronze/35 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                        <th className="px-6 py-4">Origen</th>
                        <th className="px-6 py-4">Destino</th>
                        <th className="px-6 py-4 text-center">Items</th>
                        <th className="px-6 py-4 text-center">Estado</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-aged-bronze/20 text-sm">
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-text-secondary italic">
                            {searchQuery || statusFilter !== 'all'
                              ? 'No se encontraron traspasos que coincidan con la búsqueda.'
                              : 'No hay traspasos registrados.'}
                          </td>
                        </tr>
                      ) : (
                        filtered.map((t) => (
                          <tr key={t.id} className="hover:bg-charcoal-surface/20 transition-colors">
                            <td className="px-6 py-4 text-text-secondary text-xs">{originLabel(t)}</td>
                            <td className="px-6 py-4 font-medium text-text-primary text-xs">{destLabel(t)}</td>
                            <td className="px-6 py-4 text-center font-mono text-xs text-champagne-gold">{t.itemCount || 0}</td>
                            <td className="px-6 py-4 text-center">{getStatusBadge(t.status)}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="inline-flex gap-1 items-center">
                                <button
                                  onClick={() => handleView(t.id)}
                                  className="text-text-secondary hover:text-champagne-gold transition-colors p-1 rounded hover:bg-champagne-gold/5"
                                  title="Ver detalle"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                                {t.status === 'pending' && (
                                  <button
                                    onClick={() => handleShip(t.id)}
                                    disabled={actioningId === t.id}
                                    className="text-blue-400 hover:text-blue-300 transition-colors text-xs px-2 py-1 rounded hover:bg-blue-400/5"
                                  >
                                    Enviar
                                  </button>
                                )}
                                {t.status === 'in_transit' && (
                                  <button
                                    onClick={() => handleView(t.id)}
                                    disabled={actioningId === t.id}
                                    className="text-champagne-gold hover:underline text-xs px-2"
                                  >
                                    Recibir
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bg-charcoal-surface/40 border-t border-aged-bronze/35 px-6 py-3 flex items-center justify-between text-xs text-text-secondary">
                  <span>Mostrando {filtered.length} de {transfers.length} traspasos</span>
                  <span className="font-mono">En tránsito: {transfers.filter((t) => t.status === 'in_transit').length}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Side: Create Form */}
        {isCreating && (
          <div className="w-full lg:w-96 bg-onyx-surface border border-aged-bronze/40 rounded-lg p-4 lg:p-6 shadow-xl lg:h-full overflow-y-auto">
            <Heading level={3} className="!text-base !border-none !pb-0 text-champagne-gold mb-4">
              Nuevo Traspaso
            </Heading>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label="Origen">
                <div className="flex flex-col gap-2">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                      <input type="radio" checked={fromType === 'warehouse'} onChange={() => setFromType('warehouse')} className="accent-champagne-gold" />
                      Bodega
                    </label>
                    <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                      <input type="radio" checked={fromType === 'branch'} onChange={() => setFromType('branch')} className="accent-champagne-gold" />
                      Sucursal
                    </label>
                  </div>
                  <select
                    value={fromId}
                    onChange={(e) => setFromId(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal border border-aged-bronze/30 rounded text-text-primary text-sm"
                    required
                    data-testid="transfer-from"
                  >
                    <option value="">Seleccionar...</option>
                    {fromType === 'warehouse'
                      ? warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)
                      : branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </FormField>

              <FormField label="Destino">
                <div className="flex flex-col gap-2">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                      <input type="radio" checked={toType === 'warehouse'} onChange={() => setToType('warehouse')} className="accent-champagne-gold" />
                      Bodega
                    </label>
                    <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                      <input type="radio" checked={toType === 'branch'} onChange={() => setToType('branch')} className="accent-champagne-gold" />
                      Sucursal
                    </label>
                  </div>
                  <select
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal border border-aged-bronze/30 rounded text-text-primary text-sm"
                    required
                    data-testid="transfer-to"
                  >
                    <option value="">Seleccionar...</option>
                    {toType === 'warehouse'
                      ? warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)
                      : branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </FormField>

              <FormField label="Notas">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal border border-aged-bronze/30 rounded text-text-primary text-sm"
                  rows={2}
                />
              </FormField>

              {/* Product Adder */}
              <div className="border-t border-aged-bronze/20 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-champagne-gold mb-3">Agregar Productos</h3>
                <div className="space-y-2">
                  <label className="block text-[10px] text-text-secondary uppercase">Buscar Producto</label>
                  <Autocomplete
                    options={products.map((p) => ({
                      id: p.id,
                      label: p.name,
                      sublabel: p.sku ? `SKU: ${p.sku}` : undefined,
                    }))}
                    value={selectedProductId}
                    onChange={setSelectedProductId}
                    placeholder="Buscar producto..."
                  />
                </div>
                {selectedProductId && (
                  <div className="flex gap-2 items-end mt-2">
                    <div className="flex-1">
                      <label className="block text-[10px] text-text-secondary uppercase mb-1">Cantidad</label>
                      <Input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(e.target.value)}
                        className="text-xs"
                        data-testid="transfer-quantity"
                      />
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={handleAddItem}>Agregar</Button>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="bg-charcoal/30 border border-aged-bronze/15 rounded p-3 min-h-[100px] max-h-[260px] overflow-y-auto">
                <span className="block text-[10px] text-text-secondary uppercase tracking-wider mb-2 font-bold">
                  Productos en el Traspaso
                </span>
                {itemsList.length === 0 ? (
                  <div className="text-center py-6 text-xs text-text-secondary/40">No has agregado productos.</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {itemsList.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs bg-charcoal/40 border border-aged-bronze/10 rounded px-2.5 py-2">
                        <span className="font-semibold text-text-primary">{item.productName}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-champagne-gold font-semibold">{item.quantity}</span>
                          <button type="button" onClick={() => removeItem(idx)} className="text-error-red/80 hover:text-error-red transition-colors p-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Enviando...' : 'Enviar Traspaso'}
                </Button>
                <Button type="button" variant="secondary" className="flex-1" onClick={resetForm}>Cancelar</Button>
              </div>
            </form>
          </div>
        )}

        {/* Detail / Receive Modal */}
        {viewingTransfer && (
          <div className="fixed inset-0 bg-obsidian/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
            <div className="bg-onyx-surface border border-aged-bronze/35 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-aged-bronze/25 flex items-center justify-between">
                <div>
                  <Heading level={2} className="!text-champagne-gold !border-none !pb-0 font-light font-sans text-lg">
                    Detalle de Traspaso
                  </Heading>
                  <div className="flex gap-4 mt-1 text-xs text-text-secondary">
                    <span>{originLabel(viewingTransfer)} → {destLabel(viewingTransfer)}</span>
                    <span>{getStatusBadge(viewingTransfer.status)}</span>
                  </div>
                  {viewingTransfer.notes && <p className="text-xs text-text-secondary mt-1 italic">Notas: {viewingTransfer.notes}</p>}
                </div>
                <button onClick={() => setViewingTransfer(null)} className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto p-6">
                {viewingTransfer.items && viewingTransfer.items.length > 0 ? (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-charcoal-surface/60 border-b border-aged-bronze/35 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                        <th className="px-4 py-3">Producto</th>
                        <th className="px-4 py-3 text-right">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-aged-bronze/20">
                      {viewingTransfer.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-3 font-medium text-text-primary">{item.productName}</td>
                          <td className="px-4 py-3 text-right font-mono text-champagne-gold">{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-text-secondary/50 text-xs">Este traspaso no tiene productos registrados.</div>
                )}
              </div>

              <div className="p-6 border-t border-aged-bronze/25">
                {viewingTransfer.status === 'in_transit' && (
                  <Button
                    variant="primary"
                    fullWidth
                    disabled={actioningId === viewingTransfer.id}
                    onClick={() => handleReceive(viewingTransfer.id)}
                  >
                    {actioningId === viewingTransfer.id ? 'Recibiendo...' : 'Confirmar Recepción'}
                  </Button>
                )}
                {viewingTransfer.status === 'pending' && (
                  <Button
                    variant="primary"
                    fullWidth
                    disabled={actioningId === viewingTransfer.id}
                    onClick={() => handleShip(viewingTransfer.id)}
                  >
                    {actioningId === viewingTransfer.id ? 'Enviando...' : 'Enviar Traspaso'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
